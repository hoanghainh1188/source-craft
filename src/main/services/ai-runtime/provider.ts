import type {
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  RuntimeStatus,
} from "@shared/ipc/types";

/** Tuỳ chọn streaming cho chat (039). onToken có → provider stream (gọi mỗi delta) + vẫn trả content đầy
 * đủ. Không có → hành vi chờ-trọn (Studio). signal → huỷ giữa chừng (cả hai nhánh). */
export interface ChatStreamOpts {
  onToken?: (delta: string) => void;
  /** Huỷ: stream (039) giữ phần đã nhận; 149 — nhánh không-stream (Studio) ném ChatAbortedError (≠ timeout). */
  signal?: AbortSignal;
}

// Giao diện chung cho "nhà cung cấp AI" (ADR D3). Mọi nơi gọi AI đi qua đây, không phụ thuộc Ollama.
// v1: OllamaProvider. Feature 008 thêm provider online qua CÙNG interface (SC-006). 039: chat nhận opts stream.
export interface LLMProvider {
  readonly id: string;
  chat(req: ChatRequest, opts?: ChatStreamOpts): Promise<ChatResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
  /** Tự kiểm tra sẵn sàng (kết nối + model đang dùng tồn tại). */
  test(): Promise<RuntimeStatus>;
  /** Kiểm tra sẵn sàng RẺ cho cổng Chat (hỏi lại thường xuyên) — không có ⇒ dùng test(). Online: không gọi mạng. */
  readiness?(): Promise<RuntimeStatus>;
  /** 105: cửa sổ ngữ cảnh (token) của model chat đang dùng; không rõ ⇒ null. */
  contextTokens?(): Promise<number | null>;
}
