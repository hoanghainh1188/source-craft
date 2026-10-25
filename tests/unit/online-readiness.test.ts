import { describe, it, expect, vi } from "vitest";
import { AnthropicProvider } from "../../src/main/services/ai-runtime/online/anthropic-provider";
import { GeminiProvider } from "../../src/main/services/ai-runtime/online/gemini-provider";
import { OpenAIProvider } from "../../src/main/services/ai-runtime/online/openai-provider";

// readiness() của provider online chỉ kiểm cấu hình (key + model) — KHÔNG gọi mạng (cổng Chat được hỏi lại thường xuyên).

const CLASSES = [AnthropicProvider, GeminiProvider, OpenAIProvider];

describe.each(CLASSES)("%o.readiness", (Cls) => {
  it("có key + model ⇒ sẵn sàng, không fetch", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const p = new Cls({
      getKey: async () => "k",
      getModel: () => "m",
      fetchFn,
    });
    expect((await p.readiness()).ollamaReady).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("thiếu key ⇒ apiKeyMissing", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const p = new Cls({
      getKey: async () => null,
      getModel: () => "m",
      fetchFn,
    });
    const s = await p.readiness();
    expect(s.ollamaReady).toBe(false);
    expect(s.reasonCode).toBe("apiKeyMissing");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("thiếu model ⇒ modelNotSelected", async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    const p = new Cls({
      getKey: async () => "k",
      getModel: () => null,
      fetchFn,
    });
    expect((await p.readiness()).reasonCode).toBe("modelNotSelected");
  });
});
