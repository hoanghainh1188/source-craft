import type { Citation } from "@shared/ipc/types";
import { createTranslator, type Translator } from "@shared/i18n";

// Định dạng hiển thị trích dẫn ở dòng "Nguồn:" (srcnote). Hàm thuần — unit-test được.
// 123: nhận translator HIỆN TẠI (mặc định tiếng Việt) — dùng cả cho Markdown Copy/Export.

const VI = createTranslator("vi");

/** Hậu tố " · trang X" nếu có số trang, ngược lại "". Dùng chung cho citation + kết quả tìm (073). */
export function pageSuffix(page: number | null, tr: Translator = VI): string {
  return page != null ? ` · ${tr.t("chat.page", { page })}` : "";
}

/** Nhãn 1 trích dẫn: "[n] Tên sổ tay › Tên nguồn · trang X" (hoặc "[n] Tên nguồn · trang X"). */
export function formatCitationLabel(c: Citation, tr: Translator = VI): string {
  const nbPrefix = c.notebookName ? `${c.notebookName} › ` : "";
  return `[${c.n}] ${nbPrefix}${c.sourceTitle}${pageSuffix(c.locator.page, tr)}`;
}

/** Danh sách nhãn nguồn (dedup theo n, sắp tăng dần — citations vốn đã dedup/sort ở main). */
export function citationLabels(
  citations: Citation[],
  tr: Translator = VI,
): string[] {
  return citations.map((c) => formatCitationLabel(c, tr));
}

/**
 * 072: gộp câu trả lời + danh sách nguồn thành markdown để Copy/Export (kiểm chứng được — kèm trang).
 * Hàm THUẦN. Không nguồn → chỉ nội dung. Có nguồn → thêm mục "Nguồn:" ngăn bằng đường kẻ.
 */
export function formatAnswerMarkdown(
  content: string,
  citations: Citation[],
  tr: Translator = VI,
): string {
  const body = content.trimEnd();
  if (citations.length === 0) return `${body}\n`;
  return `${body}\n\n---\n\n${tr.t("chat.sourcesLabel")}\n${citationLabels(citations, tr).join("\n")}\n`;
}
