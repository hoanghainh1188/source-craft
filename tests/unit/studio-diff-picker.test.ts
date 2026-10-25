// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { createTranslator } from "@shared/i18n";
import type { Source } from "@shared/ipc/types";
import { UiLanguageContext } from "../../src/renderer/shared/i18n/i18n-context";
import {
  StudioDiffPicker,
  type StudioDiffPickerProps,
} from "../../src/renderer/features/studio/StudioDiffPicker";

// 233 (T014, FR-009): StudioDiffPicker — chọn bản gốc / bản sửa đổi, hoán đổi, kiểm soát nút So sánh

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

const SOURCES: Source[] = [
  {
    id: "s1",
    notebookId: "nb1",
    status: "ready",
    kind: "pdf",
    title: "HopDong_Goc.pdf",
  } as Source,
  {
    id: "s2",
    notebookId: "nb1",
    status: "ready",
    kind: "pdf",
    title: "HopDong_SuaDoi.pdf",
  } as Source,
  {
    id: "s3",
    notebookId: "nb1",
    status: "ready",
    kind: "docx",
    title: "PhuLuc.docx",
  } as Source,
];

const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
  container.querySelector(sel) as T | null;

function render(
  props: Partial<StudioDiffPickerProps> = {},
  lang: "vi" | "en" = "vi",
): void {
  const allProps: StudioDiffPickerProps = {
    sources: SOURCES,
    scope: [],
    disabled: false,
    loading: false,
    onSubmit: vi.fn(),
    defaultOpen: true,
    ...props,
  };
  act(() => {
    root.render(
      createElement(
        UiLanguageContext.Provider,
        {
          value: {
            preference: lang,
            effective: lang,
            translator: createTranslator(lang),
            setPreference: async () => undefined,
          },
        },
        createElement(StudioDiffPicker, allProps),
      ),
    );
  });
}

describe("StudioDiffPicker (233)", () => {
  it("chỉ liệt kê các nguồn trong danh sách sources vào 2 dropdown", () => {
    render();
    const baseSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-base-select]",
    )!;
    const revisedSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-revised-select]",
    )!;
    expect(baseSelect).not.toBeNull();
    expect(revisedSelect).not.toBeNull();

    const baseOptions = [...baseSelect.options]
      .map((o) => o.value)
      .filter(Boolean);
    const revisedOptions = [...revisedSelect.options]
      .map((o) => o.value)
      .filter(Boolean);
    expect(baseOptions).toEqual(["s1", "s2", "s3"]);
    expect(revisedOptions).toEqual(["s1", "s2", "s3"]);
  });

  it("tự động điền sẵn khi scope có đúng 2 nguồn", () => {
    render({ scope: ["s1", "s2"] });
    const baseSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-base-select]",
    )!;
    const revisedSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-revised-select]",
    )!;
    expect(baseSelect.value).toBe("s1");
    expect(revisedSelect.value).toBe("s2");
  });

  it("nút hoán đổi (swap) đổi vai trò của 2 nguồn được chọn", () => {
    render({ scope: ["s1", "s2"] });
    const baseSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-base-select]",
    )!;
    const revisedSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-revised-select]",
    )!;
    const swapBtn = q<HTMLButtonElement>("[data-testid=studio-diff-swap]")!;

    expect(baseSelect.value).toBe("s1");
    expect(revisedSelect.value).toBe("s2");

    act(() => {
      swapBtn.click();
    });

    expect(baseSelect.value).toBe("s2");
    expect(revisedSelect.value).toBe("s1");
  });

  it("nút So sánh bị tắt khi chưa chọn đủ 2 nguồn hoặc chọn 2 nguồn trùng nhau", () => {
    render({ scope: [] });
    const submitBtn = q<HTMLButtonElement>("[data-testid=studio-diff-submit]")!;
    const baseSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-base-select]",
    )!;
    const revisedSelect = q<HTMLSelectElement>(
      "[data-testid=studio-diff-revised-select]",
    )!;

    // Ban đầu chưa chọn: disabled
    expect(submitBtn.disabled).toBe(true);

    // Chọn 1 nguồn: disabled
    act(() => {
      baseSelect.value = "s1";
      baseSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(submitBtn.disabled).toBe(true);

    // Chọn cùng 1 nguồn: disabled
    act(() => {
      revisedSelect.value = "s1";
      revisedSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(submitBtn.disabled).toBe(true);

    // Chọn 2 nguồn khác nhau: enabled
    act(() => {
      revisedSelect.value = "s2";
      revisedSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(submitBtn.disabled).toBe(false);
  });

  it("bấm So sánh gửi đúng cặp [bản gốc, bản sửa đổi]", () => {
    const onSubmit = vi.fn();
    render({ scope: ["s1", "s2"], onSubmit });
    const submitBtn = q<HTMLButtonElement>("[data-testid=studio-diff-submit]")!;

    act(() => {
      submitBtn.click();
    });

    expect(onSubmit).toHaveBeenCalledWith(["s1", "s2"]);
  });

  it("hỗ trợ toggle mở/đóng và nhãn ngôn ngữ en/vi", () => {
    render({ defaultOpen: false }, "en");
    const toggleBtn = q<HTMLButtonElement>("[data-testid=studio-diff-toggle]")!;
    expect(toggleBtn.textContent).toContain("Compare documents");
    expect(q("[data-testid=studio-diff-panel]")).toBeNull();

    act(() => {
      toggleBtn.click();
    });
    expect(q("[data-testid=studio-diff-panel]")).not.toBeNull();
    expect(
      q<HTMLButtonElement>("[data-testid=studio-diff-submit]")!.textContent,
    ).toContain("Compare");
  });
});
