import { describe, expect, it, vi } from "vitest";
import {
  LanProvider,
  type LanSettings,
} from "../../../src/main/services/ai-runtime/lan/lan-provider";
import { ChatAbortedError } from "../../../src/main/services/ai-runtime/abort";
import { UserFacingError } from "../../../src/shared/codes/user-error";
import type { LanAiProviderKind } from "../../../src/shared/ipc/types";

// #228 follow-up — LAN AI phải THẬT SỰ trả lời khi bật (trước đây chỉ báo "lan" nhưng chat vẫn đi Ollama/online).

const SETTINGS: LanSettings = {
  baseUrl: "http://192.168.1.50:11434",
  chatModel: "qwen2.5:14b",
  token: "lan-token",
};

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
  } as unknown as Response;
}

function make(
  kind: LanAiProviderKind,
  fetchFn: ReturnType<typeof vi.fn>,
  over: Partial<{
    settings: LanSettings;
    allowedHosts: string[];
    timeoutMs: number;
  }> = {},
) {
  const egress = vi.fn((fn: () => Promise<unknown>) => fn());
  const provider = new LanProvider({
    kind,
    getSettings: () => over.settings ?? SETTINGS,
    getAllowedHosts: () => over.allowedHosts ?? [],
    fetchFn: fetchFn as unknown as typeof fetch,
    egress: egress as <T>(fn: () => Promise<T>) => Promise<T>,
    timeoutMs: over.timeoutMs,
  });
  return { provider, egress };
}

const MSG = { messages: [{ role: "user" as const, content: "Xin chào" }] };

describe("LanProvider — chat", () => {
  it("lan-ollama: gửi /api/chat tới máy chủ LAN với model + Bearer token, trong khoảng egress", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okJson({ message: { content: "Từ LAN" } }));
    const { provider, egress } = make("lan-ollama", fetchFn);

    const res = await provider.chat(MSG);

    expect(provider.id).toBe("lan-ollama");
    expect(res.content).toBe("Từ LAN");
    expect(egress).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://192.168.1.50:11434/api/chat");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer lan-token",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "qwen2.5:14b",
      stream: false,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("lan-openai: gửi /v1/chat/completions và đọc choices[0]", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        okJson({ choices: [{ message: { content: "Từ vLLM" } }] }),
      );
    const { provider } = make("lan-openai", fetchFn, {
      settings: { ...SETTINGS, baseUrl: "http://10.0.0.5:8000/" },
    });

    const res = await provider.chat({ ...MSG, temperature: 0.1 });

    expect(provider.id).toBe("lan-openai");
    expect(res.content).toBe("Từ vLLM");
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://10.0.0.5:8000/v1/chat/completions");
    expect(JSON.parse(init.body as string)).toMatchObject({
      temperature: 0.1,
    });
  });

  it("req.model ghi đè model đã cấu hình (cùng quy ước provider online)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okJson({ message: { content: "x" } }));
    const { provider } = make("lan-ollama", fetchFn);
    await provider.chat({ ...MSG, model: "llama3.1:8b" });
    const body = JSON.parse(
      (fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(body.model).toBe("llama3.1:8b");
  });

  it("onToken có ⇒ gọi 1 lần với toàn bộ nội dung (máy chủ LAN không stream)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okJson({ message: { content: "Toàn văn" } }));
    const { provider } = make("lan-ollama", fetchFn);
    const onToken = vi.fn();
    await provider.chat(MSG, { onToken });
    expect(onToken).toHaveBeenCalledExactlyOnceWith("Toàn văn");
  });

  it("SSRF guard chạy ở MỌI lệnh gọi: URL công cộng ⇒ lanAiInvalidHost, không fetch, không egress", async () => {
    const fetchFn = vi.fn();
    const { provider, egress } = make("lan-ollama", fetchFn, {
      settings: { ...SETTINGS, baseUrl: "http://8.8.8.8:11434" },
    });
    await expect(provider.chat(MSG)).rejects.toMatchObject({
      code: "lanAiInvalidHost",
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(egress).not.toHaveBeenCalled();
  });

  it("allowedLanHosts của policy cho phép tên miền nội bộ riêng", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okJson({ message: { content: "ok" } }));
    const { provider } = make("lan-ollama", fetchFn, {
      settings: { ...SETTINGS, baseUrl: "https://ai.acme.com" },
      allowedHosts: ["*.acme.com"],
    });
    await expect(provider.chat(MSG)).resolves.toEqual({ content: "ok" });
  });

  it("chưa chọn model ⇒ chatModelNotSelected", async () => {
    const fetchFn = vi.fn();
    const { provider } = make("lan-ollama", fetchFn, {
      settings: { ...SETTINGS, chatModel: null },
    });
    await expect(provider.chat(MSG)).rejects.toMatchObject({
      code: "chatModelNotSelected",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("HTTP lỗi ⇒ lanAiHttp kèm mã trạng thái (không lộ thân phản hồi)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({}),
    });
    const { provider } = make("lan-ollama", fetchFn);
    const err = await provider.chat(MSG).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UserFacingError);
    expect(err).toMatchObject({ code: "lanAiHttp", params: { status: 502 } });
  });

  it("lỗi mạng ⇒ lanAiUnreachable", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const { provider } = make("lan-openai", fetchFn);
    await expect(provider.chat(MSG)).rejects.toMatchObject({
      code: "lanAiUnreachable",
    });
  });

  it("hết thời gian chờ ⇒ lanAiTimeout", async () => {
    const fetchFn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );
    const { provider } = make("lan-ollama", fetchFn, { timeoutMs: 5 });
    await expect(provider.chat(MSG)).rejects.toMatchObject({
      code: "lanAiTimeout",
    });
  });

  it("người dùng huỷ (signal) ⇒ ChatAbortedError, không phải timeout", async () => {
    const fetchFn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          );
        }),
    );
    const { provider } = make("lan-ollama", fetchFn);
    const ac = new AbortController();
    const p = provider.chat(MSG, { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toBeInstanceOf(ChatAbortedError);
  });

  it("signal đã huỷ trước khi gọi ⇒ ChatAbortedError, không fetch", async () => {
    const fetchFn = vi.fn();
    const { provider } = make("lan-ollama", fetchFn);
    const ac = new AbortController();
    ac.abort();
    await expect(
      provider.chat(MSG, { signal: ac.signal }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("LanProvider — test / embed / contextTokens", () => {
  it("test(): model có trên máy chủ ⇒ sẵn sàng", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okJson({ models: [{ name: "qwen2.5:14b" }] }));
    const { provider, egress } = make("lan-ollama", fetchFn);
    await expect(provider.test()).resolves.toMatchObject({
      reachable: true,
      ollamaReady: true,
    });
    expect(egress).toHaveBeenCalledTimes(1);
  });

  it("test(): model không có ⇒ modelsMissing", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(okJson({ data: [{ id: "other" }] }));
    const { provider } = make("lan-openai", fetchFn);
    await expect(provider.test()).resolves.toMatchObject({
      reachable: true,
      ollamaReady: false,
      reasonCode: "modelsMissing",
    });
  });

  it("test(): chưa chọn model ⇒ modelsNotSelected", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okJson({ models: [] }));
    const { provider } = make("lan-ollama", fetchFn, {
      settings: { ...SETTINGS, chatModel: null },
    });
    await expect(provider.test()).resolves.toMatchObject({
      reachable: true,
      reasonCode: "modelsNotSelected",
    });
  });

  it("test(): không kết nối được ⇒ unreachable", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const { provider } = make("lan-ollama", fetchFn);
    await expect(provider.test()).resolves.toMatchObject({
      reachable: false,
      ollamaReady: false,
    });
  });

  it("test(): URL bị guard chặn ⇒ unreachable, không fetch", async () => {
    const fetchFn = vi.fn();
    const { provider } = make("lan-ollama", fetchFn, {
      settings: { ...SETTINGS, baseUrl: "http://1.1.1.1" },
    });
    await expect(provider.test()).resolves.toMatchObject({
      reachable: false,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("embed luôn local ⇒ LAN provider từ chối", async () => {
    const { provider } = make("lan-ollama", vi.fn());
    await expect(provider.embed()).rejects.toThrow(/local/i);
  });

  it("contextTokens ⇒ null (dùng ngân sách mặc định)", async () => {
    const { provider } = make("lan-ollama", vi.fn());
    await expect(provider.contextTokens()).resolves.toBeNull();
  });
});
