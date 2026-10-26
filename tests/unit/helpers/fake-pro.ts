// 248 (đợt 2) — module Pro GIẢ cho test của repo public. KHÔNG chứa nội dung Pro: mỗi hàm trả chuỗi đánh dấu tất định để
// test kiểm phần ĐIỀU PHỐI của core (map-reduce, khối <request>/<pair>, cổng stub) mà không cần bản Pro thật.
// Nội dung prompt Pro được test ở repo source-craft-pro. Dùng:
//   vi.mock("../../src/main/pro", () => import("./helpers/fake-pro"));
// `setFakeProAvailable(false)` ⇒ hành xử như stub (available() = false, mọi hàm Pro ném ProUnavailableError).
import type { LanguageCode } from "@shared/i18n";
import type { DomainMode, StudioKind } from "@shared/ipc/types";
import { ProUnavailableError } from "../../../src/main/services/pro-bridge/pro-unavailable";

let proAvailable = true;

export function setFakeProAvailable(value: boolean): void {
  proAvailable = value;
}

export function available(): boolean {
  return proAvailable;
}

export function unavailable(lang: LanguageCode): ProUnavailableError {
  return new ProUnavailableError(lang);
}

function guard(lang: LanguageCode): void {
  if (!proAvailable) throw unavailable(lang);
}

export function studioTask(kind: StudioKind, lang: LanguageCode): string {
  guard(lang);
  return `Task: [fake-pro:task:${kind}:${lang}]`;
}

export function studioDiffMapPrompt(lang: LanguageCode): string {
  guard(lang);
  return `[fake-pro:diff-map:${lang}]`;
}

export function studioDiffCondensePrompt(lang: LanguageCode): string {
  guard(lang);
  return `[fake-pro:diff-condense:${lang}]`;
}

/**
 * Chia đơn giản: mỗi bản tối đa nửa trần (bản gốc lấy phần lẻ), mỗi bản ≥ 1 lô. KHÁC bản thật: không nhường phần một bản
 * dùng không hết ⇒ test core chỉ được kiểm điều phối, không kiểm phép chia (phép chia test ở repo source-craft-pro).
 */
export function pickDiffBatches<T>(
  base: T[],
  revised: T[],
  max: number,
): [T[], T[]] {
  guard("vi");
  const half = Math.max(1, Math.ceil(max / 2));
  return [base.slice(0, half), revised.slice(0, Math.max(1, max - half))];
}

export function domainDirectives(
  mode: DomainMode,
  lang?: LanguageCode,
): string[] {
  guard(lang ?? "vi");
  return [`[fake-pro:domain:${mode}:${lang ?? "-"}]`];
}
