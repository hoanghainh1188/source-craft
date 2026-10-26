// SPDX-License-Identifier: MIT
// 248 — STUB module Pro (repo public). Cùng tên hàm, cùng chữ ký với bản cài đặt thật ở repo private
// source-craft-pro; job `pro` của release.yml chép đè cả thư mục này trước khi build bản phát hành chính thức.
// Quy tắc ranh giới (docs/pro-repo-split-plan.md §4.1): hàm thuần ở main — không Electron, không IPC, không UI,
// không tự gọi mạng. Mỗi hàm Pro ở stub ném `unavailable(lang)`; core gọi `available()` để ẩn/báo thay vì gọi mù.
// KHÔNG commit mã Pro vào đây: CI public chặn mọi tệp mang dấu SPDX của bản Pro (scripts/pro-overlay.mjs check-stub).
import type { LanguageCode } from "@shared/i18n";
import type { DomainMode, StudioKind } from "@shared/ipc/types";
import { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";

/** Bản build này có chức năng Pro không (stub: không). */
export function available(): boolean {
  return false;
}

/** Lỗi người-dùng-thấy "bản này không có chức năng Pro" theo ngôn ngữ giao diện. */
export function unavailable(lang: LanguageCode): ProUnavailableError {
  return new ProUnavailableError(lang);
}

/** Đợt 2 — dòng "Task: …" của system prompt Studio cho loại Pro (mọi loại trừ summary, keyPoints). */
export function studioTask(_kind: StudioKind, lang: LanguageCode): string {
  throw unavailable(lang);
}

/** Đợt 2 — chỉ dẫn lượt map (trích điều khoản) của So sánh văn bản; core nối thêm quy tắc ghi chú chung. */
export function studioDiffMapPrompt(lang: LanguageCode): string {
  throw unavailable(lang);
}

/** Đợt 2 — chỉ dẫn lượt rút gọn ghi chú của So sánh văn bản; core nối thêm quy tắc ghi chú chung. */
export function studioDiffCondensePrompt(lang: LanguageCode): string {
  throw unavailable(lang);
}

/** Đợt 2 — chia trần lượt map cho [bản gốc, bản sửa đổi] của So sánh văn bản. */
export function pickDiffBatches<T>(
  _base: T[],
  _revised: T[],
  _max: number,
): [T[], T[]] {
  throw unavailable("vi");
}

/** Đợt 2 — chỉ dẫn chế độ chuyên gia (Pháp lý / Y tế) chèn vào system prompt hỏi đáp. */
export function domainDirectives(
  _mode: DomainMode,
  lang?: LanguageCode,
): string[] {
  throw unavailable(lang ?? "vi");
}
