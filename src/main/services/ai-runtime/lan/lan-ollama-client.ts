import type { ChatRequest, ChatResult } from "@shared/ipc/types";

// 228 — LAN Ollama Client: connects to an internal Ollama server with optional Bearer token.

export interface LanOllamaClientOptions {
  baseUrl: string;
  token?: string | null;
  fetchFn?: typeof fetch;
}

export interface LanOllamaClient {
  listModels(): Promise<string[]>;
  chat(request: ChatRequest): Promise<ChatResult>;
}

export function createLanOllamaClient(
  opts: LanOllamaClientOptions,
): LanOllamaClient {
  const { baseUrl, token, fetchFn = fetch } = opts;
  const cleanUrl = baseUrl.replace(/\/$/, "");

  const makeHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token && token.trim()) {
      headers["Authorization"] = `Bearer ${token.trim()}`;
    }
    return headers;
  };

  return {
    async listModels(): Promise<string[]> {
      const res = await fetchFn(`${cleanUrl}/api/tags`, {
        method: "GET",
        headers: makeHeaders(),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as { models?: { name: string }[] };
      return Array.isArray(data.models) ? data.models.map((m) => m.name) : [];
    },

    async chat(request: ChatRequest): Promise<ChatResult> {
      const res = await fetchFn(`${cleanUrl}/api/chat`, {
        method: "POST",
        headers: makeHeaders(),
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: false,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as { message?: { content: string } };
      return {
        content: data.message?.content ?? "",
      };
    },
  };
}
