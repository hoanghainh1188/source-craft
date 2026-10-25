import { describe, it, expect, vi } from "vitest";
import type { RuntimeStatus } from "../../src/shared/ipc/types";
import type { LLMProvider } from "../../src/main/services/ai-runtime/provider";
import { ProviderRegistry } from "../../src/main/services/ai-runtime/registry";
import { withActiveStatus } from "../../src/main/services/ai-runtime/active-status";

// Cổng Chat phản ánh provider SẼ trả lời (registry.getActive()) — LAN/online không cần Ollama cục bộ.

const LOCAL_DOWN: RuntimeStatus = {
  reachable: false,
  ollamaReady: false,
  reason: "Ollama unreachable.",
  reasonCode: "ollamaUnreachable",
};
const LOCAL_UP: RuntimeStatus = {
  reachable: true,
  ollamaReady: true,
  reason: null,
};
const READY: RuntimeStatus = {
  reachable: true,
  ollamaReady: true,
  reason: null,
};

function fake(id: string, extra: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id,
    chat: vi.fn(),
    embed: vi.fn(),
    test: vi.fn(async () => READY),
    ...extra,
  } as unknown as LLMProvider;
}

describe("withActiveStatus", () => {
  it("active = ollama ⇒ activeReady = ollamaReady, không kiểm tra lần hai", async () => {
    const reg = new ProviderRegistry();
    const ollama = fake("ollama");
    reg.register(ollama);
    const s = await withActiveStatus(reg, LOCAL_DOWN);
    expect(s).toMatchObject({
      ...LOCAL_DOWN,
      activeProviderId: "ollama",
      activeReady: false,
    });
    expect(ollama.test).not.toHaveBeenCalled();
  });

  it("LAN đang bật + sẵn sàng ⇒ activeReady true dù Ollama cục bộ không chạy; giữ nguyên trạng thái cục bộ", async () => {
    const reg = new ProviderRegistry();
    reg.register(fake("ollama"));
    reg.register(fake("lan-ollama"));
    reg.setOverride("lan-ollama");
    const s = await withActiveStatus(reg, LOCAL_DOWN);
    expect(s.activeProviderId).toBe("lan-ollama");
    expect(s.activeReady).toBe(true);
    expect(s.ollamaReady).toBe(false);
    expect(s.reasonCode).toBe("ollamaUnreachable");
  });

  it("LAN chưa sẵn sàng ⇒ activeReady false dù Ollama cục bộ chạy", async () => {
    const reg = new ProviderRegistry();
    reg.register(fake("ollama"));
    reg.register(
      fake("lan-ollama", {
        test: vi.fn(async () => ({
          reachable: false,
          ollamaReady: false,
          reason: "x",
        })),
      }),
    );
    reg.setOverride("lan-ollama");
    const s = await withActiveStatus(reg, LOCAL_UP);
    expect(s.activeReady).toBe(false);
    expect(s.ollamaReady).toBe(true);
  });

  it("provider có readiness() (online) ⇒ dùng nó, KHÔNG gọi test() (ping tính phí)", async () => {
    const reg = new ProviderRegistry();
    reg.register(fake("ollama"));
    const online = fake("openai", { readiness: vi.fn(async () => READY) });
    reg.register(online, { activate: true });
    const s = await withActiveStatus(reg, LOCAL_DOWN);
    expect(s.activeReady).toBe(true);
    expect(online.test).not.toHaveBeenCalled();
  });

  it("kiểm tra provider ném lỗi ⇒ activeReady false (không ném ra IPC)", async () => {
    const reg = new ProviderRegistry();
    reg.register(fake("ollama"));
    reg.register(
      fake("lan-openai", {
        test: vi.fn(async () => Promise.reject(new Error("boom"))),
      }),
    );
    reg.setOverride("lan-openai");
    const s = await withActiveStatus(reg, LOCAL_UP);
    expect(s.activeReady).toBe(false);
  });
});
