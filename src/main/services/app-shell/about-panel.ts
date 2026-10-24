import type { Translator } from "@shared/i18n";
import type { LibraryEntry } from "./about-licenses";

// 213: nội dung hộp "Giới thiệu" MẶC ĐỊNH của hệ điều hành (app.setAboutPanelOptions) — hàm thuần dựng tuỳ chọn theo ngôn ngữ giao
// diện. Chỉ tên/phiên bản/giấy phép công khai: KHÔNG đường dẫn người dùng, tên tài liệu hay khoá. `iconPath` là icon đi kèm app.

export const APP_NAME = "SourceCraft";
export const APP_LICENSE = "MIT";
export const APP_AUTHOR = "hoanghainh1188";
export const APP_COPYRIGHT = "© 2026 hoanghainh1188";

/** ASCII Art banner for SourceCraft in monospace credits */
export const SOURCECRAFT_ASCII_BANNER = [
  "   _____ ____  __  ______  ____________  __________  ___    ____________",
  "  / ___// __ \\/ / / / __ \\/ ____/ ____/ / ____/ __ \\/   |  / ____/_  __/",
  "  \\__ \\/ / / / / / / /_/ / /   / __/   / /   / /_/ / /| | / /_    / /   ",
  " ___/ / /_/ / /_/ / _, _/ /___/ /___  / /___/ _, _/ ___ |/ __/   / /    ",
  "/____/\\____/\\____/_/ |_|\\____/_____/  \\____/_/ |_/_/  |_/_/     /_/     ",
].join("\n");

export type AboutModelRole =
  "embedding" | "reranker" | "asrFinal" | "asrFallback";

export interface AboutModelEntry {
  role: AboutModelRole;
  name: string;
  version: string;
}

export interface AboutPanelInput {
  t: Translator;
  version: string;
  arch: string;
  packaged: boolean;
  runtime: { electron: string; chromium: string; node: string };
  models: readonly AboutModelEntry[];
  /** null = không đọc được ⇒ hiện dòng báo, các mục khác giữ nguyên */
  libraries: readonly LibraryEntry[] | null;
  iconPath?: string;
}

export interface AboutPanelOptions {
  applicationName: string;
  applicationVersion: string;
  version: string;
  copyright: string;
  credits: string;
  iconPath?: string;
}

export function buildAboutPanelOptions(i: AboutPanelInput): AboutPanelOptions {
  const { t } = i;
  const unknown = t.t("about.licenseUnknown");
  const lines: string[] = [
    SOURCECRAFT_ASCII_BANNER,
    "",
    t.t("about.privacy"),
    t.t("about.license", { license: APP_LICENSE, author: APP_AUTHOR }),
    "",
    t.t("about.build"),
    `${t.t(i.packaged ? "about.packaged" : "about.development")} · Electron ${i.runtime.electron} · Chromium ${i.runtime.chromium} · Node ${i.runtime.node}`,
    "",
    t.t("about.models"),
    ...i.models.map(
      (m) => `• ${t.t(`about.role.${m.role}`)}: ${m.name} (${m.version})`,
    ),
    "",
    t.t("about.libraries"),
    ...(i.libraries
      ? i.libraries.map(
          (l) => `• ${l.name} ${l.version} — ${l.license ?? unknown}`,
        )
      : [t.t("about.librariesUnavailable")]),
  ];
  return {
    applicationName: APP_NAME,
    applicationVersion: i.version,
    version: i.arch,
    copyright: APP_COPYRIGHT,
    credits: lines.join("\n"),
    ...(i.iconPath ? { iconPath: i.iconPath } : {}),
  };
}
