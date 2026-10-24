import type { ChatRequest, ChatResult } from "@shared/ipc/types";

// 228 — LAN OpenAI-Compatible Client (vLLM / LiteLLM / LocalAI / TGI) for internal enterprise infrastructure.

export interface LanOpenAiClientOptions {
  baseUrl: string;
  token?: string | null;
  fetchFn?: typeof fetch;
}

export interface LanOpenAiClient {
  listModels(): Promise<string[]>;
  chat(request: ChatRequest): Promise<ChatResult>;
}

export function createLanOpenAiClient(
  opts: LanOpenAiClientOptions,
): LanOpenAiClient {
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
      const res = await fetchFn(`${cleanUrl}/v1/models`, {
        method: "GET",
        headers: makeHeaders(),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = (await res.json()) as { data?: { id: string }[] };
      return Array.isArray(data.data) ? data.data.map((m) => m.id) : [];
    },

    async chat(request: ChatRequest): Promise<ChatResult> {
      const res = await fetchFn(`${cleanUrl}/v1/chat/completions`, {
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
      const data = (await res.json()) as {
        choices?: { message?: { content: string } }[];
      };
      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content ?? "",
      };
    },
  };
}
