// Hằng số Studio (ADR 2026-07-11-studio-context-strategy). Một nơi duy nhất — dễ tinh chỉnh.

// Ngân sách ký tự MẶC ĐỊNH ghép ngữ cảnh tổng hợp toàn notebook — dùng khi KHÔNG đọc được cửa sổ ngữ cảnh của
// model. 105 (ADR studio-large-clarify): ngân sách thật tính theo cửa sổ model (context-window.ts) + num_ctx tường
// minh; vượt thì map-reduce với [n] toàn cục (map-reduce.ts) — chip vẫn trỏ đúng đoạn.
export const STUDIO_CONTEXT_BUDGET = 16000;

// Các loại tổng hợp sinh được (khác nhau ở system prompt, chung kiến trúc), theo thứ tự hiển thị. 178: + 4 loại mới.
export const STUDIO_KINDS = [
  "summary",
  "keyPoints",
  "faq",
  "outline",
  "studyGuide",
  "briefing",
  "timeline",
  "keyTerms",
  "documentDiff",
] as const;

// 178: mọi giá trị `kind` DB chấp nhận (khớp CHECK của migration v11) — mở sẵn cho 4 loại mới + yêu cầu tuỳ chỉnh để
// không cần migration thứ hai; loại hiển thị/sinh được vẫn là STUDIO_KINDS.
export const STUDIO_ALL_KINDS = [
  "summary",
  "keyPoints",
  "faq",
  "outline",
  "studyGuide",
  "briefing",
  "timeline",
  "keyTerms",
  "custom",
  "documentDiff",
] as const;

// 178: trần phiên bản dùng chung main + renderer.
export { STUDIO_MAX_VERSIONS } from "@shared/studio-versions";
