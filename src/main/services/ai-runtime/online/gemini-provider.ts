import { UserFacingError, encodeUserError } from "@shared/codes/user-error";
import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  EmbedResult,
  RuntimeStatus,
} from "@shared/ipc/types";
import type { ChatStreamOpts, LLMProvider } from "../provider";
import { callJson, streamLines } from "./online-http";
import { OnlineProviderError } from "./online-error";
import { PROVIDER_LABELS } from "./presets";
import { sseData, sseDeltaGemini } from "./stream-parse";
import type { OnlineProviderDeps } from "./provider-deps";
import { testOnlineChat } from "./anthropic-provider";

// Provider Google Gemini — Generative Language API generateContent. role 'assistant' → 'model';
// 'system' → systemInstruction. Embedding KHÔNG dùng ở đây (luôn Ollama local — quyết định #1).

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const LABEL = PROVIDER_LABELS.gemini;

export interface GeminiRequestBody {
  systemInstruction?: { parts: { text: string }[] };
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
  generationConfig?: { temperature?: number };
}

/** THUẦN: ChatMessage[] → body Gemini. Gộp system → systemInstruction; user giữ 'user', assistant → 'model'. */
export function toGeminiRequest(
  messages: ChatMessage[],
  temperature?: number,
): GeminiRequestBody {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));
  const body: GeminiRequestBody = { contents };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (temperature !== undefined) body.generationConfig = { temperature };
  return body;
}

/** THUẦN: parse response Gemini → chuỗi text (nối parts của candidate đầu). */
export function parseGeminiResponse(json: unknown): string {
  const candidates = (json as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content
    ?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { text: string } =>
        !!p &&
        typeof p === "object" &&
        typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join("");
}

export class GeminiProvider implements LLMProvider {
  readonly id = "gemini";
  constructor(private readonly deps: OnlineProviderDeps) {}

  async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
    const key = await this.deps.getKey();
    if (!key)
      throw new OnlineProviderError(
        encodeUserError("apiKeyMissing", { provider: LABEL }),
        "auth",
      );
    const model = req.model ?? this.deps.getModel();
    if (!model)
      throw new UserFacingError("modelNotSelected", { provider: LABEL });
    const m = encodeURIComponent(model);
    if (opts?.onToken) {
      let acc = "";
      await streamLines(
        {
          url: `${BASE}/${m}:streamGenerateContent?alt=sse`,
          headers: { "x-goog-api-key": key },
          body: toGeminiRequest(req.messages, req.temperature),
          fetchFn: this.deps.fetchFn,
          signal: opts.signal,
          providerLabel: LABEL,
        },
        (line) => {
          const payload = sseData(line);
          if (payload === null) return;
          const d = sseDeltaGemini(payload);
          if (d) {
            acc += d;
            opts.onToken!(d);
          }
        },
      );
      return { content: acc };
    }
    const json = await callJson({
      url: `${BASE}/${m}:generateContent`,
      headers: { "x-goog-api-key": key },
      body: toGeminiRequest(req.messages, req.temperature),
      fetchFn: this.deps.fetchFn,
      timeoutMs: this.deps.timeoutMs,
      providerLabel: LABEL,
      // 149: huỷ (Studio) ⇒ ChatAbortedError, không phải timeout.
      signal: opts?.signal,
    });
    return { content: parseGeminiResponse(json) };
  }

  async embed(): Promise<EmbedResult> {
    throw new Error(
      `${LABEL} is not used for embedding — embedding always uses local models.`,
    );
  }

  /** 105: cửa sổ ngữ cảnh điển hình (Gemini 2.x) — Studio tự áp trần ký tự (chi phí/độ trễ trên key người dùng). */
  async contextTokens(): Promise<number | null> {
    return 1_000_000;
  }

  async test(): Promise<RuntimeStatus> {
    return testOnlineChat(this, this.deps, LABEL);
  }
}
