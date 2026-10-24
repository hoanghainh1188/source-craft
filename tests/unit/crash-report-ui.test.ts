// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { CrashReportDialog } from "../../src/renderer/shared/crash-report/CrashReportDialog";
import { CrashNoticeBanner } from "../../src/renderer/features/crash-report/CrashNoticeBanner";

// 093 — UI báo lỗi: xem trước & SỬA bản nháp, gửi đúng nội dung đã sửa qua kênh mở issue (đích cố định ở main);
// thông báo lúc mở app khi phiên trước đóng bất thường (bỏ qua được).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;

const flush = (): Promise<void> => act(async () => undefined);
const q = <T extends Element>(sel: string): T =>
  container.querySelector<T>(sel)!;
const btn = (text: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(text),
  ) as HTMLButtonElement;

function setValue(el: HTMLTextAreaElement | HTMLInputElement, v: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  api = {
    crashGetReport: vi.fn(() =>
      Promise.resolve({
        title: "Báo lỗi: SourceCraft 0.2.4",
        text: "### Môi trường",
      }),
    ),
    crashOpenIssue: vi.fn(() => Promise.resolve({ ok: true })),
    crashGetNotice: vi.fn(() =>
      Promise.resolve({ abnormalExit: true, newNativeCrashes: 0 }),
    ),
    crashDismissNotice: vi.fn(() => Promise.resolve({ ok: true })),
    clipboardWrite: vi.fn(() => Promise.resolve({ ok: true })),
  };
  (window as unknown as { api: unknown }).api = api;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("CrashReportDialog", () => {
  it("hiện bản nháp, gửi đúng nội dung người dùng đã sửa, báo đã mở trình duyệt", async () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(CrashReportDialog, { onClose })));
    await flush();
    const dialog = q("[role=dialog]");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const text = q<HTMLTextAreaElement>("[data-testid=crash-text]");
    expect(text.value).toBe("### Môi trường");
    expect(container.textContent).toContain("không tự gửi");
    act(() => setValue(text, "### Môi trường\nĐã sửa"));
    await act(async () => btn("Mở GitHub").click());
    expect(api.crashOpenIssue).toHaveBeenCalledWith({
      title: "Báo lỗi: SourceCraft 0.2.4",
      text: "### Môi trường\nĐã sửa",
    });
    expect(q("[data-testid=crash-sent]").textContent).toContain(
      "Đã mở trình duyệt",
    );
  });

  it("gõ vào ô nội dung không làm focus nhảy đi", async () => {
    act(() =>
      root.render(
        createElement(CrashReportDialog, { onClose: () => undefined }),
      ),
    );
    await flush();
    const text = q<HTMLTextAreaElement>("[data-testid=crash-text]");
    act(() => text.focus());
    act(() => setValue(text, "a"));
    act(() => setValue(text, "ab"));
    expect(document.activeElement).toBe(text);
  });

  it("Sao chép ⇒ tiêu đề + nội dung qua clipboard của main", async () => {
    act(() =>
      root.render(
        createElement(CrashReportDialog, { onClose: () => undefined }),
      ),
    );
    await flush();
    await act(async () => btn("Sao chép").click());
    expect(api.clipboardWrite).toHaveBeenCalledWith(
      "Báo lỗi: SourceCraft 0.2.4\n\n### Môi trường",
    );
  });

  it("mở trình duyệt thất bại ⇒ báo lỗi, gợi ý Sao chép", async () => {
    api.crashOpenIssue.mockImplementationOnce(() =>
      Promise.resolve({ ok: false }),
    );
    act(() =>
      root.render(
        createElement(CrashReportDialog, { onClose: () => undefined }),
      ),
    );
    await flush();
    await act(async () => btn("Mở GitHub").click());
    expect(q("[role=alert]").textContent).toContain("Sao chép");
  });

  it("bị giới hạn tần suất ⇒ báo đợi vài giây (không phải lỗi trình duyệt)", async () => {
    api.crashOpenIssue.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, throttled: true }),
    );
    act(() =>
      root.render(
        createElement(CrashReportDialog, { onClose: () => undefined }),
      ),
    );
    await flush();
    await act(async () => btn("Mở GitHub").click());
    expect(q("[role=alert]").textContent).toContain("đợi vài giây");
  });

  it("sao chép lỗi ⇒ thông báo riêng của sao chép", async () => {
    api.clipboardWrite.mockImplementationOnce(() =>
      Promise.reject(new Error("x")),
    );
    act(() =>
      root.render(
        createElement(CrashReportDialog, { onClose: () => undefined }),
      ),
    );
    await flush();
    await act(async () => btn("Sao chép").click());
    expect(q("[role=alert]").textContent).toContain("Không sao chép được");
  });

  it("đang gửi ⇒ Huỷ/Escape không đóng hộp thoại", async () => {
    let finish: (v: unknown) => void = () => undefined;
    api.crashOpenIssue.mockImplementationOnce(
      () => new Promise((r) => (finish = r)),
    );
    const onClose = vi.fn();
    act(() => root.render(createElement(CrashReportDialog, { onClose })));
    await flush();
    await act(async () => btn("Mở GitHub").click());
    act(() => btn("Huỷ").click());
    act(() =>
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish({ ok: true }));
    act(() => btn("Đóng").click());
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("Huỷ ⇒ onClose(false)", async () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(CrashReportDialog, { onClose })));
    await flush();
    act(() => btn("Huỷ").click());
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it("không soạn được bản nháp ⇒ báo lỗi", async () => {
    api.crashGetReport.mockImplementationOnce(() =>
      Promise.reject(new Error("x")),
    );
    act(() =>
      root.render(
        createElement(CrashReportDialog, { onClose: () => undefined }),
      ),
    );
    await flush();
    expect(q("[role=alert]").textContent).toContain("Không soạn được");
  });
});

describe("CrashNoticeBanner", () => {
  it("phiên trước đóng bất thường ⇒ hiện, Bỏ qua ⇒ ghi nhận và ẩn", async () => {
    act(() => root.render(createElement(CrashNoticeBanner)));
    await flush();
    expect(q("[data-testid=crash-notice]").textContent).toContain(
      "đóng bất thường",
    );
    await act(async () => btn("Bỏ qua").click());
    expect(api.crashDismissNotice).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-testid=crash-notice]")).toBeNull();
  });

  it("có crash native mới ⇒ nêu số lần", async () => {
    api.crashGetNotice.mockImplementationOnce(() =>
      Promise.resolve({ abnormalExit: false, newNativeCrashes: 2 }),
    );
    act(() => root.render(createElement(CrashNoticeBanner)));
    await flush();
    expect(q("[data-testid=crash-notice]").textContent).toContain("2 lần");
  });

  it("không có gì ⇒ không hiện", async () => {
    api.crashGetNotice.mockImplementationOnce(() =>
      Promise.resolve({ abnormalExit: false, newNativeCrashes: 0 }),
    );
    act(() => root.render(createElement(CrashNoticeBanner)));
    await flush();
    expect(container.querySelector("[data-testid=crash-notice]")).toBeNull();
  });

  it("mở hộp thoại rồi Huỷ ⇒ dải thông báo VẪN còn, không ghi nhận", async () => {
    act(() => root.render(createElement(CrashNoticeBanner)));
    await flush();
    await act(async () => btn("Xem & gửi").click());
    await flush();
    act(() => btn("Huỷ").click());
    expect(api.crashDismissNotice).not.toHaveBeenCalled();
    expect(
      container.querySelector("[data-testid=crash-notice]"),
    ).not.toBeNull();
  });

  it("gửi xong ⇒ dải thông báo ẩn (main đã ghi nhận khi mở issue)", async () => {
    act(() => root.render(createElement(CrashNoticeBanner)));
    await flush();
    await act(async () => btn("Xem & gửi").click());
    await flush();
    await act(async () => btn("Mở GitHub").click());
    act(() => btn("Đóng").click());
    expect(container.querySelector("[data-testid=crash-notice]")).toBeNull();
  });

  it("Xem & gửi ⇒ mở hộp thoại báo lỗi", async () => {
    act(() => root.render(createElement(CrashNoticeBanner)));
    await flush();
    await act(async () => btn("Xem & gửi").click());
    await flush();
    expect(container.querySelector("[role=dialog]")).not.toBeNull();
  });
});
