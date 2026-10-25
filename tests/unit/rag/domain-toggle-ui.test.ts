// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type {
  DomainMode,
  LicenseFeature,
  LicenseStatus,
} from "@shared/ipc/types";
import { I18nProvider } from "../../../src/renderer/shared/i18n/I18nProvider";
import { DomainToggle } from "../../../src/renderer/features/rag-qa/DomainToggle";
import {
  SPECIALIST_MODES_UPSELL,
  useDomainGate,
} from "../../../src/renderer/features/rag-qa/useDomainGate";
import { UpgradePrompt } from "../../../src/renderer/features/license-upsell/UpgradePrompt";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

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
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: vi.fn(() =>
      Promise.resolve({ preference: "vi", effective: "vi" }),
    ),
    onUiLanguageChanged: vi.fn(() => () => undefined),
    openPurchasePage: vi.fn(() => Promise.resolve({ ok: true })),
    getLicenseStatus: vi.fn(() => Promise.resolve(initial)),
    onLicenseChanged: vi.fn(() => () => undefined),
  };
}

async function render(el: ReactElement): Promise<void> {
  await act(async () => {
    root.render(createElement(I18nProvider, null, el));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function Harness({
  initial = "general",
}: {
  initial?: DomainMode;
}): JSX.Element {
  const [domainMode, setDomainMode] = useState<DomainMode>(initial);
  const gate = useDomainGate(domainMode, setDomainMode);
  return createElement(
    "div",
    null,
    createElement(DomainToggle, {
      domainMode,
      onChange: gate.changeDomain,
      locked: gate.locked,
      onLockedClick: gate.showUpsell,
    }),
    gate.upsellVisible
      ? createElement(UpgradePrompt, { error: SPECIALIST_MODES_UPSELL })
      : null,
  );
}

describe("238 — DomainToggle & useDomainGate UI", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("gói Pro: bấm Pháp lý / Y tế → đổi mode bình thường, không hiện lời mời", async () => {
    installApi(status(["specialistAiModes"]));
    await render(createElement(Harness));

    const legalBtn = container.querySelector(
      '[data-testid="domain-legal"]',
    ) as HTMLButtonElement;
    expect(legalBtn.classList.contains("locked")).toBe(false);

    await act(async () => {
      legalBtn.click();
    });

    expect(legalBtn.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelector('[data-testid="upgrade-prompt"]'),
    ).toBeNull();
  });

  it("gói Free: nút Pháp lý / Y tế bị gắn class locked và bấm vào hiện UpgradePrompt", async () => {
    installApi(status([]));
    await render(createElement(Harness));

    const legalBtn = container.querySelector(
      '[data-testid="domain-legal"]',
    ) as HTMLButtonElement;
    expect(legalBtn.classList.contains("locked")).toBe(true);
    expect(legalBtn.getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      legalBtn.click();
    });

    // Vẫn giữ general
    const generalBtn = container.querySelector(
      '[data-testid="domain-general"]',
    ) as HTMLButtonElement;
    expect(generalBtn.getAttribute("aria-pressed")).toBe("true");

    // Hiện UpgradePrompt
    const prompt = container.querySelector('[data-testid="upgrade-prompt"]');
    expect(prompt).not.toBeNull();
  });

  it("gói Free: bấm Y tế cũng hiện UpgradePrompt", async () => {
    installApi(status([]));
    await render(createElement(Harness));

    const medicalBtn = container.querySelector(
      '[data-testid="domain-medical"]',
    ) as HTMLButtonElement;
    expect(medicalBtn.classList.contains("locked")).toBe(true);

    await act(async () => {
      medicalBtn.click();
    });

    expect(
      container.querySelector('[data-testid="upgrade-prompt"]'),
    ).not.toBeNull();
  });

  it("gói Free: đang hiện UpgradePrompt, bấm lại 'Chung' → ẩn lời mời", async () => {
    installApi(status([]));
    await render(createElement(Harness));

    const legalBtn = container.querySelector(
      '[data-testid="domain-legal"]',
    ) as HTMLButtonElement;
    await act(async () => {
      legalBtn.click();
    });
    expect(
      container.querySelector('[data-testid="upgrade-prompt"]'),
    ).not.toBeNull();

    const generalBtn = container.querySelector(
      '[data-testid="domain-general"]',
    ) as HTMLButtonElement;
    await act(async () => {
      generalBtn.click();
    });
    expect(
      container.querySelector('[data-testid="upgrade-prompt"]'),
    ).toBeNull();
  });
});
