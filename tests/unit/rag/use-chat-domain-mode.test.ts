// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { useChat } from "../../../src/renderer/features/rag-qa/useChat";

// 238 — đổi Chuyên ngành / Phạm vi rồi hỏi NGAY phải gửi đúng lựa chọn mới (send không được giữ closure cũ).

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
const flush = (): Promise<void> => act(async () => undefined);

beforeEach(() => {
  api = {
    onRagStreamToken: vi.fn(() => () => undefined),
    onSourceProgress: vi.fn(() => () => undefined),
    ragStop: vi.fn(() => Promise.resolve({ stopped: true })),
    chatHistory: vi.fn(() => Promise.resolve([])),
    aiGetRuntimeStatus: vi.fn(() => Promise.resolve({ ollamaReady: true })),
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
  container = document.createElement("div");
  root = createRoot(container);
});
afterEach(() => act(() => root.unmount()));

describe("useChat — domainMode/scope gửi theo lựa chọn hiện tại", () => {
  let chat: ReturnType<typeof useChat>;
  function Harness(): null {
    chat = useChat("nb1");
    return null;
  }

  const lastInput = (): Record<string, unknown> =>
    (api.ragAskStream.mock.calls.at(-1) as unknown[])[0] as Record<
      string,
      unknown
    >;

  it("chọn Pháp lý rồi hỏi ngay ⇒ ragAskStream nhận domainMode 'legal'", async () => {
    await act(async () => root.render(createElement(Harness)));
    await flush();
    act(() => chat.setDomainMode("legal"));
    await act(async () => void (await chat.send("Điều 5 quy định gì?")));
    expect(lastInput().domainMode).toBe("legal");

    act(() => chat.setDomainMode("medical"));
    await act(async () => void (await chat.send("Liều dùng?")));
    expect(lastInput().domainMode).toBe("medical");
  });

  it("đổi phạm vi rồi hỏi ngay ⇒ ragAskStream nhận scope mới", async () => {
    await act(async () => root.render(createElement(Harness)));
    await flush();
    act(() => chat.setScope("all"));
    await act(async () => void (await chat.send("Tìm toàn kho")));
    expect(lastInput().scope).toBe("all");
  });
});
