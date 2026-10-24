import type { RendererErrorInput } from "@shared/ipc/types";

// 088 — báo lỗi renderer về main để ghi nhật ký. CHỈ gửi loại lỗi (Error.name) + componentStack của React,
// KHÔNG message/stack thô (có thể dính nội dung tài liệu người dùng — Constitution III).

/** Loại lỗi an toàn để log: name của Error/DOMException, hoặc kiểu nguyên thuỷ với giá trị khác. */
export function errorTypeOf(err: unknown): string {
  if (err instanceof Error || err instanceof DOMException) return err.name;
  return typeof err;
}

export function reportRendererError(
  source: RendererErrorInput["source"],
  err: unknown,
  componentStack?: string,
): void {
  const input: RendererErrorInput = { source, errorType: errorTypeOf(err) };
  if (componentStack) input.componentStack = componentStack;
  // Báo lỗi thất bại (preload hỏng, IPC đóng) thì không còn kênh nào để báo tiếp — để lại dấu ở console. Bắt cả
  // lỗi ĐỒNG BỘ: ném từ componentDidCatch sẽ biến lỗi báo cáo thành lỗi của chính boundary ⇒ trắng trang.
  const warn = (): void =>
    console.warn("[SourceCraft] renderer.error.reportFailed");
  try {
    window.api.reportRendererError(input).catch(warn);
  } catch {
    warn();
  }
}

/** Bắt lỗi ngoài React (handler sự kiện, setTimeout, promise bị bỏ quên). Trả hàm gỡ. */
export function installGlobalErrorReporting(target: Window): () => void {
  // ErrorEvent không kèm error (VD "ResizeObserver loop…", lỗi script khác nguồn) là cảnh báo vô hại của trình
  // duyệt, bắn liên tục khi đổi kích thước — bỏ qua để không chiếm hạn mức báo lỗi thật.
  const onError = (e: ErrorEvent): void => {
    if (e.error == null) return;
    reportRendererError("window", e.error);
  };
  const onRejection = (e: PromiseRejectionEvent): void =>
    reportRendererError("rejection", e.reason);
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
