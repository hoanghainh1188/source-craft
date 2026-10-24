import { describe, it, expect, vi } from "vitest";
import {
  createOllamaClient,
  inferKind,
  resolveBaseUrl,
  DEFAULT_OLLAMA_URL,
} from "../../src/main/services/ai-runtime/ollama-client";
import { getPrivacyState } from "../../src/main/services/app-shell/privacy-state";

// fetch giả trả về Response-like tối thiểu.
function fakeFetch(
  handler: (url: string, init?: RequestInit) => unknown,
  ok = true,
  status = 200,
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const body = handler(url, init);
    return { ok, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("ollama-client", () => {
  it("inferKind: tên chứa 'embed' → embedding, còn lại → chat", () => {
    expect(inferKind("nomic-embed-text")).toBe("embedding");
    expect(inferKind("qwen2.5:7b")).toBe("chat");
  });

  it("listModels parse /api/tags → Model[]", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({
        models: [
          { name: "qwen2.5:7b", size: 4700000000 },
          { name: "nomic-embed-text", size: 274000000 },
        ],
      })),
    });
    const models = await c.listModels();
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ name: "qwen2.5:7b", kind: "chat" });
    expect(models[1].kind).toBe("embedding");
  });

  it("listModels khi fetch ném → [] (không throw)", async () => {
    const c = createOllamaClient({
      fetchFn: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    expect(await c.listModels()).toEqual([]);
  });

  it("ping true khi ok; false khi ném", async () => {
    const ok = createOllamaClient({ fetchFn: fakeFetch(() => ({})) });
    expect(await ok.ping()).toBe(true);
    const down = createOllamaClient({
      fetchFn: vi.fn(async () => {
        throw new Error("down");
      }) as unknown as typeof fetch,
    });
    expect(await down.ping()).toBe(false);
  });

  it("chat parse message.content", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({ message: { content: "xin chào" } })),
    });
    expect(
      await c.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).toEqual({
      content: "xin chào",
    });
  });

  it("embed parse embedding vector", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({ embedding: [0.1, 0.2, 0.3] })),
    });
    expect(await c.embed({ text: "abc" })).toEqual({ vector: [0.1, 0.2, 0.3] });
  });

  it("chat/embed ném khi res.ok=false (Ollama trả lỗi)", async () => {
    const c = createOllamaClient({
      fetchFn: fakeFetch(() => ({}), false, 500),
    });
    await expect(
      c.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/ollamaHttp/);
    await expect(c.embed({ text: "abc" })).rejects.toThrow(/ollamaHttp/);
  });

  it("chat/embed ném khi fetch reject (abort/timeout / mất kết nối)", async () => {
    const c = createOllamaClient({
      fetchFn: vi.fn(async () => {
        throw new Error("AbortError");
      }) as unknown as typeof fetch,
    });
    await expect(c.chat({ messages: [] })).rejects.toThrow();
    await expect(c.embed({ text: "x" })).rejects.toThrow();
  });
});

describe("resolveBaseUrl (Constitution I: chỉ localhost)", () => {
  it("localhost / 127.0.0.1 (mọi port) được chấp nhận", () => {
    expect(resolveBaseUrl("http://localhost:11434").url).toBe(
      "http://localhost:11434",
    );
    expect(resolveBaseUrl("http://127.0.0.1:1").url).toBe("http://127.0.0.1:1");
    expect(resolveBaseUrl("http://127.0.0.1:11434").warning).toBeNull();
  });

  it("host ngoài localhost → fallback default + warning", () => {
    const r = resolveBaseUrl("http://evil.example.com:11434");
    expect(r.url).toBe(DEFAULT_OLLAMA_URL);
    expect(r.warning).toMatch(/localhost/i);
  });

  it("URL không hợp lệ → fallback default", () => {
    expect(resolveBaseUrl("not a url").url).toBe(DEFAULT_OLLAMA_URL);
  });

  it("không set env → default, không warning", () => {
    expect(resolveBaseUrl(undefined)).toEqual({
      url: DEFAULT_OLLAMA_URL,
      warning: null,
    });
  });

  it("explicit baseUrl ưu tiên hơn env", () => {
    expect(resolveBaseUrl("http://localhost:1", "http://127.0.0.1:2").url).toBe(
      "http://127.0.0.1:2",
    );
  });

  it("105: numCtx ⇒ gửi options.num_ctx; không có ⇒ không gửi options", async () => {
    const bodies: Record<string, unknown>[] = [];
    const c = createOllamaClient({
      fetchFn: fakeFetch((u, init) => {
        if (u.endsWith("/api/chat"))
          bodies.push(JSON.parse(String(init?.body)));
        return { message: { content: "ok" } };
      }),
    });
    await c.chat({ model: "m", messages: [], numCtx: 16384 });
    await c.chat({ model: "m", messages: [] });
    expect(bodies[0].options).toEqual({ num_ctx: 16384 });
    // gửi cả model + name cho /api/show (Ollama bản cũ dùng 'name') — kiểm ở test contextLength
    expect(bodies[1].options).toBeUndefined();
  });

  it("105: contextLength đọc /api/show; lỗi ⇒ null", async () => {
    const ok = createOllamaClient({
      fetchFn: fakeFetch(() => ({
        model_info: {
          "general.architecture": "qwen2",
          "qwen2.context_length": 32768,
        },
      })),
    });
    expect(await ok.contextLength("qwen2.5:7b")).toBe(32768);
    const bad = createOllamaClient({
      fetchFn: fakeFetch(() => ({}), false, 404),
    });
    expect(await bad.contextLength("x")).toBeNull();
  });

  it("103: chat stream qua Ollama (localhost) KHÔNG bật badge 'đang gửi ra ngoài'", async () => {
    const seen: string[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(
          new TextEncoder().encode(
            JSON.stringify({ message: { content: "xin chào" }, done: false }) +
              "\n",
          ),
        );
        c.close();
      },
    });
    const c = createOllamaClient({
      fetchFn: (async () =>
        new Response(body, { status: 200 })) as unknown as typeof fetch,
    });
    await c.chat(
      { messages: [{ role: "user", content: "hi" }] },
      { onToken: () => seen.push(getPrivacyState().mode) },
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((m) => m === "local")).toBe(true);
  });

  it("105: lượt có numCtx (prompt lớn) dùng timeout dài; contextLength gửi cả model + name", async () => {
    const seen: string[] = [];
    const c = createOllamaClient({
      chatTimeoutMs: 1,
      fetchFn: fakeFetch((u, init) => {
        if (!u.endsWith("/api/show") || seen.length > 0)
          seen.push(String(init?.body));
        return { message: { content: "ok" } };
      }),
    });
    // timeout 1ms nhưng lượt numCtx dùng LARGE_CHAT_TIMEOUT_MS ⇒ không bị huỷ
    await expect(
      c.chat({ model: "m", messages: [], numCtx: 8192 }),
    ).resolves.toEqual({ content: "ok" });
    await c.contextLength("qwen");
    expect(JSON.parse(seen[1])).toEqual({ model: "qwen", name: "qwen" });
  });
});

// 149 (research R3/R4): nhánh KHÔNG-stream tôn trọng signal ngoài — huỷ ⇒ ChatAbortedError (≠ lỗi HTTP / timeout), kể cả khi đang đọc body.
import { ChatAbortedError } from "../../src/main/services/ai-runtime/abort";

describe("ollama-client — huỷ nhánh không-stream (149)", () => {
  const abortErr = (): Error =>
    Object.assign(new Error("aborted"), { name: "AbortError" });

  /** fetch giả: treo tới khi signal abort (hoặc trả body treo nếu `hangBody`). */
  const hangingFetch = (hangBody = false) =>
    vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const sig = init!.signal!;
          if (!hangBody) {
            sig.addEventListener("abort", () => reject(abortErr()));
            return;
          }
          resolve({
            ok: true,
            status: 200,
            json: () =>
              new Promise((_r, rej) =>
                sig.addEventListener("abort", () => rej(abortErr())),
              ),
          } as unknown as Response);
        }),
    );

  it("abort khi đang chờ phản hồi ⇒ ChatAbortedError", async () => {
    const c = createOllamaClient({ fetchFn: hangingFetch() });
    const outer = new AbortController();
    const p = c.chat({ messages: [] }, { signal: outer.signal });
    outer.abort();
    await expect(p).rejects.toBeInstanceOf(ChatAbortedError);
  });

  it("abort khi đang đọc body ⇒ ChatAbortedError", async () => {
    const c = createOllamaClient({ fetchFn: hangingFetch(true) });
    const outer = new AbortController();
    const p = c.chat({ messages: [] }, { signal: outer.signal });
    await new Promise((r) => setTimeout(r, 0));
    outer.abort();
    await expect(p).rejects.toBeInstanceOf(ChatAbortedError);
  });

  it("signal đã abort trước khi gọi ⇒ ChatAbortedError, không gọi fetch", async () => {
    const fetchFn = hangingFetch();
    const c = createOllamaClient({ fetchFn });
    const outer = new AbortController();
    outer.abort();
    await expect(
      c.chat({ messages: [] }, { signal: outer.signal }),
    ).rejects.toBeInstanceOf(ChatAbortedError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("timeout nội bộ (không huỷ) ⇒ KHÔNG phải ChatAbortedError", async () => {
    const c = createOllamaClient({
      fetchFn: hangingFetch(),
      chatTimeoutMs: 10,
    });
    const err = await c.chat({ messages: [] }).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ChatAbortedError);
  });
});

// Model "thinking" (qwen3.x, gpt-oss…): Ollama tự bật suy luận khi không gửi `think` — đo qwen3.5:9b: 76s/3.606 token
// cho 1 lượt viết lại câu hỏi so với 0,55s khi tắt. Dò capabilities qua /api/show, tắt cho model có 'thinking'.
import { thinkSettingFor } from "../../src/main/services/ai-runtime/ollama-client";

describe("ollama-client — tắt thinking theo capabilities", () => {
  const show = (capabilities: string[] | undefined, arch = "qwen3_5") => ({
    ...(capabilities ? { capabilities } : {}),
    model_info: { "general.architecture": arch },
  });

  /** fetch giả: /api/show trả `showBody`, /api/chat ghi body + trả lời. */
  function recordingFetch(showBody: unknown, showOk = true) {
    const chatBodies: Record<string, unknown>[] = [];
    const showCalls: string[] = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/show")) {
        showCalls.push(String(init?.body));
        return {
          ok: showOk,
          status: showOk ? 200 : 404,
          json: async () => showBody,
        } as unknown as Response;
      }
      chatBodies.push(JSON.parse(String(init?.body)));
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: { content: "ok" } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    return { fetchFn, chatBodies, showCalls };
  }

  it("thinkSettingFor: có 'thinking' ⇒ false; gpt-oss ⇒ 'low'; không có/không rõ ⇒ undefined", () => {
    expect(thinkSettingFor(show(["completion", "thinking"]))).toBe(false);
    expect(thinkSettingFor(show(["completion", "thinking"], "gpt-oss"))).toBe(
      "low",
    );
    expect(thinkSettingFor(show(["completion", "tools"]))).toBeUndefined();
    expect(thinkSettingFor(show(undefined))).toBeUndefined();
    expect(thinkSettingFor(null)).toBeUndefined();
    expect(thinkSettingFor({ capabilities: "thinking" })).toBeUndefined();
  });

  it("model có 'thinking' ⇒ gửi think:false (không-stream)", async () => {
    const r = recordingFetch(show(["completion", "thinking"]));
    const c = createOllamaClient({ fetchFn: r.fetchFn });
    await c.chat({ model: "qwen3.5:9b", messages: [] });
    expect(r.chatBodies[0].think).toBe(false);
  });

  it("gpt-oss (không tắt hẳn được) ⇒ gửi think:'low'", async () => {
    const r = recordingFetch(show(["completion", "thinking"], "gpt-oss"));
    const c = createOllamaClient({ fetchFn: r.fetchFn });
    await c.chat({ model: "gpt-oss:20b", messages: [] });
    expect(r.chatBodies[0].think).toBe("low");
  });

  it("model không có 'thinking' ⇒ KHÔNG gửi think (giữ request cũ)", async () => {
    const r = recordingFetch(show(["completion"]));
    const c = createOllamaClient({ fetchFn: r.fetchFn });
    await c.chat({ model: "qwen2.5:7b", messages: [] });
    expect("think" in r.chatBodies[0]).toBe(false);
  });

  it("dò capabilities 1 lần mỗi model (nhớ theo tên)", async () => {
    const r = recordingFetch(show(["thinking"]));
    const c = createOllamaClient({ fetchFn: r.fetchFn });
    await c.chat({ model: "a", messages: [] });
    await c.chat({ model: "a", messages: [] });
    await c.chat({ model: "b", messages: [] });
    expect(r.showCalls.map((b) => JSON.parse(b).model)).toEqual(["a", "b"]);
  });

  it("/api/show lỗi ⇒ không gửi think, không nhớ lỗi (lần sau dò lại)", async () => {
    const r = recordingFetch({}, false);
    const c = createOllamaClient({ fetchFn: r.fetchFn });
    await c.chat({ model: "a", messages: [] });
    await c.chat({ model: "a", messages: [] });
    expect("think" in r.chatBodies[0]).toBe(false);
    expect(r.showCalls).toHaveLength(2);
  });

  it("nhánh stream cũng gửi think:false", async () => {
    let streamBody: Record<string, unknown> | null = null;
    const fetchFn = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/show"))
        return new Response(JSON.stringify(show(["thinking"])), {
          status: 200,
        });
      streamBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ message: { content: "x" }, done: true }) + "\n",
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const c = createOllamaClient({ fetchFn });
    await c.chat({ model: "q", messages: [] }, { onToken: () => {} });
    expect(streamBody!.think).toBe(false);
  });
});
