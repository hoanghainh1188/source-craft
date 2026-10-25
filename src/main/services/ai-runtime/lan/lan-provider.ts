import { UserFacingError } from "@shared/codes/user-error";
import type {
  ChatRequest,
  ChatResult,
  EmbedResult,
  LanAiProviderKind,
  RuntimeStatus,
} from "@shared/ipc/types";
import { ChatAbortedError, assertNotAborted, linkAbort } from "../abort";
import type { ChatStreamOpts, LLMProvider } from "../provider";
import { validateLanUrl } from "./lan-guard";
import { LanHttpError } from "./lan-http-error";
import { createLanOllamaClient } from "./lan-ollama-client";
import { createLanOpenAiClient } from "./lan-openai-client";

// #228 — LLMProvider bọc máy chủ AI nội bộ (Ollama / OpenAI-compatible). Đăng ký vào ProviderRegistry để chat/Studio
// THẬT SỰ đi qua LAN khi bật (trước đây chỉ báo "lan" mà câu trả lời vẫn do provider khác sinh — vi phạm Constitution I).
// SSRF guard chạy ở MỌI lệnh gọi (policy allowedLanHosts có thể đổi lúc chạy). Mọi request nằm trong egress("lanAi").

/** Máy chủ LAN có thể chậm (model lớn, không stream) ⇒ timeout rộng hơn online (60s). */
export const DEFAULT_LAN_TIMEOUT_MS = 300_000;

export interface LanSettings {
  baseUrl: string;
  chatModel: string | null;
  token: string | null;
}

export interface LanProviderDeps {
  kind: LanAiProviderKind;
  getSettings: () => LanSettings;
  getAllowedHosts: () => readonly string[];
  fetchFn: typeof fetch;
  /** Bọc request trong khoảng egress (badge "đang gửi" — loại lanAi). */
  egress: <T>(fn: () => Promise<T>) => Promise<T>;
  timeoutMs?: number;
}

type LanClient = ReturnType<typeof createLanOllamaClient>;

export class LanProvider implements LLMProvider {
  readonly id: LanAiProviderKind;

  constructor(private readonly deps: LanProviderDeps) {
    this.id = deps.kind;
  }

  async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
    assertNotAborted(opts?.signal);
    const settings = this.deps.getSettings();
    const client = this.clientFor(settings);
    const model = req.model ?? settings.chatModel;
    if (!model) throw new UserFacingError("chatModelNotSelected");

    const result = await this.withSignal(opts?.signal, (signal) =>
      client.chat({ ...req, model }, { signal }),
    );
    // Máy chủ LAN trả trọn (không stream) ⇒ đẩy 1 delta để luồng stream (039) vẫn hiện câu trả lời.
    if (opts?.onToken && result.content) opts.onToken(result.content);
    return result;
  }

  async embed(): Promise<EmbedResult> {
    throw new Error(
      "LAN AI embedding is not used here — embedding always uses local models.",
    );
  }

  async test(): Promise<RuntimeStatus> {
    try {
      const settings = this.deps.getSettings();
      const client = this.clientFor(settings);
      const models = await this.withSignal(undefined, (signal) =>
        client.listModels({ signal }),
      );
      if (!settings.chatModel) {
        return {
          reachable: true,
          ollamaReady: false,
          reason: "Answer model not selected.",
          reasonCode: "modelsNotSelected",
        };
      }
      if (!models.includes(settings.chatModel)) {
        return {
          reachable: true,
          ollamaReady: false,
          reason: `Selected model not installed: ${settings.chatModel}.`,
          reasonCode: "modelsMissing",
          reasonParams: { models: settings.chatModel },
        };
      }
      return { reachable: true, ollamaReady: true, reason: null };
    } catch {
      return {
        reachable: false,
        ollamaReady: false,
        reason: "LAN AI server unreachable.",
      };
    }
  }

  async contextTokens(): Promise<number | null> {
    return null;
  }

  /** SSRF guard → client theo loại. URL không hợp lệ ⇒ ném TRƯỚC khi có bất kỳ request nào. */
  private clientFor(settings: LanSettings): LanClient {
    const check = validateLanUrl(settings.baseUrl, this.deps.getAllowedHosts());
    if (!check.ok) {
      throw new UserFacingError("lanAiInvalidHost", { url: settings.baseUrl });
    }
    const opts = {
      baseUrl: settings.baseUrl,
      token: settings.token,
      fetchFn: this.deps.fetchFn,
    };
    return this.deps.kind === "lan-openai"
      ? createLanOpenAiClient(opts)
      : createLanOllamaClient(opts);
  }

  /** Chạy fn trong egress với signal gộp (huỷ ngoài + timeout); đổi lỗi sang mã người-dùng-thấy. */
  private async withSignal<T>(
    outer: AbortSignal | undefined,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const unlink = linkAbort(outer, controller);
    const timer = setTimeout(
      () => controller.abort(),
      this.deps.timeoutMs ?? DEFAULT_LAN_TIMEOUT_MS,
    );
    try {
      return await this.deps.egress(() => fn(controller.signal));
    } catch (cause) {
      if (outer?.aborted) throw new ChatAbortedError();
      throw toUserError(cause);
    } finally {
      clearTimeout(timer);
      unlink();
    }
  }
}

function toUserError(cause: unknown): Error {
  if (cause instanceof UserFacingError) return cause;
  if (cause instanceof LanHttpError) {
    return new UserFacingError("lanAiHttp", { status: cause.status });
  }
  const name =
    cause && typeof cause === "object" && "name" in cause
      ? String((cause as { name?: unknown }).name)
      : "";
  return new UserFacingError(
    name === "AbortError" ? "lanAiTimeout" : "lanAiUnreachable",
  );
}
