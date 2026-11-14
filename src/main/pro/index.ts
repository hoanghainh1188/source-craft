// SPDX-License-Identifier: MIT
// 261 — module chức năng nâng cao (trước #261 là bản Pro ở repo private source-craft-pro, nay gộp về đây dưới MIT).
// Giữ ranh giới cũ (docs/pro-repo-split-plan.md §4.1): hàm thuần ở main — không Electron, không IPC, không UI,
// không tự gọi mạng. `available()` luôn true; giữ hàm để mã gọi không phải đổi.
import type { LanguageCode } from "@shared/i18n";
import type { DomainMode, StudioKind } from "@shared/ipc/types";
import { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";
import { domainDirectives as domainDirectivesImpl } from "./domain-directives";
import {
  pickDiffBatches as pickDiffBatchesImpl,
  studioDiffCondensePrompt as studioDiffCondensePromptImpl,
  studioDiffMapPrompt as studioDiffMapPromptImpl,
  studioTask as studioTaskImpl,
} from "./studio-prompts";

/** Bản build này có chức năng nâng cao không (từ #261: luôn có). */
export function available(): boolean {
  return true;
}

/** Lỗi người-dùng-thấy "bản này không có chức năng Pro" (giữ lại cho mã gọi cũ; không còn bản thiếu module này). */
export function unavailable(lang: LanguageCode): ProUnavailableError {
  return new ProUnavailableError(lang);
}

/** Đợt 2 — dòng "Task: …" của system prompt Studio cho loại Pro (mọi loại trừ summary, keyPoints). */
export function studioTask(kind: StudioKind, lang: LanguageCode): string {
  return studioTaskImpl(kind, lang);
}

/** Đợt 2 — chỉ dẫn lượt map (trích điều khoản) của So sánh văn bản; core nối thêm quy tắc ghi chú chung. */
export function studioDiffMapPrompt(lang: LanguageCode): string {
  return studioDiffMapPromptImpl(lang);
}

/** Đợt 2 — chỉ dẫn lượt rút gọn ghi chú của So sánh văn bản; core nối thêm quy tắc ghi chú chung. */
export function studioDiffCondensePrompt(lang: LanguageCode): string {
  return studioDiffCondensePromptImpl(lang);
}

/** Đợt 2 — chia trần lượt map cho [bản gốc, bản sửa đổi] của So sánh văn bản. */
export function pickDiffBatches<T>(
  base: T[],
  revised: T[],
  max: number,
): [T[], T[]] {
  return pickDiffBatchesImpl(base, revised, max);
}

/** Đợt 2 — chỉ dẫn chế độ chuyên gia (Pháp lý / Y tế) chèn vào system prompt hỏi đáp. */
export function domainDirectives(
  mode: DomainMode,
  lang?: LanguageCode,
): string[] {
  return domainDirectivesImpl(mode, lang);
}
