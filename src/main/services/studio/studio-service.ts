import type { LanguageCode } from "@shared/i18n";
import { UserFacingError } from "@shared/codes/user-error";
import type {
  Chunk,
  ChatMessage,
  Source,
  StudioGenerateInput,
  StudioResult,
} from "@shared/ipc/types";
import type { ScoredChunk } from "../rag/rag-types";
import { buildBalancedContext } from "./balanced-context";
import { postprocessCitations, citationsFromMap } from "../rag/citation";
import { STUDIO_ALL_KINDS, STUDIO_CONTEXT_BUDGET } from "./constants";
import {
  assertStudioKindAvailable,
  finalUserContent,
  systemPromptFor,
  type DiffPairTitles,
} from "./prompt";
import { parseCustomPrompt } from "./custom-prompt";
import { resolveSourceScope, STUDIO_MAX_SOURCE_IDS } from "./source-scope";
import {
  numberAll,
  runMapReduce,
  safeProgress,
  type OnStudioProgress,
} from "./map-reduce";
import type { StudioRepo } from "./studio-repo";
import { assertNotAborted, isChatAborted } from "../ai-runtime/abort";

// Điều phối Studio (studio:generate / studio:list). DI: nguồn chunk + chat + repo lưu.
// 105 (ADR studio-large-clarify): ngân sách theo CỬA SỔ NGỮ CẢNH của model (contextInfo) + num_ctx tường minh.
// Vừa ngân sách ⇒ 1 lượt (chia đều theo nguồn, #65); vượt ⇒ map-reduce với [n] TOÀN CỤC (chip vẫn trỏ đúng đoạn).
// Hậu kiểm chip (Constitution II) → lưu PHIÊN BẢN mới (178). KHÔNG log nội dung (Constitution III).

/** Tuỳ chọn một lượt chat Studio. `onToken` (178 PR 4) ⇒ provider chạy nhánh STREAM (huỷ ⇒ trả phần dở, không ném). */
export interface StudioChatOptions {
  numCtx?: number;
  signal?: AbortSignal;
  onToken?: (delta: string) => void;
}

/** Tuỳ chọn một lượt generate. */
export interface StudioGenerateOptions {
  /** 146: tiến độ reading i/N · condensing · writing — không ảnh hưởng kết quả. */
  onProgress?: OnStudioProgress;
  /** 149: huỷ lượt — không gọi thêm AI, KHÔNG lưu; ném UserFacingError("studioCancelled"). */
  signal?: AbortSignal;
  /** 178 (PR 4, FR-040): nhận delta của CHỈ lượt viết cuối. Thiếu ⇒ không stream (hành vi cũ). */
  onToken?: (delta: string) => void;
}

/**
 * 178 (PR 4): bọc onToken — bỏ delta sau khi huỷ (FR-042, kể cả provider vẫn gọi) và nuốt lỗi callback (stream chỉ là phụ,
 * không làm hỏng lượt tạo).
 */
function guardOnToken(
  onToken: ((delta: string) => void) | undefined,
  signal: AbortSignal | undefined,
): ((delta: string) => void) | undefined {
  if (!onToken) return undefined;
  return (delta) => {
    if (signal?.aborted) return;
    try {
      onToken(delta);
    } catch {
      // nuốt — cửa sổ đã đóng…
    }
  };
}

export interface StudioServiceDeps {
  /** 123: ngôn ngữ đầu ra mặc định (ngôn ngữ hiệu lực của main) khi input không gửi/không hợp lệ. */
  defaultOutputLanguage?: () => LanguageCode;
  /** Nguồn của notebook (011) — chỉ đọc. */
  listSources: (notebookId: string) => Source[];
  listChunks: (sourceId: string) => Chunk[];
  studioRepo: StudioRepo;
  /** Gọi LLM chat với messages[], trả nội dung (wrap LLMProvider.chat → content). numCtx: cửa sổ Ollama (105). */
  chat: (messages: ChatMessage[], opts?: StudioChatOptions) => Promise<string>;
  /**
   * 105: ngân sách ký tự cho phần đoạn nguồn + num_ctx theo model đang dùng. Thiếu ⇒ 16.000 ký tự, không ép num_ctx
   * (hành vi cũ).
   */
  contextInfo?: () => Promise<{ budget: number; numCtx: number | null }>;
}

// 178: mọi loại sinh được = 8 loại có nút + "custom" (khớp CHECK DB).
function isStudioKind(k: string): k is (typeof STUDIO_ALL_KINDS)[number] {
  return (STUDIO_ALL_KINDS as readonly string[]).includes(k);
}

export function createStudioService(deps: StudioServiceDeps) {
  /**
   * 146: `onProgress` (tuỳ chọn) nhận reading i/N · condensing · writing — không ảnh hưởng kết quả.
   * 149: `signal` huỷ lượt — không gọi thêm AI, KHÔNG lưu; ném UserFacingError("studioCancelled").
   */
  async function generate(
    input: StudioGenerateInput,
    opts: StudioGenerateOptions = {},
  ): Promise<StudioResult> {
    try {
      return await run(input, opts);
    } catch (e) {
      if (isChatAborted(e) || opts.signal?.aborted) {
        throw new UserFacingError("studioCancelled");
      }
      throw e;
    }
  }

  async function run(
    input: StudioGenerateInput,
    { onProgress, signal, onToken }: StudioGenerateOptions,
  ): Promise<StudioResult> {
    const { notebookId, kind } = input;
    // 123 (FR-018): chỉ nhận vi/en; khác ⇒ ngôn ngữ hiệu lực của main (mặc định vi).
    const outputLanguage: LanguageCode =
      input.outputLanguage === "vi" || input.outputLanguage === "en"
        ? input.outputLanguage
        : (deps.defaultOutputLanguage?.() ?? "vi");
    if (!notebookId || !isStudioKind(kind)) {
      throw new Error("Invalid Studio request.");
    }
    // 248: loại Pro cần module Pro — bản stub từ chối trước mọi đọc nguồn / gọi AI.
    assertStudioKindAvailable(kind, outputLanguage);
    // 178 (FR-021): yêu cầu tuỳ chỉnh kiểm TRƯỚC mọi đọc nguồn / gọi AI; loại khác ⇒ bỏ qua customPrompt. Không log văn bản.
    let customPrompt: string | undefined;
    if (kind === "custom") {
      const parsed = parseCustomPrompt(input.customPrompt);
      if (!parsed.ok) throw new UserFacingError(parsed.code, parsed.params);
      customPrompt = parsed.text;
    }

    // 178 (PR 4, FR-030..FR-033): phạm vi nguồn kiểm TƯỜNG MINH trước mọi đọc chunk / gọi AI — id không thuộc notebook /
    // chưa ready / > 50 ⇒ từ chối cả lượt. `sourceIds` thắng `sourceId` (025); rỗng ⇒ toàn bộ nguồn ready.
    const sources = deps.listSources(notebookId);
    const scope = resolveSourceScope(input, sources);
    if (!scope.ok) {
      throw new UserFacingError(
        scope.code,
        scope.code === "studioSourcesInvalid"
          ? { max: STUDIO_MAX_SOURCE_IDS }
          : undefined,
      );
    }

    // 233 (FR-003, D1, D2): documentDiff cần đúng 2 nguồn khác nhau trong sourceIds
    if (kind === "documentDiff") {
      if (!scope.ids || scope.ids.length !== 2) {
        throw new UserFacingError("studioDiffNeedTwoSources");
      }
    }

    let diffPair: DiffPairTitles | undefined;
    const groups: ScoredChunk[][] = [];
    let totalChunks = 0;

    // 233 (D3): với documentDiff, dựng groups theo đúng thứ tự vai trò [gốc, sửa đổi]
    if (kind === "documentDiff") {
      const [baseId, revisedId] = scope.ids!;
      const baseSource = sources.find((s) => s.id === baseId);
      const revisedSource = sources.find((s) => s.id === revisedId);
      if (!baseSource || !revisedSource) {
        throw new UserFacingError("studioSourcesInvalid", {
          max: STUDIO_MAX_SOURCE_IDS,
        });
      }
      diffPair = {
        baseTitle: baseSource.title,
        revisedTitle: revisedSource.title,
      };
      const baseChunks = deps
        .listChunks(baseSource.id)
        .map((chunk) => ({ chunk, sourceTitle: baseSource.title, score: 0 }));
      const revisedChunks = deps.listChunks(revisedSource.id).map((chunk) => ({
        chunk,
        sourceTitle: revisedSource.title,
        score: 0,
      }));

      // D2: mỗi nguồn trong cặp phải ready và có >= 1 chunk
      if (baseChunks.length === 0 || revisedChunks.length === 0) {
        throw new UserFacingError("studioDiffNeedTwoSources");
      }

      groups.push(baseChunks, revisedChunks);
      totalChunks = baseChunks.length + revisedChunks.length;
    } else {
      // Gom chunk theo NHÓM NGUỒN (mỗi nguồn 1 mảng, chunk theo ordinal). buildBalancedContext chia đều
      // ngân sách cho mọi nguồn (#65) → bản tóm tắt không thiên về 1 tài liệu.
      const inScope = scope.ids ? new Set(scope.ids) : null;
      for (const src of sources) {
        if (src.status !== "ready") continue;
        if (inScope && !inScope.has(src.id)) continue;
        const chunks = deps
          .listChunks(src.id)
          .map((chunk) => ({ chunk, sourceTitle: src.title, score: 0 }));
        if (chunks.length > 0) {
          groups.push(chunks);
          totalChunks += chunks.length;
        }
      }
      if (totalChunks === 0) {
        throw new UserFacingError(
          scope.ids ? "studioSourceNotReady" : "studioNoReadySources",
        );
      }
    }

    const ctx = deps.contextInfo
      ? await deps.contextInfo()
      : { budget: STUDIO_CONTEXT_BUDGET, numCtx: null };
    assertNotAborted(signal); // 149: sau khi lấy ngân sách
    const chatOpts =
      ctx.numCtx || signal
        ? {
            ...(ctx.numCtx ? { numCtx: ctx.numCtx } : {}),
            ...(signal ? { signal } : {}),
          }
        : undefined;
    const chat = (messages: ChatMessage[]): Promise<string> =>
      deps.chat(messages, chatOpts);
    // 178 (PR 4, FR-040): CHỈ lượt viết cuối stream (map / condense dùng `chat`). Không có onToken ⇒ y như `chat`.
    const streamToken = guardOnToken(onToken, signal);
    const writeChat = streamToken
      ? (messages: ChatMessage[]): Promise<string> =>
          deps.chat(messages, { ...chatOpts, onToken: streamToken })
      : chat;

    // Vừa ngân sách ⇒ 1 lượt như cũ. Vượt ⇒ map-reduce (ném nếu runtime chưa sẵn sàng → bubble lên, không bịa).
    // 233 (D3): với documentDiff, ghép tuần tự toàn bộ đoạn gốc trước, sửa đổi sau.
    const single =
      kind === "documentDiff"
        ? (() => {
            const { blocks, map } = numberAll(groups);
            return {
              contextText: blocks.map((b) => b.text).join("\n\n"),
              map,
            };
          })()
        : buildBalancedContext(groups, Number.POSITIVE_INFINITY);
    let raw: string;
    let map = single.map;
    let parts = 1;
    let truncated = false;
    if (single.contextText.length <= ctx.budget) {
      safeProgress(onProgress)({ phase: "writing" }); // 146: một lượt ⇒ chỉ pha viết (bất định)
      raw = await writeChat([
        { role: "system", content: systemPromptFor(kind, outputLanguage) },
        {
          role: "user",
          content: finalUserContent(
            kind,
            customPrompt,
            single.contextText,
            outputLanguage,
            diffPair,
          ),
        },
      ]);
    } else {
      const mr = await runMapReduce({
        kind,
        groups,
        budget: ctx.budget,
        chat,
        outputLanguage,
        onProgress,
        signal,
        customPrompt,
        writeChat,
        diffPair,
      });
      ({ raw, map, parts, truncated } = mr);
    }
    // 178 (PR 4, FR-042): nhánh stream bị huỷ TRẢ phần dở, KHÔNG ném (đã xác minh Ollama + OpenAI + Anthropic + Gemini) ⇒
    // chặn NGAY sau lượt viết, TRƯỚC hậu kiểm — lượt đã huỷ không bao giờ được hậu kiểm hay lưu.
    assertNotAborted(signal);
    const { answer, citations } = postprocessCitations(raw, map);

    if (answer.trim() === "") {
      throw new UserFacingError("studioEmptyOutput");
    }
    // Grounded fallback: có nội dung nhưng model không chèn [n] hợp lệ → gắn nguồn đã dùng (kiểm chứng được).
    const finalCitations =
      citations.length > 0 ? citations : citationsFromMap(map);

    assertNotAborted(signal); // 149: ngay trước khi lưu — lượt đã huỷ KHÔNG ghi DB
    // 178: mỗi lượt thành công = 1 phiên bản; parts / truncated / local (nhãn 098) lưu cùng phiên bản (G4).
    return deps.studioRepo.insert({
      notebookId,
      kind,
      content: answer,
      citations: finalCitations,
      parts,
      truncated,
      local: input.target === "local",
      ...(customPrompt !== undefined ? { customPrompt } : {}),
      ...(scope.ids ? { sourceIds: scope.ids } : {}),
    });
  }

  function list(notebookId: string): StudioResult[] {
    return deps.studioRepo.listByNotebook(notebookId);
  }

  /** 178: xoá một phiên bản — tham số từ renderer (không tin) ⇒ kiểm chuỗi không rỗng; repo chỉ xoá khi khớp notebook. */
  function deleteVersion(
    notebookId: unknown,
    id: unknown,
  ): { deleted: boolean } {
    if (
      typeof notebookId !== "string" ||
      notebookId === "" ||
      typeof id !== "string" ||
      id === ""
    ) {
      return { deleted: false };
    }
    return { deleted: deps.studioRepo.deleteVersion(notebookId, id) };
  }

  return { generate, list, deleteVersion };
}

export type StudioService = ReturnType<typeof createStudioService>;
