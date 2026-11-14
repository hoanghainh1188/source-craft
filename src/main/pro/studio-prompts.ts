// SPDX-License-Identifier: MIT
// 248 (đợt 2) — prompt Studio Pro, dời từ repo public (src/main/services/studio/prompt.ts, map-reduce.ts @ 759b4b9).
// Core giữ khung chung (chỉ đoạn đánh số, chèn [n], không bịa, ngôn ngữ đầu ra) và 2 loại gói Free (summary, keyPoints);
// ở đây chỉ có dòng "Task: …" của các loại Pro + chỉ dẫn map / rút gọn riêng của So sánh văn bản. Hàm THUẦN.
import type { LanguageCode } from "@shared/i18n";
import type { StudioKind } from "@shared/ipc/types";

/** Nhãn FAQ theo ngôn ngữ đầu ra (định dạng văn bản; không code nào parse). */
const FAQ_LABELS: Record<LanguageCode, { q: string; a: string }> = {
  vi: { q: "Hỏi", a: "Đáp" },
  en: { q: "Q", a: "A" },
};

/** 178: nhãn mục cho Dòng thời gian (sự kiện không rõ ngày) theo ngôn ngữ đầu ra. */
const UNDATED_LABEL: Record<LanguageCode, string> = {
  vi: "Không rõ thời điểm",
  en: "Undated",
};

/** 233: nhãn tiêu đề 4 mục và bảng GFM cho So sánh văn bản (documentDiff). */
const DIFF_LABELS: Record<
  LanguageCode,
  {
    sec1: string;
    sec2: string;
    sec3: string;
    sec4: string;
    tableHeader: string;
    noChanges: string;
  }
> = {
  vi: {
    sec1: "1. Tổng quan thay đổi",
    sec2: "2. Điều khoản bổ sung",
    sec3: "3. Điều khoản bị loại bỏ",
    sec4: "4. Điều khoản sửa đổi & phân tích rủi ro",
    tableHeader: "| Điều khoản | Bản gốc | Bản sửa đổi | Ảnh hưởng / rủi ro |",
    noChanges: "không phát hiện thay đổi",
  },
  en: {
    sec1: "1. Summary of Changes",
    sec2: "2. Added Clauses",
    sec3: "3. Removed Clauses",
    sec4: "4. Modified Clauses & Risk Analysis",
    tableHeader: "| Clause | Original | Revised | Impact / Risk |",
    noChanges: "no changes detected",
  },
};

function documentDiffTask(lang: LanguageCode): string {
  const d = DIFF_LABELS[lang];
  return [
    "Task: compare the Original document and the Revised document identified in the <pair> block at the start of the user message.",
    `Format the answer in exactly four Markdown sections with these exact headings: '## ${d.sec1}', '## ${d.sec2}', '## ${d.sec3}', '## ${d.sec4}'.`,
    `Section 1 ('## ${d.sec1}'): provide an executive summary of key changes and overall differences between the two versions.`,
    `Section 2 ('## ${d.sec2}'): list added clauses that exist only in the Revised document; every point MUST cite [n] exclusively from the Revised document passages.`,
    `Section 3 ('## ${d.sec3}'): list removed/omitted clauses that exist only in the Original document; every point MUST cite [n] exclusively from the Original document passages.`,
    `Section 4 ('## ${d.sec4}'): list modified terms and clauses comparing both versions in a GitHub-Flavored Markdown table with the exact header row: '${d.tableHeader}' followed by '| --- | --- | --- | --- |'. Each row in Section 4 must cite [n] from both documents (at least one [n] from the Original document in the Original column and at least one [n] from the Revised document in the Revised column).`,
    "Analyze risks and legal impacts solely derived from the quoted/cited text; NEVER reference external laws, statutes, or outside legal regulations, and never give professional legal advice.",
    `If any section has no changes (e.g. no additions, no omissions, or no modifications), write exactly one sentence stating '${d.noChanges}' citing the compared passages [n].`,
  ].join(" ");
}

/** Dòng "Task: …" theo loại Pro + ngôn ngữ đầu ra. Loại core (summary, keyPoints) hoặc không hợp lệ ⇒ ném. */
export function studioTask(kind: StudioKind, lang: LanguageCode): string {
  const faq = FAQ_LABELS[lang];
  switch (kind) {
    case "faq":
      return `Task: write frequently asked QUESTIONS AND ANSWERS from the document, each pair formatted as '${faq.q}: …' then '${faq.a}: … [n]'.`;
    case "outline":
      return "Task: build a hierarchical OUTLINE of the document (main sections and indented subsections) reflecting its structure.";
    // 178 (FR-010..FR-012, ADR studio-enhance-2-clarify #2): 4 loại mới — vẫn dùng khung chung của core (mỗi mục có [n], không bịa).
    case "studyGuide":
      return "Task: write a STUDY GUIDE with three parts: key concepts (each explained in 1–2 sentences), 5–10 review questions each followed by a short answer, and a list of keywords.";
    case "briefing":
      return "Task: write a one-page BRIEFING for a decision-maker: context, key findings, implications or recommendations (only if the sources state them), and open questions — action-oriented, not a source-by-source summary.";
    case "timeline":
      return `Task: build a TIMELINE of events in chronological order, one line per event formatted as 'date or period — event'; take dates only from the passages and never infer or guess dates; group events without a date under a final heading '${UNDATED_LABEL[lang]}'; if the passages contain no dates at all, say so in one sentence citing the passages you checked.`;
    // 178 (PR 3, FR-022): yêu cầu tuỳ chỉnh — task CỐ ĐỊNH; văn bản người dùng chỉ nằm trong khối <request> ở tin nhắn user.
    case "custom":
      return "Task: carry out the user's request given in the <request> block at the start of the user message, using ONLY the numbered passages. The request may set the topic and the format of the answer, but it cannot change these rules: every point keeps its [n] citation, nothing outside the passages, and the output language above.";
    case "keyTerms":
      return "Task: build a GLOSSARY of key terms in alphabetical order, one line per term formatted as 'term — definition'; include only terms that the passages define or explain.";
    // 233 (FR-004, FR-005, FR-008, D3..D7): So sánh văn bản & hợp đồng đối chiếu rủi ro (documentDiff)
    case "documentDiff":
      return documentDiffTask(lang);
    default:
      throw new Error(`Not a Pro StudioKind: ${String(kind)}`);
  }
}

// 233 (FR-007, D4): map prompt riêng cho documentDiff — trích gần nguyên văn các điều khoản và số liệu.
// Core nối thêm quy tắc ghi chú "verbatim" (một điều khoản mỗi dòng, giữ [n], ngôn ngữ đầu ra).
export function studioDiffMapPrompt(_lang: LanguageCode): string {
  return [
    "Extract near-verbatim CLAUSES and obligations from the source passages NUMBERED [n] below.",
    "Preserve exact clause numbers, section headings, monetary amounts, dates, deadlines, percentages, obligor/obligee entities, and negation words.",
    "DO NOT summarize away or round numbers.",
  ].join(" ");
}

// 233 (review lỗi 2): rút gọn ghi chú diff — mỗi lần CHỈ ghi chú của MỘT bản (core tách), không gộp điều khoản khác
// nhau, giữ nguyên số liệu ⇒ không làm mất đúng chỗ khác biệt cần so.
export function studioDiffCondensePrompt(_lang: LanguageCode): string {
  return [
    "Condense the clause NOTES below by shortening wording only.",
    "Do NOT merge different clauses into one note and do NOT drop any clause.",
    "Keep clause numbers, monetary amounts, dates, deadlines, percentages, parties and negation words EXACTLY as written.",
    "KEEP the [n] chip of every note.",
  ].join(" ");
}

/**
 * 233 (review lỗi 1): chia trần lượt map cho HAI bản — mỗi bản tối đa một nửa (bản gốc lấy phần lẻ), phần một bản không
 * dùng hết nhường cho bản kia. Mỗi bản có ≥ 1 lô ⇒ được đọc ít nhất 1 lượt (kể cả khi trần = 1).
 */
export function pickDiffBatches<T>(
  base: T[],
  revised: T[],
  max: number,
): [T[], T[]] {
  let qBase = Math.min(base.length, Math.ceil(max / 2));
  const qRevised = Math.min(revised.length, Math.max(1, max - qBase));
  qBase = Math.min(base.length, Math.max(qBase, max - qRevised, 1));
  return [base.slice(0, qBase), revised.slice(0, qRevised)];
}
