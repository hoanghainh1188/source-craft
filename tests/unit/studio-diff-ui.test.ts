// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createTranslator } from "@shared/i18n";
import type { StudioGenerateInput, StudioResult } from "@shared/ipc/types";
import { encodeUserError } from "@shared/codes/user-error";
import { UiLanguageContext } from "../../src/renderer/shared/i18n/i18n-context";
import { StudioResultCard } from "../../src/renderer/features/studio/StudioResultCard";
import { StudioColumn } from "../../src/renderer/features/studio/StudioColumn";

// 233 (T017, FR-008, FR-010): disclaimer pháp lý trên StudioResultCard và UpgradePrompt khi Free bị từ chối

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const result = (over: Partial<StudioResult>): StudioResult => ({
  id: "r1",
  notebookId: "nb1",
  kind: "documentDiff",
  content: "Phân tích [1].",
  citations: [],
  createdAt: 1,
  ...over,
});

function inLang(el: ReactElement, lang: "vi" | "en"): ReactElement {
  return createElement(
    UiLanguageContext.Provider,
    {
      value: {
        preference: lang,
        effective: lang,
        translator: createTranslator(lang),
        setPreference: async () => undefined,
      },
    },
    el,
  );
}

describe("StudioResultCard — documentDiff disclaimer (233)", () => {
  it("hiển thị disclaimer pháp lý cố định khi kind = documentDiff (vi)", () => {
    act(() => {
      root.render(
        inLang(
          createElement(StudioResultCard, {
            result: result({ kind: "documentDiff" }),
            regenerating: false,
            onRegenerate: () => undefined,
          }),
          "vi",
        ),
      );
    });

    const disclaimer = container.querySelector(
      "[data-testid=studio-diff-disclaimer]",
    );
    expect(disclaimer).not.toBeNull();
    expect(disclaimer!.textContent).toContain(
      "Phân tích dựa trên nội dung tài liệu, không thay thế tư vấn pháp lý.",
    );
  });

  it("hiển thị disclaimer pháp lý cố định khi kind = documentDiff (en)", () => {
    act(() => {
      root.render(
        inLang(
          createElement(StudioResultCard, {
            result: result({ kind: "documentDiff" }),
            regenerating: false,
            onRegenerate: () => undefined,
          }),
          "en",
        ),
      );
    });

    const disclaimer = container.querySelector(
      "[data-testid=studio-diff-disclaimer]",
    );
    expect(disclaimer).not.toBeNull();
    expect(disclaimer!.textContent).toContain(
      "Based on the documents' text only — not legal advice.",
    );
  });

  it("không hiển thị disclaimer khi kind khác (summary, keyPoints)", () => {
    act(() => {
      root.render(
        inLang(
          createElement(StudioResultCard, {
            result: result({ kind: "summary" }),
            regenerating: false,
            onRegenerate: () => undefined,
          }),
          "vi",
        ),
      );
    });

    expect(
      container.querySelector("[data-testid=studio-diff-disclaimer]"),
    ).toBeNull();
  });
});

describe("StudioColumn — UpgradePrompt cho documentDiff (233)", () => {
  it("hiển thị UpgradePrompt khi gói Free bị từ chối licenseRequireProStudio", async () => {
    (window as unknown as { api: unknown }).api = {
      aiGetRuntimeStatus: () => Promise.resolve({ ollamaReady: true }),
      sourceListByNotebook: () =>
        Promise.resolve([
          { id: "s1", notebookId: "nb1", status: "ready", title: "A" },
          { id: "s2", notebookId: "nb1", status: "ready", title: "B" },
        ]),
      onSourceProgress: () => () => undefined,
      onStudioStreamToken: () => () => undefined,
      onStudioProgress: () => () => undefined,
      studioList: () => Promise.resolve([]),
      studioCancel: () => Promise.resolve({ cancelled: true }),
      studioGenerate: (_i: StudioGenerateInput) =>
        Promise.reject(
          new Error(
            encodeUserError("licenseRequireProStudio", {
              kind: "documentDiff",
            }),
          ),
        ),
    };

    await act(async () => {
      root.render(
        inLang(createElement(StudioColumn, { notebookId: "nb1" }), "vi"),
      );
    });

    // Mở bộ chọn diff
    const toggle = container.querySelector<HTMLButtonElement>(
      "[data-testid=studio-diff-toggle]",
    )!;
    expect(toggle).not.toBeNull();
    act(() => {
      toggle.click();
    });

    // Bấm So sánh (đã tự điền s1, s2 vì scope rỗng nhưng sources có 2 nguồn hoặc chọn)
    const baseSelect = container.querySelector<HTMLSelectElement>(
      "[data-testid=studio-diff-base-select]",
    )!;
    const revisedSelect = container.querySelector<HTMLSelectElement>(
      "[data-testid=studio-diff-revised-select]",
    )!;
    act(() => {
      baseSelect.value = "s1";
      baseSelect.dispatchEvent(new Event("change", { bubbles: true }));
      revisedSelect.value = "s2";
      revisedSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const submitBtn = container.querySelector<HTMLButtonElement>(
      "[data-testid=studio-diff-submit]",
    )!;
    expect(submitBtn.disabled).toBe(false);

    await act(async () => {
      submitBtn.click();
    });

    // Chờ state error được commit
    const errBox = container.querySelector(
      "[data-testid=studio-error-documentDiff]",
    );
    expect(errBox).not.toBeNull();
    expect(errBox!.textContent).toContain("yêu cầu bản quyền Pro");

    // UpgradePrompt được render
    const upgradePrompt = errBox!.querySelector("[data-testid=upgrade-prompt]");
    expect(upgradePrompt).not.toBeNull();
  });
});
