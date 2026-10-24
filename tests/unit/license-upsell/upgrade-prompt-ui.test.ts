// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { LicenseStatus } from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { I18nProvider } from "../../../src/renderer/shared/i18n/I18nProvider";
import { UpgradePrompt } from "../../../src/renderer/features/license-upsell/UpgradePrompt";
import { isUpsellCode } from "../../../src/renderer/features/license-upsell/upsell-codes";
import { SettingsLicenseSection } from "../../../src/renderer/features/app-shell/SettingsLicenseSection";

// 237 — lời mời nâng cấp cạnh lỗi hạn mức gói Free + nút Mua trong Cài đặt. window.api là giả.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;

function status(overrides: Partial<LicenseStatus> = {}): LicenseStatus {
  return {
    state: "free",
    tier: "free",
    orgName: null,
    seats: null,
    issuedAt: null,
    expiresAt: null,
    daysRemaining: null,
    entitlements: {} as LicenseStatus["entitlements"],
    ...overrides,
  };
}

async function render(el: ReactElement): Promise<void> {
  await act(async () => {
    root.render(createElement(I18nProvider, null, el));
  });
}

function q(testId: string): HTMLElement | null {
  return container.querySelector(`[data-testid=${testId}]`);
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    openPurchasePage: vi.fn(() => Promise.resolve({ ok: true })),
    getLicenseStatus: vi.fn(() => Promise.resolve(status())),
    onLicenseChanged: vi.fn(() => () => undefined),
  };
  (window as unknown as { api: unknown }).api = api;
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("isUpsellCode", () => {
  it.each([
    "licenseLimitNotebooks",
    "licenseLimitSources",
    "licenseRequireProFormat",
    "licenseRequireProStudio",
    "licenseRequireProSharedNotebooks",
    "lanAiRequireEnterprise",
  ])("%s là lỗi hạn mức ⇒ có lời mời nâng cấp", (code) => {
    expect(isUpsellCode(code)).toBe(true);
  });

  it.each([undefined, "notebookNameEmpty", "vaultLocked", "khongTonTai"])(
    "%s không phải lỗi hạn mức",
    (code) => {
      expect(isUpsellCode(code)).toBe(false);
    },
  );
});

describe("UpgradePrompt", () => {
  const limitError: ParsedIpcError = {
    message: "licenseLimitNotebooks",
    onlineKind: null,
    code: "licenseLimitNotebooks",
    params: { max: 3 },
  };

  it("không hiện gì với lỗi không liên quan bản quyền", async () => {
    await render(
      createElement(UpgradePrompt, {
        error: { message: "x", onlineKind: null, code: "notebookNameEmpty" },
      }),
    );
    expect(q("upgrade-prompt")).toBeNull();
  });

  it("hiện lời mời và nút mở trang mua khi chạm hạn mức", async () => {
    await render(createElement(UpgradePrompt, { error: limitError }));
    const box = q("upgrade-prompt");
    expect(box).not.toBeNull();
    expect(box?.textContent).toContain("Nâng cấp");

    await act(async () => {
      (q("upgrade-prompt-buy") as HTMLButtonElement).click();
    });
    expect(api.openPurchasePage).toHaveBeenCalledTimes(1);
  });

  it("báo lỗi thân thiện khi không mở được trình duyệt", async () => {
    api.openPurchasePage.mockResolvedValueOnce({ ok: false });
    await render(createElement(UpgradePrompt, { error: limitError }));
    await act(async () => {
      (q("upgrade-prompt-buy") as HTMLButtonElement).click();
    });
    expect(q("purchase-open-failed")).not.toBeNull();
  });
});

describe("SettingsLicenseSection — nút Mua", () => {
  it("gói Free: có nút Mua, bấm thì mở trang mua", async () => {
    await render(createElement(SettingsLicenseSection));
    const buy = q("license-buy-btn") as HTMLButtonElement | null;
    expect(buy).not.toBeNull();
    await act(async () => {
      buy?.click();
    });
    expect(api.openPurchasePage).toHaveBeenCalledTimes(1);
  });

  it("bản quyền hết hạn: vẫn có nút Mua để gia hạn", async () => {
    api.getLicenseStatus.mockResolvedValueOnce(
      status({
        state: "expired",
        tier: "free",
        expiresAt: "2026-01-01T00:00:00Z",
      }),
    );
    await render(createElement(SettingsLicenseSection));
    expect(q("license-buy-btn")).not.toBeNull();
  });

  it("bản quyền Pro đang hiệu lực: không hiện nút Mua", async () => {
    api.getLicenseStatus.mockResolvedValueOnce(
      status({ state: "valid", tier: "pro", seats: 1 }),
    );
    await render(createElement(SettingsLicenseSection));
    expect(q("license-buy-btn")).toBeNull();
  });
});
