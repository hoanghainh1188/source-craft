// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { AuditStatusChip } from "../../../src/renderer/features/audit-status/AuditStatusChip";
import { AuditSettingsSection } from "../../../src/renderer/features/audit-status/AuditSettingsSection";
import { I18nProvider } from "../../../src/renderer/shared/i18n/I18nProvider";
import type { AuditStatus } from "../../../src/shared/ipc/types";

// 236 (PR C) — chip + mục Cài đặt đọc trạng thái từ main rồi đổi theo sự kiện đẩy; mục Cài đặt không có điều khiển.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let push: (s: AuditStatus) => void = () => undefined;
const off = vi.fn();

function mockApi(initial: AuditStatus | Error): void {
  (window as unknown as { api: unknown }).api = {
    getUiLanguage: () => Promise.resolve({ language: "vi", source: "user" }),
    onUiLanguageChanged: () => () => undefined,
    auditGetStatus: () =>
      initial instanceof Error
        ? Promise.reject(initial)
        : Promise.resolve(initial),
    onAuditStatusChanged: (cb: (s: AuditStatus) => void) => {
      push = cb;
      return off;
    },
  };
}

async function render(el: () => JSX.Element | null): Promise<void> {
  await act(async () =>
    root.render(createElement(I18nProvider, null, createElement(el))),
  );
}

const q = (id: string): HTMLElement | null =>
  container.querySelector(`[data-testid=${id}]`);

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
  off.mockClear();
});
afterEach(() => act(() => root.unmount()));

describe("AuditStatusChip", () => {
  it("active ⇒ hiện chip + tooltip gắn aria-describedby; blocked ⇒ cảnh báo; off ⇒ ẩn", async () => {
    mockApi({ state: "active", organization: "Công ty A" });
    await render(AuditStatusChip);
    const chip = q("audit-status-chip")!;
    expect(chip.dataset.state).toBe("active");
    expect(chip.tabIndex).toBe(0);
    const tip = container.querySelector("[role=tooltip]")!;
    expect(chip.getAttribute("aria-describedby")).toBe(tip.id);
    expect(tip.textContent).toContain("Câu trả lời không được ghi");

    await act(async () => push({ state: "blocked", reason: "writeFailed" }));
    expect(q("audit-status-chip")!.className).toContain("audit-chip--warn");
    expect(q("audit-status-chip")!.textContent).toContain("AI tạm khoá");

    await act(async () => push({ state: "licenseInactive" }));
    expect(q("audit-status-chip")).toBeNull();
  });

  it("IPC lỗi ⇒ không hiện chip; unmount huỷ đăng ký", async () => {
    mockApi(new Error("ipc"));
    await render(AuditStatusChip);
    expect(q("audit-status-chip")).toBeNull();
    await act(async () => root.unmount());
    expect(off).toHaveBeenCalledTimes(1);
    root = createRoot(container);
  });
});

describe("AuditSettingsSection", () => {
  it("active ⇒ trạng thái, tổ chức, nhãn vị trí; không có nút/ô nhập", async () => {
    mockApi({
      state: "active",
      organization: "Công ty A",
      directoryKind: "custom",
    });
    await render(AuditSettingsSection);
    expect(q("settings-audit-state")!.textContent).toBe("Đang ghi");
    expect(q("settings-audit-org")!.textContent).toBe("Công ty A");
    expect(q("settings-audit-directory")!.textContent).toBe(
      "Do bộ phận IT chỉ định",
    );
    expect(q("settings-audit-reason")).toBeNull();
    const section = q("settings-audit-section")!;
    expect(
      section.querySelectorAll("button, input, select, textarea"),
    ).toHaveLength(0);
  });

  it("policyError ⇒ hiện lý do; off không tổ chức ⇒ ẩn mục", async () => {
    mockApi({ state: "policyError", reason: "invalidAuditPublicKey" });
    await render(AuditSettingsSection);
    expect(q("settings-audit-reason")!.textContent).toBe(
      "Khoá công khai của tổ chức không hợp lệ",
    );
    expect(q("settings-audit-directory")).toBeNull();
    await act(async () => push({ state: "off" }));
    expect(q("settings-audit-section")).toBeNull();
  });
});

describe("AuditStatusChip — a11y + thứ tự sự kiện", () => {
  it("role=note; Esc ẩn tooltip, blur hiện lại", async () => {
    mockApi({ state: "active" });
    await render(AuditStatusChip);
    const chip = q("audit-status-chip")!;
    expect(chip.getAttribute("role")).toBe("note");
    await act(async () => {
      chip.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(q("audit-status-chip")!.className).toContain("is-dismissed");
    await act(async () => {
      chip.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(q("audit-status-chip")!.className).not.toContain("is-dismissed");
  });

  it("sự kiện đẩy tới trước khi invoke trả về ⇒ giữ giá trị đẩy", async () => {
    let resolveInvoke: (s: AuditStatus) => void = () => undefined;
    (window as unknown as { api: unknown }).api = {
      auditGetStatus: () =>
        new Promise<AuditStatus>((r) => (resolveInvoke = r)),
      onAuditStatusChanged: (cb: (s: AuditStatus) => void) => {
        push = cb;
        return off;
      },
    };
    await render(AuditStatusChip);
    await act(async () => push({ state: "blocked", reason: "writeFailed" }));
    await act(async () => resolveInvoke({ state: "active" }));
    expect(q("audit-status-chip")!.dataset.state).toBe("blocked");
  });
});
