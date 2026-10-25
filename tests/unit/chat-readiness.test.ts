import { describe, it, expect } from "vitest";
import type { RuntimeStatus } from "../../src/shared/ipc/types";
import {
  chatReadiness,
  isChatReady,
} from "../../src/renderer/features/rag-qa/chat-readiness";

const base: RuntimeStatus = {
  reachable: false,
  ollamaReady: false,
  reason: null,
};

describe("chatReadiness", () => {
  it("chưa đọc trạng thái ⇒ ready null", () => {
    expect(chatReadiness(null)).toEqual({
      ready: null,
      localReady: null,
      blockKey: null,
    });
  });

  it("LAN sẵn sàng, Ollama không ⇒ gửi được; AI cục bộ (098) vẫn chưa", () => {
    const r = chatReadiness({
      ...base,
      activeProviderId: "lan-ollama",
      activeReady: true,
    });
    expect(r.ready).toBe(true);
    expect(r.localReady).toBe(false);
    expect(r.blockKey).toBeNull();
  });

  it("provider online/LAN chưa sẵn sàng ⇒ chặn với câu về provider đang bật (không nói Ollama)", () => {
    const r = chatReadiness({
      ...base,
      ollamaReady: true,
      activeProviderId: "lan-openai",
      activeReady: false,
    });
    expect(r.ready).toBe(false);
    expect(r.localReady).toBe(true);
    expect(r.blockKey).toBe("chat.blockActiveProvider");
  });

  it("Ollama là provider đang bật ⇒ câu chặn cũ", () => {
    const r = chatReadiness({
      ...base,
      activeProviderId: "ollama",
      activeReady: false,
    });
    expect(r.blockKey).toBe("chat.blockRuntime");
  });

  it("main cũ không điền activeReady ⇒ quay về ollamaReady", () => {
    expect(chatReadiness({ ...base, ollamaReady: true }).ready).toBe(true);
    expect(chatReadiness(base).blockKey).toBe("chat.blockRuntime");
  });

  it("isChatReady theo provider đang bật", () => {
    expect(isChatReady({ ...base, activeReady: true })).toBe(true);
    expect(
      isChatReady({ ...base, ollamaReady: true, activeReady: false }),
    ).toBe(false);
    expect(isChatReady({ ...base, ollamaReady: true })).toBe(true);
    expect(isChatReady(null)).toBe(false);
  });
});
