import type { RagMode, DomainMode } from "@shared/ipc/types";
import type { LanguageCode } from "@shared/i18n";

// System prompt 2 chế độ và 3 domain (ADR retrieval-strategy §3, Issue #238). Hàm THUẦN. KHÔNG log nội dung (Constitution III).
// 123 (FR-017, FR-019, research R8): một bản lời nhắc ENGLISH + chỉ dẫn ngôn ngữ đầu ra theo câu hỏi. "Không tìm
// thấy" do app quyết theo cấu trúc (không [n] hợp lệ ⇒ notFound) — không bắt model trả câu nguyên văn.

const LANGUAGE_NAME: Record<LanguageCode, string> = {
  vi: "Vietnamese",
  en: "English",
};

/** Luôn dặn trả lời theo ngôn ngữ câu hỏi cuối; chỉ định rõ khi đã nhận diện chắc chắn (vi/en). */
export function languageDirective(lang?: LanguageCode): string {
  const base =
    "Write the answer in the same language as the user's last question.";
  return lang
    ? `${base} The question is in ${LANGUAGE_NAME[lang]}, so answer in ${LANGUAGE_NAME[lang]}.`
    : base;
}

/**
 * Chỉ dẫn khi nguồn không có câu trả lời. Đo 123 (specs/…/eval-llm-after.md, qwen2.5:7b): với câu hỏi TIẾNG VIỆT, bắt
 * trả đúng câu cố định "Không tìm thấy trong nguồn." (như lời nhắc cũ) giữ tỉ lệ từ chối đúng; với câu hỏi English/không
 * rõ (thường hỏi xuyên ngôn ngữ trên nguồn tiếng Việt), câu cố định làm model từ chối nhầm câu CÓ đáp án ⇒ dùng chỉ dẫn
 * mềm. App vẫn quyết "không tìm thấy" theo cấu trúc (không [n] hợp lệ) — đây chỉ là dẫn hướng model.
 */
export const NOT_FOUND_REPLY_VI = "Không tìm thấy trong nguồn.";

export const MEDICAL_DISCLAIMER_VI =
  "Thông tin trên chỉ mang tính chất tham khảo y khoa từ tài liệu nạp, không thay thế chẩn đoán hoặc chỉ định trực tiếp từ bác sĩ chuyên khoa.";
export const MEDICAL_DISCLAIMER_EN =
  "The information provided is for medical reference from ingested documents only and does not replace professional clinical diagnosis or medical advice.";

function notFoundInstruction(lang?: LanguageCode): string {
  return lang === "vi"
    ? `If the passages do not contain the answer, reply with exactly one sentence: "${NOT_FOUND_REPLY_VI}" — with NO [n] and nothing else.`
    : "If the passages do not contain the answer, say briefly that the sources do not contain it, without any [n].";
}

function sources(contextText: string): string[] {
  return [
    "",
    "--- SOURCE PASSAGES ---",
    contextText,
    "--- END OF SOURCE PASSAGES ---",
  ];
}

/**
 * Chỉ dẫn chuyên ngành cho Pháp lý (legal) và Y tế (medical).
 * Gói Pro/Enterprise: áp dụng personas chuyên sâu và grounding khắt khe.
 */
export function domainDirectives(
  domainMode?: DomainMode,
  lang?: LanguageCode,
): string[] {
  if (domainMode === "legal") {
    const isVi = lang === "vi";
    const citationExamples = isVi
      ? "(e.g. 'Điều', 'Khoản', 'Điểm' or 'Article', 'Section', 'Clause')"
      : "(e.g. 'Article', 'Section', 'Clause', 'Item')";
    const distinction = isVi
      ? "Clearly distinguish between obligations ('phải', 'bắt buộc', 'shall', 'must'), entitlements/rights ('được quyền', 'có quyền', 'may', 'entitled to'), and prohibitions ('không được', 'nghiêm cấm', 'shall not', 'prohibited')."
      : "Clearly distinguish between obligations ('shall', 'must', 'required to'), entitlements/rights ('may', 'entitled to', 'permitted'), and prohibitions ('shall not', 'prohibited', 'must not').";

    return [
      "SPECIALIST ROLE: You are a specialized Legal and Contract AI assistant operating under strict statutory and contractual grounding.",
      `LEGAL CITATION REQUIREMENT: Whenever referencing laws, regulations, or agreements, you must explicitly cite specific articles, clauses, and points ${citationExamples} if present in the source passages.`,
      `STRICT LEGAL GROUNDING: ${distinction}`,
      "ZERO EXTRAPOLATION: If the source passages do not explicitly specify a legal term, obligation, or consequence, state that the documents do not specify it. Do not infer or assume legal intent.",
    ];
  }

  if (domainMode === "medical") {
    const disclaimer =
      lang === "vi" ? MEDICAL_DISCLAIMER_VI : MEDICAL_DISCLAIMER_EN;
    return [
      "SPECIALIST ROLE: You are a specialized Medical and Clinical Knowledge AI assistant operating under evidence-based clinical grounding.",
      "CLINICAL GROUNDING: Rigorously cite source passages for clinical facts, symptoms, contraindications, dosages, and treatment guidelines. Never fabricate medical advice or extrapolate beyond documented evidence.",
      `MANDATORY CLINICAL DISCLAIMER: You MUST conclude your response with this exact disclaimer on a new line at the very end:\n"${disclaimer}"`,
    ];
  }

  return [];
}

/** Chế độ Theo nguồn: chỉ dùng context, chèn [n], thiếu căn cứ ⇒ nói ngắn là nguồn không có, cấm bịa. */
export function groundedSystemPrompt(
  contextText: string,
  outputLanguage?: LanguageCode,
  domainMode?: DomainMode,
): string {
  const domainLines = domainDirectives(domainMode, outputLanguage);
  return [
    "You are an assistant that answers ONLY from the numbered source passages [n] below.",
    ...domainLines,
    "Whenever you use information from a passage, put its [n] right after that point — INCLUDING in summaries (every summarized point must carry the [n] of its passage).",
    notFoundInstruction(outputLanguage),
    "Never use knowledge outside these passages. Do not make anything up.",
    languageDirective(outputLanguage),
    ...sources(contextText),
  ].join("\n");
}

/** Chế độ Mở rộng: ưu tiên context (chèn [n]); phần ngoài nguồn gắn nhãn "ngoài nguồn" theo ngôn ngữ câu trả lời. */
export function openSystemPrompt(
  contextText: string,
  outputLanguage?: LanguageCode,
  domainMode?: DomainMode,
): string {
  const domainLines = domainDirectives(domainMode, outputLanguage);
  return [
    "You are an assistant that answers questions. Prefer answering from the numbered source passages [n] below and put [n] after information taken from them.",
    ...domainLines,
    'If you need general knowledge OUTSIDE the passages, you may use it, but mark that part clearly with a short note such as "(not based on sources)", written in the language of your answer (for example "(không dựa trên nguồn)" in Vietnamese), and do NOT put [n] on that part.',
    languageDirective(outputLanguage),
    ...sources(contextText),
  ].join("\n");
}

export function systemPromptFor(
  mode: RagMode,
  contextText: string,
  outputLanguage?: LanguageCode,
  domainMode?: DomainMode,
): string {
  return mode === "grounded"
    ? groundedSystemPrompt(contextText, outputLanguage, domainMode)
    : openSystemPrompt(contextText, outputLanguage, domainMode);
}
