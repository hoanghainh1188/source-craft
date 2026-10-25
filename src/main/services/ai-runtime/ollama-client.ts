import { UserFacingError } from "@shared/codes/user-error";
import type {
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  Model,
} from "@shared/ipc/types";
import { logEvent } from "../../logging";
import type { ChatStreamOpts } from "./provider";
import { ChatAbortedError, assertNotAborted, linkAbort } from "./abort";
import { streamLines } from "./online/online-http";
import { parseOllamaContextLength } from "../studio/context-window";
import { parseOllamaLine } from "./online/stream-parse";

// HTTP client tới Ollama (Constitution III: chỉ chạy ở main). Nhận `fetchFn` tiêm vào để unit-test
// không cần Ollama thật. baseUrl mặc định localhost:11434 (A7), override qua env OLLAMA_HOST.

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";

type FetchFn = typeof fetch;

/**
 * Chỉ chấp nhận Ollama host trỏ localhost/127.0.0.1 (Constitution I: local, không egress). Env OLLAMA_HOST
 * trỏ ra ngoài → bỏ qua + fallback default (không để hành vi thật lệch badge "Chạy cục bộ"). Trả về [url, warn?].
 */
export function resolveBaseUrl(
  envHost: string | undefined,
  explicit?: string,
): { url: string; warning: string | null } {
  const candidate = explicit ?? envHost;
  if (!candidate) return { url: DEFAULT_OLLAMA_URL, warning: null };
  try {
    const u = new URL(candidate);
    const isLocal =
      (u.protocol === "http:" || u.protocol === "https:") &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1");
    if (isLocal) return { url: candidate.replace(/\/$/, ""), warning: null };
  } catch {
    // URL không hợp lệ → fallback bên dưới.
  }
  return {
    url: DEFAULT_OLLAMA_URL,
    warning: `OLLAMA_HOST is not localhost — ignored, using ${DEFAULT_OLLAMA_URL}.`,
  };
}

export interface OllamaClientOptions {
  fetchFn?: FetchFn;
  baseUrl?: string;
  /** Timeout mặc định (ping/listModels — kiểm sẵn sàng, cần ngắn). */
  timeoutMs?: number;
  /** Timeout cho chat (LLM sinh câu trả lời — cần dài). */
  chatTimeoutMs?: number;
  /** Timeout cho embed. */
  embedTimeoutMs?: number;
}

// Sinh câu trả lời LLM có thể mất hàng chục giây (model local 7B+) → timeout dài hơn nhiều ping (issue #15).
const DEFAULT_CHAT_TIMEOUT_MS = 120_000;
/** 105: lượt có prompt lớn (num_ctx tường minh — Studio) — nạp/prefill vài chục nghìn token trên máy cá nhân lâu. */
export const LARGE_CHAT_TIMEOUT_MS = 300_000;
const DEFAULT_EMBED_TIMEOUT_MS = 60_000;

export interface OllamaClient {
  /** GET /api/tags → Model[]. Lỗi/không kết nối → [] (không throw). */
  listModels(): Promise<Model[]>;
  /** true nếu Ollama phản hồi trong timeout. */
  ping(): Promise<boolean>;
  chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
  /** 105: cửa sổ ngữ cảnh của model (POST /api/show). Lỗi/không rõ → null (không throw). */
  contextLength(model: string): Promise<number | null>;
}

/** Suy đoán loại model từ tên (v1 heuristic — Ollama /api/tags không trả kind rõ ràng). */
export function inferKind(name: string): Model["kind"] {
  return /embed/i.test(name) ? "embedding" : "chat";
}

interface RawTag {
  name: string;
  size?: number;
}

/** 105: num_ctx tường minh khi có. 238: temperature deterministic cho chế độ chuyên gia. */
const modelOptions = (
  req: ChatRequest,
): { options?: { num_ctx?: number; temperature?: number } } => {
  const options: { num_ctx?: number; temperature?: number } = {};
  if (req.numCtx) options.num_ctx = req.numCtx;
  if (req.temperature !== undefined) options.temperature = req.temperature;
  return Object.keys(options).length > 0 ? { options } : {};
};

/** Giá trị `think` gửi Ollama: false = tắt suy luận; "low" = mức thấp nhất (gpt-oss bỏ qua false). */
export type ThinkSetting = false | "low";

/**
 * Model "thinking" (qwen3.x, gpt-oss…): Ollama TỰ BẬT suy luận khi request không gửi `think` — đo qwen3.5:9b: 76s /
 * 3.606 token cho 1 lượt viết lại câu hỏi (0,55s khi tắt), dễ vượt timeout chat và ăn num_ctx. Đọc `capabilities`
 * từ `/api/show`: có "thinking" ⇒ tắt; gpt-oss không tắt hẳn được (think:false bị bỏ qua) ⇒ "low".
 * Không có/không rõ (Ollama bản cũ, model thường) ⇒ undefined: KHÔNG gửi `think`, giữ request như cũ.
 */
export function thinkSettingFor(show: unknown): ThinkSetting | undefined {
  if (show === null || typeof show !== "object") return undefined;
  const { capabilities, model_info: info } = show as {
    capabilities?: unknown;
    model_info?: unknown;
  };
  if (!Array.isArray(capabilities) || !capabilities.includes("thinking"))
    return undefined;
  const arch =
    info && typeof info === "object"
      ? (info as Record<string, unknown>)["general.architecture"]
      : undefined;
  return arch === "gpt-oss" || arch === "gptoss" ? "low" : false;
}

export function createOllamaClient(
  opts: OllamaClientOptions = {},
): OllamaClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const { url: baseUrl, warning } = resolveBaseUrl(
    process.env["OLLAMA_HOST"],
    opts.baseUrl,
  );
  if (warning) logEvent("ai.ollamaHost.rejected", { warning });
  const timeoutMs = opts.timeoutMs ?? 5000;
  const chatTimeoutMs = opts.chatTimeoutMs ?? DEFAULT_CHAT_TIMEOUT_MS;
  const embedTimeoutMs = opts.embedTimeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;
  // Nhớ `think` theo tên model — dò /api/show 1 lần. KHÔNG nhớ khi dò lỗi (Ollama chưa chạy) ⇒ lần sau dò lại.
  const thinkCache = new Map<string, ThinkSetting | undefined>();

  async function call(
    path: string,
    init?: RequestInit,
    timeout: number = timeoutMs,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetchFn(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function showModel(model: string): Promise<unknown> {
    const res = await call("/api/show", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // gửi cả `name` cho Ollama bản cũ
      body: JSON.stringify({ model, name: model }),
    });
    return res.ok ? res.json() : null;
  }

  async function thinkOptions(
    model: string | undefined,
  ): Promise<{ think?: ThinkSetting }> {
    if (!model) return {};
    if (!thinkCache.has(model)) {
      try {
        const show = await showModel(model);
        if (show === null) return {};
        thinkCache.set(model, thinkSettingFor(show));
      } catch {
        return {};
      }
    }
    const think = thinkCache.get(model);
    return think === undefined ? {} : { think };
  }

  return {
    async listModels() {
      try {
        const res = await call("/api/tags");
        if (!res.ok) return [];
        const data = (await res.json()) as { models?: RawTag[] };
        return (data.models ?? []).map((m) => ({
          name: m.name,
          sizeBytes: typeof m.size === "number" ? m.size : null,
          kind: inferKind(m.name),
        }));
      } catch {
        return [];
      }
    },

    async ping() {
      try {
        const res = await call("/api/tags");
        return res.ok;
      } catch {
        return false;
      }
    },

    async chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult> {
      // Stream (039): NDJSON stream:true → nối delta qua onToken; giữ phần đã nhận khi huỷ (signal).
      if (opts?.onToken) {
        const think = await thinkOptions(req.model);
        let acc = "";
        await streamLines(
          {
            url: `${baseUrl}/api/chat`,
            headers: {},
            body: {
              model: req.model,
              messages: req.messages,
              stream: true,
              ...think,
              ...modelOptions(req),
            },
            fetchFn,
            signal: opts.signal,
            providerLabel: "Ollama",
            // 103: Ollama chạy cục bộ (OLLAMA_HOST chỉ loopback) — KHÔNG phải dữ liệu rời máy, badge giữ nguyên.
            egress: false,
          },
          (line) => {
            const delta = parseOllamaLine(line);
            if (delta) {
              acc += delta;
              opts.onToken!(delta);
            }
          },
        );
        return { content: acc };
      }
      // 149: nhánh không-stream (Studio) tôn trọng signal ngoài — phạm vi gồm cả đọc body; huỷ ⇒ ChatAbortedError (≠ timeout).
      const signal = opts?.signal;
      assertNotAborted(signal);
      const think = await thinkOptions(req.model);
      assertNotAborted(signal);
      const controller = new AbortController();
      const unlink = linkAbort(signal, controller);
      const timer = setTimeout(
        () => controller.abort(),
        req.numCtx
          ? Math.max(chatTimeoutMs, LARGE_CHAT_TIMEOUT_MS)
          : chatTimeoutMs,
      );
      try {
        const res = await fetchFn(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: req.model,
            messages: req.messages,
            stream: false,
            ...think,
            ...modelOptions(req),
          }),
          signal: controller.signal,
        });
        if (!res.ok)
          throw new UserFacingError("ollamaHttp", { status: res.status });
        const data = (await res.json()) as { message?: { content?: string } };
        return { content: data.message?.content ?? "" };
      } catch (e) {
        if (signal?.aborted) throw new ChatAbortedError();
        throw e;
      } finally {
        clearTimeout(timer);
        unlink();
      }
    },

    async contextLength(model: string): Promise<number | null> {
      try {
        const show = await showModel(model);
        return show === null ? null : parseOllamaContextLength(show);
      } catch {
        return null;
      }
    },

    async embed(req: EmbedRequest): Promise<EmbedResult> {
      const res = await call(
        "/api/embeddings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: req.model, prompt: req.text }),
        },
        embedTimeoutMs,
      );
      if (!res.ok)
        throw new UserFacingError("ollamaHttp", { status: res.status });
      const data = (await res.json()) as { embedding?: number[] };
      return { vector: data.embedding ?? [] };
    },
  };
}
