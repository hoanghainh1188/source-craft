import { describe, it, expect } from "vitest";
import { ProviderRegistry } from "../../src/main/services/ai-runtime/registry";
import type { LLMProvider } from "../../src/main/services/ai-runtime/provider";

function fakeProvider(id: string, answer: string): LLMProvider {
  return {
    id,
    chat: async () => ({ content: answer }),
    embed: async () => ({ vector: [] }),
    test: async () => ({ reachable: true, ollamaReady: true, reason: null }),
  };
}

describe("ProviderRegistry", () => {
  it("provider đầu tiên tự thành active", () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "local"));
    expect(r.getActive().id).toBe("ollama");
  });

  it("getActive ném khi chưa đăng ký", () => {
    expect(() => new ProviderRegistry().getActive()).toThrow();
  });

  it("setActive chuyển provider — nơi gọi AI dùng cùng interface (SC-006)", async () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "local"));
    r.register(fakeProvider("mock-online", "online"));
    // Nơi gọi AI KHÔNG đổi: luôn r.getActive().chat(...)
    expect((await r.getActive().chat({ messages: [] })).content).toBe("local");
    r.setActive("mock-online");
    expect((await r.getActive().chat({ messages: [] })).content).toBe("online");
  });

  it("setActive ném khi provider chưa đăng ký", () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "x"));
    expect(() => r.setActive("khong-co")).toThrow();
  });

  it("get(id) lấy đúng provider đã đăng ký (098 — lượt 'AI cục bộ'), id lạ ⇒ ném", () => {
    const r = new ProviderRegistry();
    const a = { id: "ollama" } as unknown as LLMProvider;
    const b = { id: "anthropic" } as unknown as LLMProvider;
    r.register(a);
    r.register(b, { activate: true });
    expect(r.getActive()).toBe(b);
    expect(r.get("ollama")).toBe(a);
    expect(() => r.get("x")).toThrow();
  });

  // #228: LAN AI (Enterprise) ưu tiên hơn provider online — khớp thứ tự badge riêng tư (lan > online > local).
  it("setOverride: getActive trả provider override; null ⇒ về active cũ", () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "local"));
    r.register(fakeProvider("openai", "online"));
    r.register(fakeProvider("lan-ollama", "lan"));
    r.setActive("openai");
    r.setOverride("lan-ollama");
    expect(r.getActive().id).toBe("lan-ollama");
    // Đổi provider online trong lúc LAN bật KHÔNG giành quyền khỏi LAN.
    r.setActive("ollama");
    expect(r.getActive().id).toBe("lan-ollama");
    r.setOverride(null);
    expect(r.getActive().id).toBe("ollama");
    // "local" (098) vẫn lấy thẳng Ollama dù có override.
    r.setOverride("lan-ollama");
    expect(r.get("ollama").id).toBe("ollama");
  });

  it("setOverride id chưa đăng ký ⇒ ném", () => {
    const r = new ProviderRegistry();
    r.register(fakeProvider("ollama", "local"));
    expect(() => r.setOverride("lan-x")).toThrow();
  });
});
