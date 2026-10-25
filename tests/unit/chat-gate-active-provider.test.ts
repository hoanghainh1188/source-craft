// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useChat } from "../../src/renderer/features/rag-qa/useChat";
import { tagOnlineError } from "../../src/shared/online-error-tag";

// Cổng gửi của Chat theo provider SẼ trả lời (LAN/online), không theo riêng Ollama cục bộ; "AI cục bộ" (098) vẫn cần Ollama.

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
const flush = (): Promise<void> => act(async () => undefined);

function setup(status: Record<string, unknown>): void {
  api = {
    onRagStreamToken: vi.fn(() => () => undefined),
    onSourceProgress: vi.fn(() => () => undefined),
    ragStop: vi.fn(() => Promise.resolve({ stopped: true })),
    chatHistory: vi.fn(() => Promise.resolve([])),
    chatClear: vi.fn(() => Promise.resolve({ cleared: true })),
    aiGetRuntimeStatus: vi.fn(() => Promise.resolve(status)),
    sourceListByNotebook: vi.fn(() =>
      Promise.resolve([{ id: "s1", status: "ready", title: "a" }]),
    ),
    ragAskStream: vi.fn(() =>
      Promise.resolve({
        answer: "Trả lời [1]",
        citations: [],
        notFound: false,
        modeUsed: "grounded",
      }),
    ),
  };
  (window as unknown as { api: unknown }).api = api;
}

let chat: ReturnType<typeof useChat>;
function Harness(): null {
  chat = useChat("nb1");
  return null;
}

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe("useChat — cổng theo provider đang bật", () => {
  it("chỉ có máy chủ LAN (không Ollama cục bộ) ⇒ gửi được", async () => {
    setup({
      reachable: false,
      ollamaReady: false,
      reason: "Ollama unreachable.",
      activeProviderId: "lan-ollama",
      activeReady: true,
    });
    await act(async () => root.render(createElement(Harness)));
    await flush();
    expect(chat.runtimeReady).toBe(true);
    expect(chat.canSend).toBe(true);
    await act(async () => void (await chat.send("Q")));
    expect(api.ragAskStream).toHaveBeenCalledTimes(1);
  });

  it("LAN đang bật nhưng chưa sẵn sàng ⇒ chặn dù Ollama cục bộ chạy", async () => {
    setup({
      reachable: true,
      ollamaReady: true,
      reason: null,
      activeProviderId: "lan-openai",
      activeReady: false,
    });
    await act(async () => root.render(createElement(Harness)));
    await flush();
    expect(chat.canSend).toBe(false);
    await act(async () => void (await chat.send("Q")));
    expect(api.ragAskStream).not.toHaveBeenCalled();
  });

  it("online sẵn sàng, Ollama không ⇒ gửi được; lỗi online rồi bấm 'AI cục bộ' ⇒ báo AI cục bộ chưa sẵn sàng", async () => {
    setup({
      reachable: false,
      ollamaReady: false,
      reason: null,
      activeProviderId: "anthropic",
      activeReady: true,
    });
    api.ragAskStream.mockImplementationOnce(() =>
      Promise.reject(
        new Error(
          `Error invoking remote method 'rag:askStream': Error: ${tagOnlineError("Claude: lỗi.", "rate-limit")}`,
        ),
      ),
    );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    expect(chat.failedTurn).toEqual({ question: "Q" });
    await act(async () => void (await chat.retryFailed("local")));
    expect(api.ragAskStream).toHaveBeenCalledTimes(1);
    expect(chat.error).toEqual({ kind: "localNotReady" });
  });

  it("online sẵn sàng + Ollama chạy ⇒ 'AI cục bộ' hỏi lại với target local", async () => {
    setup({
      reachable: true,
      ollamaReady: true,
      reason: null,
      activeProviderId: "anthropic",
      activeReady: true,
    });
    api.ragAskStream.mockImplementationOnce(() =>
      Promise.reject(
        new Error(
          `Error invoking remote method 'rag:askStream': Error: ${tagOnlineError("Claude: lỗi.", "rate-limit")}`,
        ),
      ),
    );
    await act(async () => root.render(createElement(Harness)));
    await flush();
    await act(async () => void (await chat.send("Q")));
    await act(async () => void (await chat.retryFailed("local")));
    const second = (api.ragAskStream.mock.calls[1] as unknown[])[0] as {
      target?: string;
    };
    expect(second.target).toBe("local");
  });
});
