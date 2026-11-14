// SPDX-License-Identifier: MIT
// 248 (đợt 2) — chỉ dẫn chế độ chuyên gia (238), dời từ repo public (src/main/services/rag/prompt.ts @ 759b4b9).
// Core ghép các dòng này ngay sau dòng vai trò của system prompt hỏi đáp và tự gắn disclaimer y khoa (withMedicalDisclaimer).
// Hàm THUẦN. KHÔNG log nội dung (Constitution III).
import type { LanguageCode } from "@shared/i18n";
import type { DomainMode } from "@shared/ipc/types";

/** Chỉ dẫn Pháp lý (legal) / Y tế (medical); chế độ chung ⇒ không có dòng nào. */
export function domainDirectives(
  domainMode: DomainMode,
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
    // Disclaimer do app gắn cố định sau khi nhận câu trả lời (withMedicalDisclaimer) — không phó mặc cho model.
    return [
      "SPECIALIST ROLE: You are a specialized Medical and Clinical Knowledge AI assistant operating under evidence-based clinical grounding.",
      "CLINICAL GROUNDING: Rigorously cite source passages for clinical facts, symptoms, contraindications, dosages, and treatment guidelines. Never fabricate medical advice or extrapolate beyond documented evidence.",
      "Do NOT write a medical disclaimer yourself — the application appends one to your answer.",
    ];
  }

  return [];
}
