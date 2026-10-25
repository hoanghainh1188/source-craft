import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProviderRegistry } from "../../src/main/services/ai-runtime/registry";
import type { LLMProvider } from "../../src/main/services/ai-runtime/provider";
import { createOnlineRuntime } from "../../src/main/services/ai-runtime/online/online-runtime";
import type { SecretStore } from "../../src/main/services/ai-runtime/online/secret-store";
import type { StoreLike } from "../../src/main/services/ai-runtime/model-selection";
import type { OnlineProviderId } from "../../src/shared/ipc/types";

function fakeStore(): StoreLike {
  const data = new Map<string, unknown>();
  return { get: (k) => data.get(k), set: (k, v) => void data.set(k, v) };
}
function fakeSecret(): SecretStore {
  const m = new Map<string, string>();
  return {
    getKey: async (id) => m.get(id) ?? null,
    setKey: async (id, k) => void m.set(id, k),
    deleteKey: async (id) => void m.delete(id),
    hasKey: async (id) => (m.get(id) ?? "").length > 0,
  };
}
const fakeOllama: LLMProvider = {
  id: "ollama",
  chat: async () => ({ content: "local" }),
  embed: async () => ({ vector: [] }),
  test: async () => ({ reachable: true, ollamaReady: true, reason: null }),
};

function setup() {
  const registry = new ProviderRegistry();
  registry.register(fakeOllama); // active mặc định = ollama
  const onActiveChange = vi.fn();
  const rt = createOnlineRuntime({
    store: fakeStore(),
    secretStore: fakeSecret(),
    registry,
    fetchFn: vi.fn() as unknown as typeof fetch,
    onActiveChange,
  });
  return { registry, onActiveChange, rt };
}

describe("online-runtime (031)", () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => (ctx = setup()));

  it("getOnlineState: 3 provider có label/presets; active=null ban đầu", async () => {
    const s = await ctx.rt.getOnlineState();
    expect(s.providers.map((p) => p.id)).toEqual([
      "anthropic",
      "gemini",
      "openai",
    ]);
    expect(s.activeOnlineId).toBeNull();
    const anth = s.providers.find((p) => p.id === "anthropic")!;
    expect(anth.label).toMatch(/Claude/);
    expect(anth.presets.length).toBeGreaterThan(0);
    expect(anth.hasKey).toBe(false);
  });

  it("setProviderKey → hasKey true; setActive không key → ném", async () => {
    await expect(ctx.rt.setActiveProvider("openai")).rejects.toThrow(
      /apiKeyMissing/,
    );
    const s = await ctx.rt.setProviderKey({ id: "openai", apiKey: "sk-1" });
    expect(s.providers.find((p) => p.id === "openai")!.hasKey).toBe(true);
  });

  it("bật provider (có key) → active + privacy online + registry đổi", async () => {
    await ctx.rt.setProviderKey({ id: "anthropic", apiKey: "k" });
    const s = await ctx.rt.setActiveProvider("anthropic");
    expect(s.activeOnlineId).toBe("anthropic");
    expect(ctx.registry.getActive().id).toBe("anthropic");
    expect(ctx.onActiveChange).toHaveBeenLastCalledWith(true);
  });

  it("độc quyền: bật cái thứ 2 → cái đầu tắt", async () => {
    await ctx.rt.setProviderKey({ id: "anthropic", apiKey: "k" });
    await ctx.rt.setProviderKey({ id: "openai", apiKey: "k2" });
    await ctx.rt.setActiveProvider("anthropic");
    const s = await ctx.rt.setActiveProvider("openai");
    expect(s.activeOnlineId).toBe("openai");
    expect(s.providers.find((p) => p.id === "anthropic")!.active).toBe(false);
    expect(s.providers.find((p) => p.id === "openai")!.active).toBe(true);
  });

  it("tắt online (null) → về local + privacy local", async () => {
    await ctx.rt.setProviderKey({ id: "openai", apiKey: "k" });
    await ctx.rt.setActiveProvider("openai");
    const s = await ctx.rt.setActiveProvider(null);
    expect(s.activeOnlineId).toBeNull();
    expect(ctx.registry.getActive().id).toBe("ollama");
    expect(ctx.onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("xoá key của provider đang active → tự về local", async () => {
    await ctx.rt.setProviderKey({ id: "gemini", apiKey: "k" });
    await ctx.rt.setActiveProvider("gemini");
    const s = await ctx.rt.deleteProviderKey("gemini");
    expect(s.activeOnlineId).toBeNull();
    expect(ctx.registry.getActive().id).toBe("ollama");
  });

  it("setProviderModel validate; id lạ → ném", async () => {
    const s = await ctx.rt.setProviderModel({
      id: "openai",
      model: "gpt-4o",
    });
    expect(s.providers.find((p) => p.id === "openai")!.model).toBe("gpt-4o");
    const bad = await ctx.rt.setProviderModel({ id: "openai", model: "x!" });
    expect(bad.providers.find((p) => p.id === "openai")!.model).toBeNull();
    await expect(
      ctx.rt.setActiveProvider("evil" as OnlineProviderId),
    ).rejects.toThrow(/Invalid provider|apiKeyInvalidInput/);
  });

  it("syncActiveFromConfig: provider active mất key → về local", async () => {
    // Bật rồi xoá key qua store trực tiếp mô phỏng keychain mất
    await ctx.rt.setProviderKey({ id: "openai", apiKey: "k" });
    await ctx.rt.setActiveProvider("openai");
    await ctx.rt.deleteProviderKey("openai"); // xoá key → active reset trong hàm này
    await ctx.rt.syncActiveFromConfig();
    expect(ctx.registry.getActive().id).toBe("ollama");
  });
});

// 228 (SC-003): forceLocalOnly trong enterprise-policy.json ⇒ main CHẶN AI đám mây công cộng (không chỉ nhãn UI).
describe("online-runtime — chính sách IT forceLocalOnly (228)", () => {
  function setupWithPolicy(opts: {
    locked: boolean;
    activeOnline?: OnlineProviderId;
  }) {
    const registry = new ProviderRegistry();
    registry.register(fakeOllama);
    const onActiveChange = vi.fn();
    const store = fakeStore();
    const secretStore = fakeSecret();
    const fetchFn = vi.fn() as unknown as typeof fetch;
    if (opts.activeOnline) {
      store.set("ai.onlineConfig", {
        activeOnlineId: opts.activeOnline,
        models: { anthropic: null, gemini: null, openai: null },
      });
    }
    let locked = opts.locked;
    const policy = {
      isCloudDisabled: () => locked,
      getPolicy: () =>
        locked
          ? {
              schemaVersion: 1 as const,
              policyId: "p1",
              organization: "ACME Law",
              forceLocalOnly: true,
            }
          : null,
    };
    const rt = createOnlineRuntime({
      store,
      secretStore,
      registry,
      fetchFn,
      onActiveChange,
      policy,
    });
    return {
      rt,
      registry,
      onActiveChange,
      secretStore,
      fetchFn,
      unlock: () => (locked = false),
    };
  }

  it("setActiveProvider(online) bị chặn với policyCloudDisabled + org; registry giữ local", async () => {
    const ctx = setupWithPolicy({ locked: true });
    await ctx.secretStore.setKey("openai", "sk-1");
    const err = await ctx.rt.setActiveProvider("openai").catch((e) => e);
    expect(err).toMatchObject({
      name: "UserFacingError",
      code: "policyCloudDisabled",
      params: { org: "ACME Law" },
    });
    expect(ctx.registry.getActive().id).toBe("ollama");
    expect(ctx.onActiveChange).not.toHaveBeenCalledWith(true);
    expect((await ctx.rt.getOnlineState()).activeOnlineId).toBeNull();
  });

  it("chặn trước cả kiểm tra key (không lộ trạng thái key qua lỗi apiKeyMissing)", async () => {
    const ctx = setupWithPolicy({ locked: true });
    await expect(ctx.rt.setActiveProvider("gemini")).rejects.toMatchObject({
      code: "policyCloudDisabled",
    });
  });

  it("setActiveProvider(null) vẫn được phép (về local)", async () => {
    const ctx = setupWithPolicy({ locked: true });
    const s = await ctx.rt.setActiveProvider(null);
    expect(s.activeOnlineId).toBeNull();
    expect(ctx.onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("syncActiveFromConfig: provider online đã lưu + có key ⇒ bị tắt, badge về local, config xoá active", async () => {
    const ctx = setupWithPolicy({ locked: true, activeOnline: "anthropic" });
    await ctx.secretStore.setKey("anthropic", "k");
    await ctx.rt.syncActiveFromConfig();
    expect(ctx.registry.getActive().id).toBe("ollama");
    expect(ctx.onActiveChange).toHaveBeenLastCalledWith(false);
    expect((await ctx.rt.getOnlineState()).activeOnlineId).toBeNull();
  });

  it("testProvider bị chặn — không gọi mạng ra đám mây", async () => {
    const ctx = setupWithPolicy({ locked: true });
    await ctx.secretStore.setKey("openai", "sk-1");
    await expect(ctx.rt.testProvider("openai")).rejects.toMatchObject({
      code: "policyCloudDisabled",
    });
    expect(ctx.fetchFn).not.toHaveBeenCalled();
  });

  it("getOnlineState báo cloudLockedBy = tên tổ chức để UI khoá toggle", async () => {
    const ctx = setupWithPolicy({ locked: true });
    expect((await ctx.rt.getOnlineState()).cloudLockedBy).toBe("ACME Law");
  });

  it("không có policy khoá ⇒ cloudLockedBy null và bật online bình thường", async () => {
    const ctx = setupWithPolicy({ locked: false });
    await ctx.secretStore.setKey("openai", "sk-1");
    const s = await ctx.rt.setActiveProvider("openai");
    expect(s.cloudLockedBy).toBeNull();
    expect(ctx.registry.getActive().id).toBe("openai");
  });

  it("không truyền policy (mặc định) ⇒ không khoá", async () => {
    const s = await setup().rt.getOnlineState();
    expect(s.cloudLockedBy).toBeNull();
  });
});
