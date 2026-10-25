// SPDX-License-Identifier: MIT
// 248 — STUB module Pro (repo public). Cùng tên hàm, cùng chữ ký với bản cài đặt thật ở repo private
// source-craft-pro; job `pro` của release.yml chép đè cả thư mục này trước khi build bản phát hành chính thức.
// Quy tắc ranh giới (docs/pro-repo-split-plan.md §4.1): hàm thuần ở main — không Electron, không IPC, không UI,
// không tự gọi mạng. Mỗi hàm Pro ở stub ném `unavailable(lang)`; core gọi `available()` để ẩn/báo thay vì gọi mù.
// KHÔNG commit mã Pro vào đây: CI public chặn mọi tệp mang dấu SPDX của bản Pro (scripts/pro-overlay.mjs check-stub).
import type { LanguageCode } from "@shared/i18n";
import { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";

/** Bản build này có chức năng Pro không (stub: không). */
export function available(): boolean {
  return false;
}

/** Lỗi người-dùng-thấy "bản này không có chức năng Pro" theo ngôn ngữ giao diện. */
export function unavailable(lang: LanguageCode): ProUnavailableError {
  return new ProUnavailableError(lang);
}
