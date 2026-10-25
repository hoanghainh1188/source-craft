import { UserFacingError } from "@shared/codes/user-error";
import type {
  ChatMessage,
  StudioKind,
  StudioProgressEvent,
} from "@shared/ipc/types";
import type { RetrievedChunk, ScoredChunk } from "../rag/rag-types";
import { citationBlock } from "../rag/context-builder";
import { postprocessCitations } from "../rag/citation";
import {
  DIFF_ROLE_LABELS,
  finalUserContent,
  languageReminder,
  outputLanguageLine,
  systemPromptFor,
  type DiffPairTitles,
} from "./prompt";
import type { LanguageCode } from "@shared/i18n";
import {
  ChatAbortedError,
  assertNotAborted,
  isChatAborted,
} from "../ai-runtime/abort";

// 105 — map-reduce cho notebook vượt ngân sách, GIỮ chip [n] tới ĐÚNG ĐOẠN (ADR 2026-10-07-studio-large-clarify).
// Khác phương án đã bác (2026-07-11-studio-mapreduce-citation — citation mức NGUỒN): ở đây mọi đoạn được đánh số
// TOÀN CỤC [1..N] trước; ghi chú từng lô kèm [n] (hậu kiểm theo BẢNG CỦA LÔ — gỡ số không thuộc lô); bước cuối
// giữ nguyên [n] và hậu kiểm theo bảng toàn cục ⇒ chip trỏ đoạn thật. KHÔNG log nội dung.

export const MAX_MAP_CALLS = 12;
/** Số vòng rút gọn ghi chú tối đa trước bước cuối (chặn vòng lặp vô hạn khi model không rút gọn). */
const MAX_CONDENSE_ROUNDS = 3;

export interface NumberedBlock {
  n: number;
  text: string;
}

type Chat = (messages: ChatMessage[]) => Promise<string>;

/** 146: một bước tiến độ (caller gắn generationId/notebookId/kind trước khi gửi). */
export type StudioProgressStep = Pick<
  StudioProgressEvent,
  "phase" | "index" | "total"
>;
export type OnStudioProgress = (step: StudioProgressStep) => void;

/** 146: gọi callback tiến độ an toàn — lỗi (vd cửa sổ đã đóng) KHÔNG làm hỏng lượt tạo. */
export function safeProgress(
  onProgress: OnStudioProgress | undefined,
): OnStudioProgress {
  return (step) => {
    try {
      onProgress?.(step);
    } catch {
      // nuốt — tiến độ chỉ là phụ
    }
  };
}

// 123 (FR-018, FR-019): lời nhắc English; MỌI bước dùng cùng ngôn ngữ đầu ra (ngôn ngữ giao diện lúc tạo).
// 233 (review lỗi 5): "verbatim" cho documentDiff — ghi chú là trích dẫn gần nguyên văn, không ép "short".
const notesRules = (
  lang: LanguageCode,
  style: "short" | "verbatim" = "short",
): string =>
  [
    style === "short"
      ? "One note per line starting with '- ', short, ENDING with the [n] chip of the passage that contains the point."
      : "One clause per note, one note per line starting with '- ', ENDING with the [n] chip of the passage that contains the clause.",
    "Use EXACTLY the [n] numbers given (do not create or change numbers).",
    "Use only the information in the given passages; NEVER make anything up.",
    outputLanguageLine(lang),
  ].join(" ");

const mapPrompt = (lang: LanguageCode): string =>
  `Extract NOTES of the main points from the source passages NUMBERED [n] below. ${notesRules(lang)}`;

// 233 (FR-007, D4): map prompt riêng cho documentDiff — trích gần nguyên văn các điều khoản và số liệu
const mapPromptDiff = (lang: LanguageCode): string =>
  [
    "Extract near-verbatim CLAUSES and obligations from the source passages NUMBERED [n] below.",
    "Preserve exact clause numbers, section headings, monetary amounts, dates, deadlines, percentages, obligor/obligee entities, and negation words.",
    "DO NOT summarize away or round numbers.",
    notesRules(lang, "verbatim"),
  ].join(" ");

const condensePrompt = (lang: LanguageCode): string =>
  `Condense the NOTES below: merge duplicate points, drop minor details, KEEP the [n] chip of every point. ${notesRules(lang)}`;

// 233 (review lỗi 2): rút gọn ghi chú diff — mỗi lần CHỈ ghi chú của MỘT bản (caller tách), không gộp điều khoản khác
// nhau, giữ nguyên số liệu ⇒ không làm mất đúng chỗ khác biệt cần so.
const condensePromptDiff = (lang: LanguageCode): string =>
  [
    "Condense the clause NOTES below by shortening wording only.",
    "Do NOT merge different clauses into one note and do NOT drop any clause.",
    "Keep clause numbers, monetary amounts, dates, deadlines, percentages, parties and negation words EXACTLY as written.",
    "KEEP the [n] chip of every note.",
    notesRules(lang, "verbatim"),
  ].join(" ");
const FROM_NOTES =
  "NOTE: the input is NOTES already synthesized from many parts of the document; each note carries [n] chips pointing to the ORIGINAL source passages. When writing, KEEP the [n] chips of the points you use — do NOT create new numbers.";

/** Đánh số [n] TOÀN CỤC cho mọi đoạn (theo nguồn → thứ tự đọc) + bảng n → đoạn thật. */
export function numberAll(groups: ScoredChunk[][]): {
  blocks: NumberedBlock[];
  map: Map<number, RetrievedChunk>;
} {
  const blocks: NumberedBlock[] = [];
  const map = new Map<number, RetrievedChunk>();
  let n = 0;
  for (const group of groups) {
    for (const sc of group) {
      n += 1;
      map.set(n, { ...sc, n });
      blocks.push({ n, text: citationBlock(n, sc) });
    }
  }
  return { blocks, map };
}

/** Gom tham lam các khối vào lô ≤ budget ký tự (khối quá khổ đứng riêng — KHÔNG cắt giữa đoạn). */
export function packBatches<T extends { text: string }>(
  items: T[],
  budget: number,
): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let used = 0;
  for (const it of items) {
    const len = it.text.length + 2;
    if (cur.length > 0 && used + len > budget) {
      batches.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(it);
    used += len;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

const joined = (items: { text: string }[]): string =>
  items.map((i) => i.text).join("\n\n");

/** Bảng con: chỉ các n THỰC SỰ có mặt trong `text` (đầu vào của bước đó). */
function subsetIn(
  text: string,
  map: Map<number, RetrievedChunk>,
): Map<number, RetrievedChunk> {
  const out = new Map<number, RetrievedChunk>();
  for (const m of text.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    const rc = map.get(n);
    if (rc) out.set(n, rc);
  }
  return out;
}

/** Ghi chú → chỉ giữ dòng có ít nhất 1 [n] hợp lệ theo `allowed` (gỡ số bịa / ngoài đầu vào của bước). */
function cleanNotes(
  raw: string,
  allowed: Map<number, RetrievedChunk>,
): string[] {
  const { answer } = postprocessCitations(raw, allowed);
  return answer
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /\[\d+\]/.test(l));
}

/** Gom ghi chú tham lam cho vừa ngân sách (phần dư bị bỏ ⇒ caller đánh dấu truncated). */
function fitNotes(notes: string[], budget: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const n of notes) {
    if (used + n.length + 1 > budget) break;
    out.push(n);
    used += n.length + 1;
  }
  return out;
}

/**
 * Rút gọn ghi chú theo lô tới khi vừa ngân sách (tối đa MAX_CONDENSE_ROUNDS vòng). Mỗi lô chỉ chấp nhận [n] CÓ
 * trong ghi chú đầu vào của lô đó. Vẫn quá dài sau các vòng ⇒ cắt cho vừa và báo `cut`.
 */
async function condense(
  notes: string[],
  budget: number,
  map: Map<number, RetrievedChunk>,
  chat: Chat,
  lang: LanguageCode,
  progress: OnStudioProgress,
  signal?: AbortSignal,
  prompt: (lang: LanguageCode) => string = condensePrompt,
): Promise<{ notes: string[]; cut: boolean }> {
  const size = (ns: string[]): number => ns.join("\n").length;
  let cur = notes;
  for (
    let round = 0;
    round < MAX_CONDENSE_ROUNDS && size(cur) > budget;
    round += 1
  ) {
    if (round === 0) progress({ phase: "condensing" }); // 146: một lần, chỉ khi thật sự có vòng rút gọn
    const next: string[] = [];
    for (const batch of packBatches(
      cur.map((text) => ({ text })),
      budget,
    )) {
      assertNotAborted(signal); // 149: mỗi lô rút gọn
      const input = batch.map((b) => b.text).join("\n");
      const raw = await chat([
        { role: "system", content: prompt(lang) },
        { role: "user", content: `${input}\n\n${languageReminder(lang)}` },
      ]);
      next.push(...cleanNotes(raw, subsetIn(input, map)));
    }
    if (next.length === 0) break; // model trả rỗng ⇒ giữ ghi chú cũ (không mất nội dung)
    cur = next;
  }
  if (size(cur) <= budget) return { notes: cur, cut: false };
  return { notes: fitNotes(cur, budget), cut: true };
}

export interface MapReduceInput {
  kind: StudioKind;
  groups: ScoredChunk[][];
  /** Ngân sách ký tự mỗi lượt (theo cửa sổ ngữ cảnh của model). */
  budget: number;
  chat: Chat;
  maxMapCalls?: number;
  /** 123: ngôn ngữ đầu ra cho mọi bước (mặc định vi). */
  outputLanguage?: LanguageCode;
  /** 146: tiến độ — reading i/N · condensing · writing. Không ảnh hưởng kết quả. */
  onProgress?: OnStudioProgress;
  /** 149: huỷ — kiểm ở ranh giới bước + trong vòng thử lại; huỷ ⇒ ChatAbortedError. Không ảnh hưởng kết quả khi không huỷ. */
  signal?: AbortSignal;
  /** 178 (PR 3): yêu cầu tuỳ chỉnh đã chuẩn hoá — CHỈ lượt viết cuối nhận (khối <request> ở tin user); map / condense trung lập. */
  customPrompt?: string;
  /**
   * 178 (PR 4, FR-040): chat cho LƯỢT VIẾT CUỐI (stream). Thiếu ⇒ dùng `chat`. Map / condense luôn dùng `chat` (không stream).
   * Nhánh stream bị huỷ TRẢ phần dở, KHÔNG ném ⇒ ngay sau lượt này phải `assertNotAborted`.
   */
  writeChat?: Chat;
  /** 233 (FR-006, D3): thông tin cặp so sánh [bản gốc, bản sửa đổi] cho khối <pair> ở bước cuối. */
  diffPair?: DiffPairTitles;
}

export interface MapReduceOutput {
  /** Câu trả lời thô của bước cuối (còn [n] — caller hậu kiểm bằng `map`). */
  raw: string;
  /** Bảng n → đoạn thật — CHỈ các đoạn có trong ghi chú đưa vào bước cuối (hậu kiểm + dự phòng citation). */
  map: Map<number, RetrievedChunk>;
  /** Số phần (lượt map) đã tổng hợp. */
  parts: number;
  /** true khi có phần tài liệu không được tổng hợp (vượt số lượt, lô không trích được, ghi chú bị cắt). */
  truncated: boolean;
}

type DiffRole = "base" | "revised";

interface BatchWithRole {
  items: NumberedBlock[];
  role?: DiffRole;
}

/**
 * 233 (review lỗi 1): chia trần lượt map cho HAI bản — mỗi bản tối đa một nửa (bản gốc lấy phần lẻ), phần một bản không
 * dùng hết nhường cho bản kia. Mỗi bản có ≥ 1 lô ⇒ được đọc ít nhất 1 lượt (kể cả khi trần = 1).
 */
function pickDiffBatches<T>(base: T[], revised: T[], max: number): [T[], T[]] {
  let qBase = Math.min(base.length, Math.ceil(max / 2));
  const qRevised = Math.min(revised.length, Math.max(1, max - qBase));
  qBase = Math.min(base.length, Math.max(qBase, max - qRevised, 1));
  return [base.slice(0, qBase), revised.slice(0, qRevised)];
}

export async function runMapReduce({
  kind,
  groups,
  budget,
  chat,
  maxMapCalls = MAX_MAP_CALLS,
  outputLanguage = "vi",
  onProgress,
  signal,
  customPrompt,
  writeChat = chat,
  diffPair,
}: MapReduceInput): Promise<MapReduceOutput> {
  // 149: không phát tiến độ sau khi đã huỷ.
  const report = safeProgress(onProgress);
  const progress: OnStudioProgress = (step) => {
    if (!signal?.aborted) report(step);
  };
  const { blocks, map } = numberAll(groups);

  // 233 (FR-007, D4): với documentDiff, đóng lô riêng theo từng nguồn để không trộn lẫn đoạn gốc và sửa đổi
  let allBatches: BatchWithRole[];
  let batches: BatchWithRole[];
  const isDiff = kind === "documentDiff" && groups.length === 2;
  if (isDiff) {
    const group0Count = groups[0].length;
    const group0Blocks = blocks.filter((b) => b.n <= group0Count);
    const group1Blocks = blocks.filter((b) => b.n > group0Count);
    const b0: BatchWithRole[] = packBatches(group0Blocks, budget).map(
      (items) => ({ items, role: "base" as const }),
    );
    const b1: BatchWithRole[] = packBatches(group1Blocks, budget).map(
      (items) => ({ items, role: "revised" as const }),
    );
    allBatches = [...b0, ...b1];
    const [p0, p1] = pickDiffBatches(b0, b1, maxMapCalls);
    batches = [...p0, ...p1];
  } else {
    allBatches = packBatches(blocks, budget).map((items) => ({ items }));
    batches = allBatches.slice(0, maxMapCalls);
  }

  const prompt = isDiff
    ? mapPromptDiff(outputLanguage)
    : mapPrompt(outputLanguage);

  let notes: string[] = [];
  // 233: ghi chú theo vai trò (chưa gắn nhãn) — rút gọn riêng từng bản rồi mới gắn nhãn.
  const roleNotes: Record<DiffRole, string[]> = { base: [], revised: [] };
  let emptyBatches = 0;
  for (const [i, batchObj] of batches.entries()) {
    assertNotAborted(signal); // 149: đầu mỗi phần
    // 146: một sự kiện mỗi phần, TRƯỚC lượt map đầu tiên (thử lại trong cùng phần không phát thêm).
    progress({ phase: "reading", index: i + 1, total: batches.length });
    const batch = batchObj.items;
    const input = joined(batch);
    const batchMap = new Map(
      batch.map((b) => [b.n, map.get(b.n)!] as [number, RetrievedChunk]),
    );
    const messages: ChatMessage[] = [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `${input}\n\n${languageReminder(outputLanguage)}`,
      },
    ];
    // Thử lại 1 lần khi lỗi tạm (Ollama vừa nạp lại…) hoặc ghi chú không có [n] hợp lệ — không mất cả lượt tạo.
    let got: string[] = [];
    for (let attempt = 0; attempt < 2 && got.length === 0; attempt += 1) {
      assertNotAborted(signal); // 149 review N5: cả khi chat trả về bình thường sau huỷ
      try {
        got = cleanNotes(await chat(messages), batchMap);
      } catch (e) {
        // 149: huỷ KHÔNG phải lỗi tạm — ném ngay, không gọi lần 2.
        if (isChatAborted(e) || signal?.aborted) throw new ChatAbortedError();
        if (attempt === 1) throw e;
      }
    }
    if (got.length === 0) emptyBatches += 1;
    if (batchObj.role) roleNotes[batchObj.role].push(...got);
    else notes.push(...got);
  }

  let condensedCut: boolean;
  if (isDiff) {
    // 233 (review lỗi 1): một bản không có ghi chú ⇒ so một phía sẽ báo sai "thêm / bỏ" hàng loạt — từ chối rõ.
    if (roleNotes.base.length === 0 || roleNotes.revised.length === 0) {
      throw new UserFacingError("studioNoNotes");
    }
    // 233 (review lỗi 2, D4): rút gọn TÁCH RIÊNG từng bản (mỗi bản nửa ngân sách), rồi mới gắn nhãn vai trò.
    const half = Math.floor(budget / 2);
    const labels = DIFF_ROLE_LABELS[outputLanguage];
    notes = [];
    condensedCut = false;
    for (const role of ["base", "revised"] as const) {
      const c = await condense(
        roleNotes[role],
        half,
        map,
        chat,
        outputLanguage,
        progress,
        signal,
        condensePromptDiff,
      );
      condensedCut ||= c.cut;
      notes.push(
        ...c.notes.map(
          (note) => `- [${labels[role]}] ${note.replace(/^- /, "")}`,
        ),
      );
    }
  } else {
    if (notes.length === 0) {
      // Không để bước cuối viết từ đầu vào rỗng (sẽ bịa) — báo rõ cho người dùng.
      throw new UserFacingError("studioNoNotes");
    }
    const condensed = await condense(
      notes,
      budget,
      map,
      chat,
      outputLanguage,
      progress,
      signal,
    );
    notes = condensed.notes;
    condensedCut = condensed.cut;
  }
  const finalInput = notes.join("\n");

  assertNotAborted(signal); // 149: trước bước viết
  progress({ phase: "writing" });
  const raw = await writeChat([
    {
      role: "system",
      content: `${systemPromptFor(kind, outputLanguage)}\n\n${FROM_NOTES}`,
    },
    {
      role: "user",
      content: finalUserContent(
        kind,
        customPrompt,
        finalInput,
        outputLanguage,
        diffPair,
      ),
    },
  ]);
  // 178 (PR 4): lượt viết có thể là stream — bị huỷ thì TRẢ phần dở (không ném) ⇒ chặn ngay, không trả kết quả dở.
  assertNotAborted(signal);

  return {
    raw,
    // Bước cuối CHỈ được trích các đoạn có trong ghi chú nó nhận — không phải mọi đoạn của notebook.
    map: subsetIn(finalInput, map),
    parts: batches.length,
    truncated:
      allBatches.length > batches.length || emptyBatches > 0 || condensedCut,
  };
}
