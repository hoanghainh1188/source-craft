import { describe, expect, it, vi } from "vitest";
import {
  createPurchasePageOpener,
  isAllowedPurchaseUrl,
  PURCHASE_PAGE_URL,
} from "../../../src/main/services/license-upsell/purchase-page";
import { CHANNELS, isWhitelisted } from "../../../src/shared/ipc/channels";

// 237 — mở trang mua bản quyền: URL cố định ở main, renderer không truyền URL; chỉ mở https://github.com.

function deps(
  overrides: Partial<Parameters<typeof createPurchasePageOpener>[0]> = {},
) {
  return {
    openExternal: vi.fn(() => Promise.resolve()),
    log: vi.fn(),
    now: vi.fn(() => 10_000),
    ...overrides,
  };
}

describe("isAllowedPurchaseUrl", () => {
  it("chấp nhận URL trang mua mặc định", () => {
    expect(isAllowedPurchaseUrl(PURCHASE_PAGE_URL)).toBe(true);
  });

  it.each([
    "http://github.com/hoanghainh1188/source-craft",
    "https://evil.example.com/github.com",
    "https://github.com.evil.example/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "không phải url",
  ])("từ chối %s", (url) => {
    expect(isAllowedPurchaseUrl(url)).toBe(false);
  });
});

describe("createPurchasePageOpener", () => {
  it("mở đúng URL trang mua qua openExternal và ghi sự kiện không kèm URL", async () => {
    const d = deps();
    const open = createPurchasePageOpener(d);

    await expect(open()).resolves.toEqual({ ok: true });
    expect(d.openExternal).toHaveBeenCalledWith(PURCHASE_PAGE_URL);
    expect(d.log).toHaveBeenCalledWith("license.purchasePageOpened", {});
  });

  it("không gọi openExternal khi URL cấu hình nằm ngoài danh sách cho phép", async () => {
    const d = deps({ url: "https://evil.example.com/buy" });
    const open = createPurchasePageOpener(d);

    await expect(open()).resolves.toEqual({ ok: false });
    expect(d.openExternal).not.toHaveBeenCalled();
    expect(d.log).toHaveBeenCalledWith("license.purchaseUrlRejected", {});
  });

  it("trả ok:false và ghi loại lỗi khi hệ điều hành không mở được trình duyệt", async () => {
    const d = deps({
      openExternal: vi.fn(() => Promise.reject(new TypeError("boom"))),
    });
    const open = createPurchasePageOpener(d);

    await expect(open()).resolves.toEqual({ ok: false });
    expect(d.log).toHaveBeenCalledWith("license.purchasePageOpenFailed", {
      errorType: "TypeError",
    });
  });

  it("chặn bấm liên tục: lần thứ hai trong 1 giây bị bỏ qua", async () => {
    let t = 10_000;
    const d = deps({ now: vi.fn(() => t) });
    const open = createPurchasePageOpener(d);

    await open();
    t += 500;
    await expect(open()).resolves.toEqual({ ok: false, throttled: true });
    t += 600;
    await expect(open()).resolves.toEqual({ ok: true });
    expect(d.openExternal).toHaveBeenCalledTimes(2);
  });
});

describe("kênh IPC license:openPurchasePage", () => {
  it("được whitelist và không có kênh mở URL tuỳ ý", () => {
    expect(CHANNELS.licenseOpenPurchasePage).toBe("license:openPurchasePage");
    expect(isWhitelisted("license:openPurchasePage")).toBe(true);
    expect(isWhitelisted("license:openUrl")).toBe(false);
  });
});
