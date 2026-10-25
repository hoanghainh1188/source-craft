import type { RuntimeStatus } from "@shared/ipc/types";

// #135: MỘT trạng thái runtime AI dùng chung cho banner onboarding, Cài đặt, Chat, Studio — trước đây mỗi nơi tự đọc
// một lần khi mount, nên Ollama bật sau khi mở app (hoặc "Kiểm tra lại" ở banner) không gỡ chặn Chat/Studio. Khi CHƯA
// sẵn sàng: tự kiểm tra lại mỗi intervalMs (chỉ gọi localhost qua main — không egress), bỏ lượt khi cửa sổ ẩn, dừng
// khi sẵn sàng hoặc không còn nơi nào theo dõi.

export interface RuntimeStatusSnapshot {
  status: RuntimeStatus | null;
  /** IPC đọc trạng thái lỗi (nơi hiển thị dịch "ai.runtime.statusUnreadable"). */
  readFailed: boolean;
  loading: boolean;
}

export interface RuntimeStatusStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): RuntimeStatusSnapshot;
  refresh(): void;
}

export interface RuntimeStatusStoreOptions {
  intervalMs: number;
  isHidden: () => boolean;
}

/** Chat gửi được qua provider đang bật (main điền activeReady; main cũ ⇒ ollamaReady). */
export function isChatReady(status: RuntimeStatus | null): boolean {
  if (!status) return false;
  return status.activeReady ?? status.ollamaReady;
}

const UNREADABLE: RuntimeStatus = {
  reachable: false,
  ollamaReady: false,
  reason: null,
};

export function createRuntimeStatusStore(
  read: () => Promise<RuntimeStatus>,
  opts: RuntimeStatusStoreOptions,
): RuntimeStatusStore {
  let snapshot: RuntimeStatusSnapshot = {
    status: null,
    readFailed: false,
    loading: true,
  };
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;

  const emit = (next: RuntimeStatusSnapshot): void => {
    snapshot = next;
    listeners.forEach((l) => l());
  };

  const stopTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (): void => {
    stopTimer();
    // Dừng khi Chat đã gửi được (provider đang bật sẵn sàng) — máy chỉ có LAN không bị ping lại mỗi chu kỳ.
    if (listeners.size === 0 || isChatReady(snapshot.status)) return;
    timer = setTimeout(() => {
      timer = null;
      if (opts.isHidden()) schedule();
      else refresh();
    }, opts.intervalMs);
  };

  const refresh = (): void => {
    const mine = ++seq;
    if (!snapshot.loading) emit({ ...snapshot, loading: true });
    read()
      .then((status) => ({ status, readFailed: false }))
      .catch(() => ({ status: UNREADABLE, readFailed: true }))
      .then((r) => {
        if (mine !== seq) return; // đã có lượt đọc mới hơn
        emit({ ...r, loading: false });
        schedule();
      });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) refresh();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stopTimer();
      };
    },
    getSnapshot: () => snapshot,
    refresh,
  };
}

/** Kho dùng chung của app (IPC đọc qua preload). */
export const runtimeStatusStore = createRuntimeStatusStore(
  () => window.api.aiGetRuntimeStatus(),
  {
    intervalMs: 5000,
    isHidden: () =>
      typeof document !== "undefined" && document.visibilityState === "hidden",
  },
);
