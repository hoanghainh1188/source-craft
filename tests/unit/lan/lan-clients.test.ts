import { describe, expect, it, vi } from "vitest";
import { createLanOllamaClient } from "../../../src/main/services/ai-runtime/lan/lan-ollama-client";
import { createLanOpenAiClient } from "../../../src/main/services/ai-runtime/lan/lan-openai-client";

describe("LanOllamaClient", () => {
  it("connects to LAN Ollama with optional Authorization header and lists models", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [{ name: "qwen2.5:14b" }, { name: "llama3.1:8b" }],
      }),
    });

    const client = createLanOllamaClient({
      baseUrl: "http://192.168.1.50:11434",
      token: "secret-lan-token",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const models = await client.listModels();
    expect(models).toEqual(["qwen2.5:14b", "llama3.1:8b"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.1.50:11434/api/tags",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-lan-token",
        }),
      }),
    );
  });

  it("sends chat request to /api/chat and parses response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: { role: "assistant", content: "Xin chào từ máy chủ LAN!" },
      }),
    });

    const client = createLanOllamaClient({
      baseUrl: "http://192.168.1.50:11434",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.chat({
      model: "qwen2.5:14b",
      messages: [{ role: "user", content: "Chào bạn" }],
    });

    expect(res.content).toBe("Xin chào từ máy chủ LAN!");
  });
});

describe("LanOpenAiClient (vLLM / LiteLLM)", () => {
  it("connects to OpenAI-compatible endpoint (/v1/models) and lists models", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: "meta-llama/Llama-3.1-8B-Instruct" }],
      }),
    });

    const client = createLanOpenAiClient({
      baseUrl: "http://10.0.0.100:8000",
      token: "vllm-token",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const models = await client.listModels();
    expect(models).toEqual(["meta-llama/Llama-3.1-8B-Instruct"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://10.0.0.100:8000/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer vllm-token",
        }),
      }),
    );
  });

  it("sends chat request to /v1/chat/completions and parses choices", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: { role: "assistant", content: "Câu trả lời từ vLLM LAN." },
          },
        ],
      }),
    });

    const client = createLanOpenAiClient({
      baseUrl: "http://10.0.0.100:8000",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.chat({
      model: "meta-llama/Llama-3.1-8B-Instruct",
      messages: [{ role: "user", content: "Test" }],
    });

    expect(res.content).toBe("Câu trả lời từ vLLM LAN.");
  });
});
