import { writeFile as fsWriteFile } from "node:fs/promises";
import { dialog, type BrowserWindow, type SaveDialogOptions } from "electron";
import type {
  ExportFormat,
  StudioExportInput,
  StudioExportResult,
} from "@shared/ipc/types";
import type { Translator } from "@shared/i18n";
import { sanitizeName } from "./export-name";
import { exportDialogFilters } from "../ui-language/dialog-texts";
import { generateDocx } from "./export/docx-generator";
import { generatePdf, markdownToHtml } from "./export/pdf-generator";

// 025, 232 — Xuất kết quả Studio ra .md, .docx hoặc .pdf. Ghi file CHỈ ở main qua hộp thoại lưu người dùng chủ động chọn
// (Constitution I/III — không tự ghi/gửi, không egress). KHÔNG log nội dung.

export interface ExportDeps {
  showSaveDialog?: (
    win: BrowserWindow | null,
    options: SaveDialogOptions,
  ) => Promise<{ canceled: boolean; filePath?: string }>;
  generatePdf?: (html: string) => Promise<Buffer>;
  writeFile?: (path: string, data: Buffer | string) => Promise<void>;
}

/**
 * Xuất tài liệu theo định dạng yêu cầu (.md, .docx, .pdf).
 */
export async function exportFormattedDocument(
  win: BrowserWindow | null,
  input: StudioExportInput,
  tr: Translator,
  deps?: ExportDeps,
): Promise<StudioExportResult> {
  const content = input.content;
  const suggestedName = input.suggestedName;
  const format: ExportFormat = input.format ?? "md";

  if (typeof content !== "string" || typeof suggestedName !== "string") {
    throw new Error("Invalid export request.");
  }

  const extension =
    format === "docx" ? "docx" : format === "pdf" ? "pdf" : "md";
  const defaultPath = `${sanitizeName(suggestedName)}.${extension}`;
  const filters = exportDialogFilters(tr, format);

  const showSave =
    deps?.showSaveDialog ??
    (async (w, opts) =>
      w ? dialog.showSaveDialog(w, opts) : dialog.showSaveDialog(opts));
  const write = deps?.writeFile ?? fsWriteFile;
  const pdfGen = deps?.generatePdf ?? generatePdf;

  const result = await showSave(win, {
    defaultPath,
    filters,
  });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  if (format === "docx") {
    const docxBuf = generateDocx(content, input.options);
    await write(result.filePath, docxBuf);
  } else if (format === "pdf") {
    const html = markdownToHtml(content, input.options);
    const pdfBuf = await pdfGen(html);
    await write(result.filePath, pdfBuf);
  } else {
    await write(result.filePath, content);
  }

  return { saved: true, path: result.filePath };
}

/**
 * Tương thích ngược: Mở hộp thoại lưu + ghi nội dung ra .md.
 */
export async function exportMarkdown(
  win: BrowserWindow | null,
  content: string,
  suggestedName: string,
  tr: Translator,
): Promise<StudioExportResult> {
  return exportFormattedDocument(
    win,
    { content, suggestedName, format: "md" },
    tr,
  );
}
