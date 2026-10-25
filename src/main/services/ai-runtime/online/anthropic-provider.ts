import { errorTagsOnly } from "@shared/online-error-tag";
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
import { sseData, sseDeltaAnthropic } from "./stream-parse";
import type { OnlineProviderDeps } from "./provider-deps";

// Provider Claude (Anthropic) — Messages API. system tách khỏi messages (khác OpenAI). Embedding KHÔNG hỗ
// trợ (Anthropic không có API embedding) → luôn dùng Ollama local (quyết định #1).

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
const LABEL = PROVIDER_LABELS.anthropic;

export interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
}

/** THUẦN: ChatMessage[] → body Anthropic. Gộp mọi 'system' thành field `system`; còn lại user/assistant. */
export function toAnthropicRequest(
  messages: ChatMessage[],
  model: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  temperature?: number,
): AnthropicRequestBody {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  const body: AnthropicRequestBody = {
    model,
    max_tokens: maxTokens,
    messages: turns,
  };
  if (system) body.system = system;
  if (temperature !== undefined) body.temperature = temperature;
  return body;
}

/** THUẦN: parse response Anthropic → chuỗi text (nối các block type=text). */
export function parseAnthropicResponse(json: unknown): string {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b): b is { type: string; text: string } =>
        !!b &&
        typeof b === "object" &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("");
}

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
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
    const headers = {
      "x-api-key": key,
      "anthropic-version": ANTHROPIC_VERSION,
    };
    if (opts?.onToken) {
      let acc = "";
      await streamLines(
        {
          url: ENDPOINT,
          headers,
          body: {
            ...toAnthropicRequest(
              req.messages,
              model,
              DEFAULT_MAX_TOKENS,
              req.temperature,
            ),
            stream: true,
          },
          fetchFn: this.deps.fetchFn,
          signal: opts.signal,
          providerLabel: LABEL,
        },
        (line) => {
          const payload = sseData(line);
          if (payload === null) return;
          const d = sseDeltaAnthropic(payload);
          if (d) {
            acc += d;
            opts.onToken!(d);
          }
        },
      );
      return { content: acc };
    }
    const json = await callJson({
      url: ENDPOINT,
      headers,
      body: toAnthropicRequest(
        req.messages,
        model,
        DEFAULT_MAX_TOKENS,
        req.temperature,
      ),
      fetchFn: this.deps.fetchFn,
      timeoutMs: this.deps.timeoutMs,
      providerLabel: LABEL,
      // 149: huỷ (Studio) ⇒ ChatAbortedError, không phải timeout.
      signal: opts?.signal,
    });
    return { content: parseAnthropicResponse(json) };
  }

  async embed(): Promise<EmbedResult> {
    throw new Error(
      `${LABEL} does not support embedding — embedding always uses local models.`,
    );
  }

  /** 105: cửa sổ ngữ cảnh điển hình (Claude) — Studio tự áp trần ký tự (chi phí/độ trễ trên key người dùng). */
  async contextTokens(): Promise<number | null> {
    return 200_000;
  }

  async test(): Promise<RuntimeStatus> {
    return testOnlineChat(this, this.deps, LABEL);
  }

  async readiness(): Promise<RuntimeStatus> {
    return onlineReadiness(this.deps, LABEL);
  }
}

/** Chung cho 3 provider: thiếu key/model ⇒ trạng thái chưa sẵn sàng; đủ ⇒ null. Không gọi mạng. */
function onlineConfigProblem(
  key: string | null,
  deps: OnlineProviderDeps,
  label: string,
): RuntimeStatus | null {
  if (!key)
    return {
      reachable: false,
      ollamaReady: false,
      reason: `${label}: API key missing.`,
      reasonCode: "apiKeyMissing",
      reasonParams: { provider: label },
    };
  if (!deps.getModel())
    return {
      reachable: false,
      ollamaReady: false,
      reason: `${label}: model not selected.`,
      reasonCode: "modelNotSelected",
      reasonParams: { provider: label },
    };
  return null;
}

/** Cổng Chat: đủ key + model ⇒ coi là sẵn sàng (lỗi mạng/hạn mức lộ ra khi gửi ⇒ nút "AI cục bộ" của 098). */
export async function onlineReadiness(
  deps: OnlineProviderDeps,
  label: string,
): Promise<RuntimeStatus> {
  return (
    onlineConfigProblem(await deps.getKey(), deps, label) ?? {
      reachable: true,
      ollamaReady: true,
      reason: null,
    }
  );
}

/** Chung cho 3 provider: test = gọi chat "ping" tối thiểu; báo reason rõ khi thiếu key/model/lỗi. */
export async function testOnlineChat(
  provider: LLMProvider,
  deps: OnlineProviderDeps,
  label: string,
): Promise<RuntimeStatus> {
  const problem = onlineConfigProblem(await deps.getKey(), deps, label);
  if (problem) return problem;
  try {
    await provider.chat({ messages: [{ role: "user", content: "ping" }] });
    return { reachable: true, ollamaReady: true, reason: null };
  } catch (e) {
    return {
      reachable: false,
      ollamaReady: false,
      reason: `${label}: connection test failed.`,
      reasonCode: "connectionFailed",
      reasonParams: { provider: label },
      // 123 (security review): chỉ gửi THẺ lỗi (mã/loại online), không gửi thông điệp thô của provider.
      ...(e instanceof Error && errorTagsOnly(e.message)
        ? { reasonError: errorTagsOnly(e.message) }
        : {}),
    };
  }
}
