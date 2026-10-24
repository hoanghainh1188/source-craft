import { detectQuestionLanguage } from "@shared/i18n";
import type {
  ChatMessage,
  Citation,
  RagAnswer,
  RagAskInput,
} from "@shared/ipc/types";
import type { ChatStreamOpts } from "../ai-runtime/provider";
import {
  validateHistory,
  validateMode,
  validateQuestion,
} from "./question-validation";
import { retrieve, type RetrievalDeps } from "./retrieval";
import type { RelevanceConfig } from "./relevance-filter";
import { buildContext } from "./context-builder";
import { systemPromptFor } from "./prompt";
import { postprocessCitations } from "./citation";
import {
  MAX_HISTORY_TURNS,
  NOT_FOUND_CONTENT,
  REINDEXING_CONTENT,
} from "./constants";

// Điều phối hỏi đáp (rag:ask). DI: retrieval deps + chat. KHÔNG log câu hỏi/nội dung (Constitution III).

export interface RagServiceDeps extends RetrievalDeps {
  /** Gọi LLM chat với messages[], trả nội dung câu trả lời (wrap LLMProvider.chat → content). */
  chat: (messages: ChatMessage[]) => Promise<string>;
  /** Bản streaming (039): gọi onToken mỗi delta, trả nội dung ĐẦY ĐỦ (hoặc phần đã nhận nếu huỷ). */
  chatStream: (
    messages: ChatMessage[],
    opts: ChatStreamOpts,
  ) => Promise<string>;
  /**
   * 059: notebook NÀY có đang tái lập chỉ mục (chưa nhúng đủ vector) không? true → trả thông báo "đang tái
   * lập chỉ mục" thay vì truy xuất trên vector chưa đầy đủ (FR-010). PER-NOTEBOOK (research R4): notebook
   * đã nhúng lại xong vẫn hỏi đáp được dù các notebook khác còn dở. Async vì cần đếm vector (LanceDB).
   * 231: null = tìm toàn cục → true nếu còn BẤT KỲ notebook nào chưa nhúng xong.
   */
  reindexing?: (notebookId: string | null) => Promise<boolean>;
  /**
   * 108: cấu hình bộ lọc độ liên quan cho retrieve(). Chỉ công cụ đo (tests/eval, phần LLM tham khảo) đặt; app để
   * trống ⇒ dùng RELEVANCE_CALIBRATION.config.
   */
  relevanceConfig?: RelevanceConfig;
  /** Lưu bền lượt hỏi–đáp (027-chat-history). Best-effort; KHÔNG log nội dung. */
  saveTurn?: (
    notebookId: string,
    userContent: string,
    assistant: {
      content: string;
      citations: RagAnswer["citations"];
      notFound: boolean;
      modeUsed: RagAnswer["modeUsed"];
    },
  ) => void;
}

// 231: bản sao trích dẫn kèm notebookId/notebookName của nguồn (không sửa mảng gốc). Thiếu tra cứu → giữ nguyên.
function withNotebookContext(
  citations: Citation[],
  sourceNotebook: RetrievalDeps["sourceNotebook"],
): Citation[] {
  if (!sourceNotebook) return citations;
  return citations.map((c) => {
    const nb = sourceNotebook(c.sourceId);
    if (!nb) return c;
    return {
      ...c,
      ...(nb.notebookId ? { notebookId: nb.notebookId } : {}),
      ...(nb.notebookName ? { notebookName: nb.notebookName } : {}),
    };
  });
}

// Mọi nhánh "không tìm thấy" ở chế độ theo nguồn trả CÙNG cờ notFound; câu hiển thị + gợi ý do giao diện dịch (123).
function notFoundResult(): RagAnswer {
  return {
    answer: NOT_FOUND_CONTENT,
    citations: [],
    notFound: true,
    modeUsed: "grounded",
  };
}

export function createRagService(deps: RagServiceDeps) {
  // Tính câu trả lời (không side-effect persist) — gom mọi nhánh return vào đây. chatFn cho phép tái dùng
  // cho non-stream (deps.chat) và stream (deps.chatStream + onToken) — 039.
  async function compute(
    input: RagAskInput,
    chatFn: (messages: ChatMessage[]) => Promise<string>,
  ): Promise<RagAnswer> {
    const question = validateQuestion(input.question);
    const mode = validateMode(input.mode);
    const history = validateHistory(input.history);

    const isAllScope = input.scope === "all";
    // 231: null = toàn cục (mọi sổ tay) cho cả guard reindex lẫn truy xuất.
    const scopeNotebookId = isAllScope ? null : input.notebookId;

    // 059: notebook này đang tái lập chỉ mục → vector chưa đầy đủ → báo thay vì trả sai/thiếu (FR-010).
    // Per-notebook: notebook khác đã xong vẫn hỏi đáp bình thường. Toàn cục (231): chặn khi còn notebook nào dở.
    if (deps.reindexing && (await deps.reindexing(scopeNotebookId))) {
      return {
        answer: REINDEXING_CONTENT,
        citations: [],
        notFound: false,
        modeUsed: mode,
        reindexing: true,
      };
    }

    // 055, 231: truyền history cho query rewriting và notebookId (null nếu tìm kiếm toàn cục đa sổ tay).
    const scored = await retrieve(
      question,
      scopeNotebookId,
      deps,
      history,
      deps.relevanceConfig,
    );

    // Grounded + không có căn cứ → "không tìm thấy" (không gọi model, không bịa).
    if (mode === "grounded" && scored.length === 0) return notFoundResult();

    const built = buildContext(scored);
    // 123 (FR-017): trả lời theo ngôn ngữ câu hỏi — chỉ định rõ khi nhận diện chắc chắn vi/en.
    const system = systemPromptFor(
      mode,
      built.contextText,
      detectQuestionLanguage(question),
    );
    const recent = history.slice(-MAX_HISTORY_TURNS);
    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...recent.map((t) => ({ role: t.role, content: t.content })),
      { role: "user", content: question },
    ];

    const raw = await chatFn(messages);
    const processed = postprocessCitations(raw, built.map);
    const answer = processed.answer;
    // 231: CHỈ khi tìm toàn cục mới gắn sổ tay vào trích dẫn (phân biệt nguồn giữa các sổ tay). Trong 1 sổ tay,
    // nhãn giữ nguyên "[n] Nguồn · trang X" như trước.
    const citations = isAllScope
      ? withNotebookContext(processed.citations, deps.sourceNotebook)
      : processed.citations;

    if (mode === "open") {
      return { answer, citations, notFound: false, modeUsed: "open" };
    }

    // Grounded — "luôn kèm nguồn / kiểm chứng được" (Constitution II). 108 (FR-015): không có [n] hợp lệ nào
    // ⇒ KHÔNG trình bày như có căn cứ (trước đây gắn mọi đoạn ngữ cảnh làm trích dẫn) → "không tìm thấy".
    if (citations.length > 0) {
      return { answer, citations, notFound: false, modeUsed: "grounded" };
    }
    return notFoundResult();
  }

  // Persist lượt (027) — best-effort: DB lỗi KHÔNG phá câu trả lời; KHÔNG log nội dung.
  function persist(input: RagAskInput, result: RagAnswer): void {
    if (!deps.saveTurn) return;
    // 059: KHÔNG lưu thông báo "đang tái lập chỉ mục" vào lịch sử (trạng thái tạm thời).
    if (result.reindexing) return;
    try {
      deps.saveTurn(input.notebookId, validateQuestion(input.question), {
        content: result.answer,
        citations: result.citations,
        notFound: result.notFound,
        modeUsed: result.modeUsed,
      });
    } catch {
      // bỏ qua lỗi persist (best-effort)
    }
  }

  return {
    async ask(input: RagAskInput): Promise<RagAnswer> {
      // deps.chat ném ở compute → ask ném TRƯỚC persist → không lưu lượt lỗi (đúng A2).
      const result = await compute(input, deps.chat);
      persist(input, result);
      return result;
    },

    /**
     * Bản streaming (039): stream token qua opts.onToken; huỷ (opts.signal) → giữ phần đã nhận (chatStream
     * trả phần đã nhận, KHÔNG ném) → hậu kiểm chip trên phần đó. Lưu câu trả lời CUỐI như thường.
     */
    async askStream(
      input: RagAskInput,
      opts: ChatStreamOpts,
    ): Promise<RagAnswer> {
      const result = await compute(input, (messages) =>
        deps.chatStream(messages, opts),
      );
      persist(input, result);
      return result;
    },
  };
}

export type RagService = ReturnType<typeof createRagService>;
