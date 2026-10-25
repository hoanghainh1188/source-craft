import { describe, expect, it, vi } from "vitest";
import { createLanRuntime } from "../../../src/main/services/ai-runtime/lan/lan-runtime";
import { ProviderRegistry } from "../../../src/main/services/ai-runtime/registry";
import { pickProvider } from "../../../src/main/services/ai-runtime/ai-target";
import type { LLMProvider } from "../../../src/main/services/ai-runtime/provider";
import type { PreconfiguredLanAi } from "../../../src/shared/ipc/types";

// #228 follow-up — bật LAN AI ⇒ provider active THẬT SỰ là LAN (badge "lan" khớp hành vi), tắt ⇒ trả về như cũ.

function fake(id: string): LLMProvider {
  return {
    id,
    chat: async () => ({ content: id }),
    embed: async () => ({ vector: [] }),
    test: async () => ({ reachable: true, ollamaReady: true, reason: null }),
  };
}

function memStore(init: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(init));
  return {
    get: (k: string) => data.get(k),
    set: (k: string, v: unknown) => void data.set(k, v),
  };
}

function setup(
  over: {
    store?: ReturnType<typeof memStore>;
    licensed?: boolean;
    allowedHosts?: string[];
    policyDefault?: PreconfiguredLanAi | null;
    fetchFn?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const registry = new ProviderRegistry();
  registry.register(fake("ollama"));
  registry.register(fake("openai"));
  const store = over.store ?? memStore();
  const onActiveChange = vi.fn();
  let licensed = over.licensed ?? true;
  const fetchFn =
    over.fetchFn ??
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: "từ LAN" } }),
    });
  const lan = createLanRuntime({
    store,
    registry,
    hasLicense: () => licensed,
    getAllowedHosts: () => over.allowedHosts ?? [],
    getPolicyDefault: () => over.policyDefault ?? null,
    fetchFn: fetchFn as unknown as typeof fetch,
    onActiveChange,
    egress: (fn) => fn(),
  });
  return {
    registry,
    store,
    lan,
    onActiveChange,
    fetchFn,
    setLicensed: (v: boolean) => (licensed = v),
  };
}

const ENABLED = {
  "lanAi.config": {
    enabled: true,
    provider: "lan-ollama",
    baseUrl: "http://192.168.1.50:11434",
    chatModel: "qwen2.5:14b",
  },
  "lanAi.token": "tok",
};

describe("createLanRuntime", () => {
  it("đăng ký lan-ollama + lan-openai vào registry nhưng KHÔNG tự bật", () => {
    const { registry } = setup();
    expect(registry.list()).toEqual(
      expect.arrayContaining(["lan-ollama", "lan-openai"]),
    );
    expect(registry.getActive().id).toBe("ollama");
  });

  it("sync khi LAN bật ⇒ active = LAN, cờ privacy lan = true, chat đi tới máy chủ LAN kèm token", async () => {
    const { registry, lan, onActiveChange, fetchFn } = setup({
      store: memStore(ENABLED),
    });
    expect(lan.sync()).toBe(true);
    expect(registry.getActive().id).toBe("lan-ollama");
    expect(onActiveChange).toHaveBeenLastCalledWith(true);

    const res = await pickProvider(registry, "active").chat({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.content).toBe("từ LAN");
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://192.168.1.50:11434/api/chat");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok",
    );
  });

  it("nhánh 'Trả lời bằng AI cục bộ' (098) vẫn LUÔN là Ollama khi LAN bật", () => {
    const { registry, lan } = setup({ store: memStore(ENABLED) });
    lan.sync();
    expect(pickProvider(registry, "local").id).toBe("ollama");
  });

  it("LAN thắng provider online đang bật; tắt LAN ⇒ trả về provider online", () => {
    const store = memStore(ENABLED);
    const { registry, lan, onActiveChange } = setup({ store });
    registry.setActive("openai");
    lan.sync();
    expect(registry.getActive().id).toBe("lan-ollama");

    store.set("lanAi.config", { ...ENABLED["lanAi.config"], enabled: false });
    expect(lan.sync()).toBe(false);
    expect(registry.getActive().id).toBe("openai");
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("provider lan-openai được chọn theo cấu hình", () => {
    const { registry, lan } = setup({
      store: memStore({
        "lanAi.config": { ...ENABLED["lanAi.config"], provider: "lan-openai" },
      }),
    });
    lan.sync();
    expect(registry.getActive().id).toBe("lan-openai");
  });

  it("mất bản quyền Enterprise ⇒ không bật LAN (badge không báo lan)", () => {
    const { registry, lan, onActiveChange, setLicensed } = setup({
      store: memStore(ENABLED),
    });
    lan.sync();
    setLicensed(false);
    expect(lan.sync()).toBe(false);
    expect(registry.getActive().id).toBe("ollama");
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("URL bị SSRF guard chặn (VD policy thu hẹp) ⇒ không bật LAN", () => {
    const { registry, lan } = setup({
      store: memStore({
        "lanAi.config": {
          ...ENABLED["lanAi.config"],
          baseUrl: "https://ai.acme.com",
        },
      }),
      allowedHosts: [],
    });
    expect(lan.sync()).toBe(false);
    expect(registry.getActive().id).toBe("ollama");
  });

  it("chưa lưu cấu hình ⇒ dùng preconfiguredLanAi của policy (khớp màn Cài đặt)", () => {
    const { registry, lan } = setup({
      policyDefault: {
        enabled: true,
        provider: "lan-openai",
        baseUrl: "http://10.0.0.5:8000",
        chatModel: "Qwen/Qwen2.5-14B-Instruct",
      },
    });
    expect(lan.getConfig()).toEqual({
      enabled: true,
      provider: "lan-openai",
      baseUrl: "http://10.0.0.5:8000",
      chatModel: "Qwen/Qwen2.5-14B-Instruct",
      hasCustomToken: false,
    });
    expect(lan.sync()).toBe(true);
    expect(registry.getActive().id).toBe("lan-openai");
  });

  it("getConfig mặc định khi không có cấu hình lẫn policy", () => {
    const { lan } = setup();
    expect(lan.getConfig()).toEqual({
      enabled: false,
      provider: "lan-ollama",
      baseUrl: "",
      chatModel: null,
      hasCustomToken: false,
    });
    expect(lan.sync()).toBe(false);
  });

  it("cấu hình đã lưu thắng policy; hasCustomToken đọc từ store", () => {
    const { lan } = setup({
      store: memStore({ ...ENABLED, "lanAi.hasToken": true }),
      policyDefault: {
        enabled: false,
        provider: "lan-openai",
        baseUrl: "http://10.0.0.9",
      },
    });
    expect(lan.getConfig()).toMatchObject({
      enabled: true,
      provider: "lan-ollama",
      baseUrl: "http://192.168.1.50:11434",
      hasCustomToken: true,
    });
  });
});
