// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  AboutDialog,
  SOURCECRAFT_ASCII_ART,
} from "../../src/renderer/features/app-shell/AboutDialog";

describe("AboutDialog UI component", () => {
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

  it("hiển thị banner ASCII, tên app SourceCraft và các thông tin giấy phép/bản quyền", () => {
    const onClose = vi.fn();
    act(() => {
      root.render(
        createElement(AboutDialog, {
          appInfo: { name: "SourceCraft", version: "1.0.1" },
          onClose,
        }),
      );
    });

    const dialog = container.querySelector("[data-testid=about-dialog]");
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");

    const banner = container.querySelector(".about-ascii-banner");
    expect(banner?.textContent).toContain("_____");
    expect(banner?.textContent).toBe(SOURCECRAFT_ASCII_ART);

    const title = container.querySelector(".about-app-title");
    expect(title?.textContent).toContain("SourceCraft");
    expect(title?.textContent).toContain("v1.0.1");

    const closeBtn = container.querySelector<HTMLButtonElement>(
      "[data-testid=about-modal-close]",
    );
    expect(closeBtn).not.toBeNull();
    act(() => {
      closeBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
