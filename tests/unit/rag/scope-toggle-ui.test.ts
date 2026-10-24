// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, useCallback, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { LicenseFeature, LicenseStatus } from "@shared/ipc/types";
import { I18nProvider } from "../../../src/renderer/shared/i18n/I18nProvider";
import { ScopeToggle } from "../../../src/renderer/features/rag-qa/ScopeToggle";
import { useLicenseFeature } from "../../../src/renderer/features/license-upsell/useLicenseFeature";
import { useScopeGate } from "../../../src/renderer/features/rag-qa/useScopeGate";
import { UpgradePrompt } from "../../../src/renderer/features/license-upsell/UpgradePrompt";
import { CROSS_SEARCH_UPSELL } from "../../../src/renderer/features/rag-qa/useScopeGate";
import type { RagSearchScope } from "@shared/ipc/types";

// 231 polish — gói Free không chọn được "Toàn bộ kho tri thức" (mời nâng cấp thay vì lỗi sau khi gửi);
// huy hiệu PRO dùng lớp CSS (token), không style inline. window.api là giả.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let licenseListener: ((s: LicenseStatus) => void) | null;

function status(features: LicenseFeature[]): LicenseStatus {
  return {
    state: features.length ? "valid" : "free",
    tier: features.length ? "pro" : "free",
    orgName: null,
    seats: null,
    issuedAt: null,
    expiresAt: null,
    daysRemaining: null,
    entitlements: { features } as unknown as LicenseStatus["entitlements"],
  };
}

function installApi(initial: LicenseStatus): void {
  licenseListener = null;
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    openPurchasePage: vi.fn(() => Promise.resolve({ ok: true })),
    getLicenseStatus: vi.fn(() => Promise.resolve(initial)),
    onLicenseChanged: vi.fn((cb: (s: LicenseStatus) => void) => {
      licenseListener = cb;
      return () => {
        licenseListener = null;
      };
    }),
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
  installApi(status([]));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ScopeToggle", () => {
  it("không khoá: bấm 'Toàn bộ' → onChange('all')", async () => {
    const onChange = vi.fn();
    await render(createElement(ScopeToggle, { scope: "current", onChange }));
    await act(async () => q("scope-all")?.click());
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("khoá (gói Free): bấm 'Toàn bộ' KHÔNG đổi phạm vi, gọi onLockedClick", async () => {
    const onChange = vi.fn();
    const onLockedClick = vi.fn();
    await render(
      createElement(ScopeToggle, {
        scope: "current",
        onChange,
        locked: true,
        onLockedClick,
      }),
    );
    const all = q("scope-all");
    expect(all?.getAttribute("aria-disabled")).toBe("true");
    await act(async () => all?.click());
    expect(onChange).not.toHaveBeenCalled();
    expect(onLockedClick).toHaveBeenCalledTimes(1);
  });

  it("khoá: 'Sổ tay này' vẫn bấm được bình thường", async () => {
    const onChange = vi.fn();
    await render(
      createElement(ScopeToggle, { scope: "current", onChange, locked: true }),
    );
    await act(async () => q("scope-current")?.click());
    expect(onChange).toHaveBeenCalledWith("current");
  });

  it("huy hiệu PRO dùng lớp CSS, không style inline", async () => {
    await render(
      createElement(ScopeToggle, { scope: "current", onChange: vi.fn() }),
    );
    const badge = q("scope-pro-badge");
    expect(badge).not.toBeNull();
    expect(badge?.className).toBe("scope-pro-badge");
    expect(badge?.getAttribute("style")).toBeNull();
  });
});

function Probe({ feature }: { feature: LicenseFeature }): JSX.Element {
  const v = useLicenseFeature(feature);
  return createElement("span", { "data-testid": "probe" }, String(v));
}

describe("useLicenseFeature", () => {
  it("gói Free → false sau khi đọc trạng thái", async () => {
    await render(createElement(Probe, { feature: "crossNotebookSearch" }));
    expect(q("probe")?.textContent).toBe("false");
  });

  it("bản quyền có cờ → true", async () => {
    installApi(status(["crossNotebookSearch"]));
    await render(createElement(Probe, { feature: "crossNotebookSearch" }));
    expect(q("probe")?.textContent).toBe("true");
  });

  it("kích hoạt bản quyền lúc đang mở (onLicenseChanged) → cập nhật ngay", async () => {
    await render(createElement(Probe, { feature: "crossNotebookSearch" }));
    expect(q("probe")?.textContent).toBe("false");
    await act(async () => licenseListener?.(status(["crossNotebookSearch"])));
    expect(q("probe")?.textContent).toBe("true");
  });

  it("đọc trạng thái lỗi → null (không khoá nhầm; main vẫn chặn)", async () => {
    (
      window as unknown as { api: { getLicenseStatus: () => Promise<never> } }
    ).api.getLicenseStatus = () => Promise.reject(new Error("x"));
    await render(createElement(Probe, { feature: "crossNotebookSearch" }));
    expect(q("probe")?.textContent).toBe("null");
  });
});

// Mô phỏng phần composer của ChatColumn: ScopeToggle + lời mời nâng cấp, nối qua useScopeGate.
function ScopeComposer({
  initial,
  onScope,
}: {
  initial: RagSearchScope;
  onScope?: (s: RagSearchScope) => void;
}): JSX.Element {
  const [scope, setScopeState] = useState<RagSearchScope>(initial);
  const setScope = useCallback(
    (s: RagSearchScope) => {
      onScope?.(s);
      setScopeState(s);
    },
    [onScope],
  );
  const gate = useScopeGate(scope, setScope);
  return createElement(
    "div",
    { "data-testid": "composer", "data-scope": scope },
    createElement(ScopeToggle, {
      scope,
      onChange: gate.changeScope,
      locked: gate.locked,
      onLockedClick: gate.showUpsell,
    }),
    gate.upsellVisible
      ? createElement(UpgradePrompt, { error: CROSS_SEARCH_UPSELL })
      : null,
  );
}

describe("useScopeGate (composer Chat)", () => {
  it("gói Free bấm 'Toàn bộ' → giữ 'current' và hiện lời mời nâng cấp", async () => {
    await render(createElement(ScopeComposer, { initial: "current" }));
    expect(q("upgrade-prompt")).toBeNull();
    await act(async () => q("scope-all")?.click());
    expect(q("composer")?.dataset.scope).toBe("current");
    expect(q("upgrade-prompt")).not.toBeNull();
  });

  it("bấm lại 'Sổ tay này' → ẩn lời mời", async () => {
    await render(createElement(ScopeComposer, { initial: "current" }));
    await act(async () => q("scope-all")?.click());
    await act(async () => q("scope-current")?.click());
    expect(q("upgrade-prompt")).toBeNull();
  });

  it("kích hoạt bản quyền khi lời mời đang hiện → ẩn lời mời và cho chọn 'Toàn bộ'", async () => {
    await render(createElement(ScopeComposer, { initial: "current" }));
    await act(async () => q("scope-all")?.click());
    await act(async () => licenseListener?.(status(["crossNotebookSearch"])));
    expect(q("upgrade-prompt")).toBeNull();
    await act(async () => q("scope-all")?.click());
    expect(q("composer")?.dataset.scope).toBe("all");
  });

  it("đang ở 'all' mà mất bản quyền (huỷ/hết hạn) → tự về 'current'", async () => {
    installApi(status(["crossNotebookSearch"]));
    const onScope = vi.fn();
    await render(createElement(ScopeComposer, { initial: "all", onScope }));
    expect(q("composer")?.dataset.scope).toBe("all");
    await act(async () => licenseListener?.(status([])));
    expect(q("composer")?.dataset.scope).toBe("current");
    expect(onScope).toHaveBeenCalledWith("current");
  });
});
