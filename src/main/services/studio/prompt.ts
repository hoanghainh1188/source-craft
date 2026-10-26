import type { StudioKind } from "@shared/ipc/types";
import type { LanguageCode } from "@shared/i18n";
import * as pro from "../../pro";
import { STUDIO_ALL_KINDS } from "./constants";
import { neutralizeRequestTags } from "./custom-prompt";

// System prompt cho Studio (ADR 2026-07-11-studio-context-strategy). Hàm THUẦN — test tất định.
// Khung chung ép: chỉ dùng đoạn ĐÁNH SỐ, chèn [n], KHÔNG bịa (Constitution II — kiểm chứng được; nội dung luôn truy
// được về chunk thật qua [n]). 123 (FR-018, FR-019): lời nhắc English; ngôn ngữ đầu ra = ngôn ngữ giao diện lúc tạo.

export const OUTPUT_LANGUAGE_NAME: Record<LanguageCode, string> = {
  vi: "Vietnamese",
  en: "English",
};

/** 233: nhãn vai trò gắn vào ghi chú gửi cho model ở bước viết cuối của documentDiff. */
export const DIFF_ROLE_LABELS: Record<
  LanguageCode,
  { base: string; revised: string }
> = {
  vi: { base: "Bản gốc", revised: "Bản sửa đổi" },
  en: { base: "Original", revised: "Revised" },
};

/**
 * 233: vô hiệu hoá thẻ <pair> trong văn bản (tiêu đề file hoặc nội dung nguồn) để tránh đóng/mở khối giả.
 */
export function neutralizePairTags(text: string): string {
  return text.replace(
    /<\s*(\/?)\s*pair\b[^>]*>/gi,
    (_m, slash: string) => `[${slash}pair]`,
  );
}

export function outputLanguageLine(lang: LanguageCode): string {
  return `Write in ${OUTPUT_LANGUAGE_NAME[lang]}, clearly and concisely.`;
}

/**
 * Nhắc lại ngôn ngữ đầu ra ở CUỐI system prompt và cuối tin người dùng: nguồn khác ngôn ngữ giao diện ⇒ model cục bộ nhỏ
 * hay viết theo ngôn ngữ nguồn khi chỉ dẫn nằm giữa đoạn (quickstart 123: Tóm tắt ra tiếng Việt khi giao diện English).
 */
export function languageReminder(lang: LanguageCode): string {
  return `Write your entire answer in ${OUTPUT_LANGUAGE_NAME[lang]}, even if the source passages are in another language.`;
}

function common(lang: LanguageCode): string {
  return [
    "You are an assistant that synthesizes documents. Below are source passages NUMBERED [1], [2], …",
    "Use only the information in those passages; NEVER make anything up or add outside knowledge.",
    "REQUIRED: every point/sentence must end with at least one matching citation chip [n] (n is the passage number); a sentence WITHOUT [n] is invalid. Example: 'The document lists three main goals [2].'",
    "Cover ALL source passages (every document) in a balanced way — do NOT focus only on the first or last few passages.",
    outputLanguageLine(lang),
  ].join(" ");
}

// 248 (đợt 2, Q4): core chỉ giữ nhiệm vụ của 2 loại gói Free; các loại khác (faq, outline, studyGuide, briefing,
// timeline, keyTerms, custom, documentDiff) do module Pro trả — bản stub ném ProUnavailableError.
const CORE_TASKS: Partial<Record<StudioKind, string>> = {
  summary:
    "Task: write a concise SUMMARY of the whole document in a few paragraphs/bullet points covering the main content.",
  keyPoints:
    "Task: list the KEY POINTS as a bulleted list, one point per line starting with '- '.",
};

/** Loại Studio cần module Pro (mọi loại hợp lệ trừ summary, keyPoints). */
export function isProStudioKind(kind: StudioKind): boolean {
  return CORE_TASKS[kind] === undefined;
}

/** 248: bản build không có module Pro ⇒ loại Pro bị từ chối TRƯỚC mọi đọc nguồn / gọi AI. */
export function assertStudioKindAvailable(
  kind: StudioKind,
  lang: LanguageCode,
): void {
  if (isProStudioKind(kind) && !pro.available()) throw pro.unavailable(lang);
}

function task(kind: StudioKind, lang: LanguageCode): string | undefined {
  if (!(STUDIO_ALL_KINDS as readonly string[]).includes(kind)) return undefined;
  return CORE_TASKS[kind] ?? pro.studioTask(kind, lang);
}

/** Trả system prompt theo loại + ngôn ngữ đầu ra. Ném nếu kind không hợp lệ (biên hệ thống). */
export function systemPromptFor(
  kind: StudioKind,
  outputLanguage: LanguageCode = "vi",
): string {
  const t = task(kind, outputLanguage);
  if (!t) {
    throw new Error(`Invalid StudioKind: ${String(kind)}`);
  }
  return `${common(outputLanguage)}\n\n${t}\n${languageReminder(outputLanguage)}`;
}

/** 233: tên file trong khối <pair> — trung hoà thẻ + gộp mọi khoảng trắng / xuống dòng (không giả được dòng "Revised:"). */
function pairTitle(title: string): string {
  return neutralizePairTags(neutralizeRequestTags(title))
    .replace(/\s+/g, " ")
    .trim();
}

export interface DiffPairTitles {
  baseTitle: string;
  revisedTitle: string;
}

/**
 * 178 (FR-022) / 233 (FR-006): nội dung tin nhắn user của LƯỢT VIẾT CUỐI.
 * - `documentDiff` ⇒ khối `<pair>` (tên gốc / sửa đổi đã trung hoà thẻ) đứng trước đoạn nguồn.
 * - `custom` ⇒ khối `<request>` (yêu cầu đã qua parseCustomPrompt) đứng trước đoạn nguồn.
 * - loại khác ⇒ như cũ (bỏ qua `request` và `pair`). Văn bản người dùng KHÔNG BAO GIỜ vào system prompt.
 */
export function finalUserContent(
  kind: StudioKind,
  request: string | undefined,
  body: string,
  lang: LanguageCode,
  pair?: DiffPairTitles,
): string {
  if (kind === "documentDiff" && pair) {
    const cleanBase = pairTitle(pair.baseTitle);
    const cleanRevised = pairTitle(pair.revisedTitle);
    const pairBlock = `<pair>\nOriginal: ${cleanBase}\nRevised: ${cleanRevised}\n</pair>`;
    const cleanBody = neutralizePairTags(body);
    return `${pairBlock}\n\n${cleanBody}\n\n${languageReminder(lang)}`;
  }
  if (kind !== "custom" || !request) {
    return `${body}\n\n${languageReminder(lang)}`;
  }
  // Đoạn nguồn (có thể từ tài liệu độc hại) cũng không được giả thẻ <request> (indirect injection).
  return `<request>\n${request}\n</request>\n\n${neutralizeRequestTags(body)}\n\n${languageReminder(lang)}`;
}
