import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRuntimeStatusStore } from "../../src/renderer/features/ai-runtime/runtime-status-store";
import type { RuntimeStatus } from "../../src/shared/ipc/types";

// #135: một trạng thái runtime dùng chung (banner, Cài đặt, Chat, Studio) + tự kiểm tra lại khi CHƯA sẵn sàng.

const NOT: RuntimeStatus = {
  reachable: false,
  ollamaReady: false,
  reason: "Ollama unreachable.",
  reasonCode: "ollamaUnreachable",
};
const READY: RuntimeStatus = {
  reachable: true,
  ollamaReady: true,
  reason: null,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("createRuntimeStatusStore", () => {
  it("đăng ký đầu tiên ⇒ đọc trạng thái; mọi listener nhận cùng snapshot", async () => {
    const read = vi.fn().mockResolvedValue(READY);
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    const a = vi.fn();
    const b = vi.fn();
    s.subscribe(a);
    s.subscribe(b);
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
    expect(s.getSnapshot().status).toEqual(READY);
    expect(s.getSnapshot().loading).toBe(false);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it("chưa sẵn sàng ⇒ tự kiểm tra lại theo chu kỳ; sẵn sàng ⇒ dừng", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(NOT)
      .mockResolvedValueOnce(NOT)
      .mockResolvedValue(READY);
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    s.subscribe(() => undefined);
    await flush();
    expect(s.getSnapshot().status?.ollamaReady).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(s.getSnapshot().status?.ollamaReady).toBe(true);
    await vi.advanceTimersByTimeAsync(20000);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("cửa sổ ẩn ⇒ bỏ lượt kiểm tra (vẫn hẹn lượt sau)", async () => {
    let hidden = true;
    const read = vi.fn().mockResolvedValue(NOT);
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => hidden,
    });
    s.subscribe(() => undefined);
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    expect(read).toHaveBeenCalledTimes(1);
    hidden = false;
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("hết listener ⇒ dừng hẹn giờ", async () => {
    const read = vi.fn().mockResolvedValue(NOT);
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    const off = s.subscribe(() => undefined);
    await flush();
    off();
    await vi.advanceTimersByTimeAsync(20000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("refresh() thủ công cập nhật mọi nơi; IPC lỗi ⇒ readFailed, không ném", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce(NOT)
      .mockRejectedValueOnce(new Error("x"));
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    s.subscribe(() => undefined);
    await flush();
    s.refresh();
    await flush();
    expect(s.getSnapshot().readFailed).toBe(true);
    expect(s.getSnapshot().status?.ollamaReady).toBe(false);
  });

  it("lượt đọc cũ về sau lượt mới ⇒ bỏ (không ghi đè trạng thái mới hơn)", async () => {
    let resolveOld: (s: RuntimeStatus) => void = () => undefined;
    const read = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<RuntimeStatus>((r) => (resolveOld = r)),
      )
      .mockResolvedValueOnce(READY);
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    s.subscribe(() => undefined);
    s.refresh();
    await flush();
    resolveOld(NOT);
    await flush();
    expect(s.getSnapshot().status).toEqual(READY);
  });

  it("Chat sẵn sàng qua provider đang bật (LAN) dù Ollama không chạy ⇒ dừng tự kiểm tra (không ping LAN mỗi 5s)", async () => {
    const LAN_READY: RuntimeStatus = {
      ...NOT,
      activeProviderId: "lan-ollama",
      activeReady: true,
    };
    const read = vi.fn().mockResolvedValue(LAN_READY);
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    s.subscribe(() => undefined);
    await flush();
    await vi.advanceTimersByTimeAsync(20000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("Ollama chạy nhưng provider đang bật chưa sẵn sàng ⇒ vẫn tự kiểm tra lại", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        ...READY,
        activeProviderId: "lan-ollama",
        activeReady: false,
      })
      .mockResolvedValue({
        ...READY,
        activeProviderId: "lan-ollama",
        activeReady: true,
      });
    const s = createRuntimeStatusStore(read, {
      intervalMs: 5000,
      isHidden: () => false,
    });
    s.subscribe(() => undefined);
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20000);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
