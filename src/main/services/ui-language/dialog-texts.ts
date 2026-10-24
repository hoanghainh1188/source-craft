import type { Translator } from "@shared/i18n";

// 123 (FR-008, T055): tiêu đề + tên bộ lọc của hộp thoại hệ thống do main mở — hàm THUẦN (test được); adapter Electron
// (vault-backup/dialogs.ts, ingestion/relink-dialog.ts, studio/export.ts) chỉ ghép vào options.

export interface FileFilter {
  name: string;
  extensions: string[];
}

export function backupDialogTexts(tr: Translator): {
  saveTitle: string;
  openTitle: string;
  filters: FileFilter[];
} {
  return {
    saveTitle: tr.t("dialogs.backup.title"),
    openTitle: tr.t("dialogs.restore.title"),
    filters: [
      { name: tr.t("dialogs.backup.filter"), extensions: ["ivbackup"] },
    ],
  };
}

export function relinkDialogTexts(
  tr: Translator,
  extensions: string[],
): { title: string; filters: FileFilter[] } {
  return {
    title: tr.t("dialogs.relink.title"),
    filters: [{ name: tr.t("dialogs.relink.filter"), extensions }],
  };
}

import type { ExportFormat } from "@shared/ipc/types";

export function exportDialogFilters(
  tr: Translator,
  format: ExportFormat = "md",
): FileFilter[] {
  if (format === "docx") {
    return [{ name: tr.t("dialogs.export.filterDocx"), extensions: ["docx"] }];
  }
  if (format === "pdf") {
    return [{ name: tr.t("dialogs.export.filterPdf"), extensions: ["pdf"] }];
  }
  return [{ name: tr.t("dialogs.export.filter"), extensions: ["md"] }];
}
