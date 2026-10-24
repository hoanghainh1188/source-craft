// 237 — mở trang mua bản quyền Pro/Enterprise bằng trình duyệt hệ thống.
// URL CỐ ĐỊNH ở main (renderer chỉ gọi kênh, không truyền URL) ⇒ không thể biến kênh này thành "mở URL tuỳ ý".
// v1 chưa có cổng thanh toán: tạm trỏ về trang GitHub của dự án; đổi hằng số này khi có trang mua thật
// (nhớ cập nhật PURCHASE_PAGE_HOSTS + test). Ghi nhật ký chỉ tên sự kiện, không kèm URL.

import type { OpenPurchasePageResult } from "@shared/ipc/types";

export const PURCHASE_PAGE_URL =
  "https://github.com/hoanghainh1188/source-craft#pricing";

/** Host được phép mở (so khớp chính xác, chỉ https). */
export const PURCHASE_PAGE_HOSTS: readonly string[] = ["github.com"];

/** Khoảng tối thiểu giữa 2 lần mở ⇒ bấm đúp không bật 2 tab trình duyệt. */
const MIN_INTERVAL_MS = 1_000;

export interface PurchasePageDeps {
  openExternal: (url: string) => Promise<void>;
  log: (event: string, meta: Record<string, unknown>) => void;
  now: () => number;
  /** Chỉ để test ghi đè; mặc định PURCHASE_PAGE_URL. */
  url?: string;
}

/** Lưới cuối trước shell.openExternal (Electron security checklist). */
export function isAllowedPurchaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && PURCHASE_PAGE_HOSTS.includes(u.host);
  } catch {
    return false;
  }
}

function errorTypeOf(e: unknown): string {
  return e instanceof Error ? e.constructor.name : typeof e;
}

export function createPurchasePageOpener(
  deps: PurchasePageDeps,
): () => Promise<OpenPurchasePageResult> {
  const url = deps.url ?? PURCHASE_PAGE_URL;
  let lastOpenedAt = Number.NEGATIVE_INFINITY;

  return async () => {
    if (!isAllowedPurchaseUrl(url)) {
      deps.log("license.purchaseUrlRejected", {});
      return { ok: false };
    }
    const now = deps.now();
    if (now - lastOpenedAt < MIN_INTERVAL_MS) {
      return { ok: false, throttled: true };
    }
    lastOpenedAt = now;
    try {
      await deps.openExternal(url);
    } catch (e) {
      deps.log("license.purchasePageOpenFailed", { errorType: errorTypeOf(e) });
      return { ok: false };
    }
    deps.log("license.purchasePageOpened", {});
    return { ok: true };
  };
}
