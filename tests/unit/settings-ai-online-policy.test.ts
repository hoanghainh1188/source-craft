// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { SettingsAiOnlineSection } from "../../src/renderer/features/ai-runtime/SettingsAiOnlineSection";
import { I18nProvider } from "../../src/renderer/shared/i18n/I18nProvider";
import type { OnlineState } from "../../src/shared/ipc/types";

// 228 (SC-003): khi chính sách IT khoá AI đám mây, Cài đặt › AI online khoá toggle + nút kiểm tra và nêu tên tổ chức.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function stateWith(cloudLockedBy: string | null): OnlineState {
  return {
    providers: (["anthropic", "gemini", "openai"] as const).map((id) => ({
      id,
      label: id,
      hasKey: true,
      model: null,
      presets: [],
      active: false,
    })),
    activeOnlineId: null,
    cloudLockedBy,
  };
}

function install(state: OnlineState) {
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () => Promise.resolve({ preference: "vi", effective: "vi" }),
    setUiLanguage: () => Promise.resolve({ preference: "vi", effective: "vi" }),
    onUiLanguageChanged: () => () => undefined,
    aiGetOnlineState: () => Promise.resolve(state),
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async () => {
  act(() =>
    root.render(
      createElement(I18nProvider, null, createElement(SettingsAiOnlineSection)),
    ),
  );
  await act(async () => {});
};
const toggle = (id: string) =>
  container.querySelector(
    `[data-testid=online-toggle-${id}]`,
  ) as HTMLInputElement;
const testBtn = (id: string) =>
  container.querySelector(
    `[data-testid=online-test-${id}]`,
  ) as HTMLButtonElement;

describe("SettingsAiOnlineSection — khoá theo chính sách IT (228)", () => {
  it("cloudLockedBy ⇒ mọi toggle + nút kiểm tra bị disabled, hiện thông báo kèm tổ chức", async () => {
    install(stateWith("ACME Law"));
    await render();
    for (const id of ["anthropic", "gemini", "openai"]) {
      expect(toggle(id).disabled).toBe(true);
      expect(testBtn(id).disabled).toBe(true);
    }
    const note = container.querySelector("[data-testid=online-policy-lock]");
    expect(note?.textContent).toContain("ACME Law");
  });

  it("không khoá ⇒ toggle bật được (có key), không có thông báo khoá", async () => {
    install(stateWith(null));
    await render();
    expect(toggle("openai").disabled).toBe(false);
    expect(testBtn("openai").disabled).toBe(false);
    expect(
      container.querySelector("[data-testid=online-policy-lock]"),
    ).toBeNull();
  });
});
