// Logging policy (T040, FR-014, Constitution III): KHÔNG log nội dung/payload người dùng.
// Chỉ log sự kiện + metadata an toàn. `redact` là hàm thuần (unit-test được).
// 088: ngoài console, mỗi sự kiện ghi thêm 1 dòng JSON vào sink (tệp nhật ký) nếu đã gắn — cùng meta đã che.

import { homedir } from "node:os";
import {
  formatLogLine,
  type LogLevel,
  type LogSink,
} from "./services/app-log/log-file";

// So khớp không phân biệt hoa thường. 088: nhật ký nay nằm lâu trên đĩa và người dùng được mời gửi đi ⇒ che thêm các
// khoá dễ mang đường dẫn/tên tệp/tiêu đề/URL/message thô của lỗi (có thể dính nội dung hoặc tên tài khoản).
const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  "text",
  "content",
  "body",
  "document",
  "query",
  "answer",
  "apikey",
  "api_key",
  "token",
  "authorization",
  "secret",
  "password", // 085 — mật khẩu sao lưu (phòng thủ chiều sâu; service vốn không log mật khẩu)
  "path",
  "filename",
  "title",
  "url",
  "message",
]);

/** Đủ sâu cho mọi meta thật; chặn tràn stack khi lỡ truyền object vòng tham chiếu (log từ uncaughtException). */
const MAX_DEPTH = 8;

/** Che các trường nhạy cảm trong object metadata trước khi log (đệ quy, giới hạn độ sâu). */
export function redact(meta: unknown, depth = 0): unknown {
  if (meta === null || typeof meta !== "object") return meta;
  if (depth >= MAX_DEPTH) return "[DEPTH]";
  if (Array.isArray(meta)) return meta.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase())
      ? "[REDACTED]"
      : redact(v, depth + 1);
  }
  return out;
}

/** Thay thư mục nhà (chứa tên tài khoản HĐH) bằng "~" trong mọi chuỗi — lưới an toàn theo GIÁ TRỊ (088). */
export function maskHome(value: unknown, home: string, depth = 0): unknown {
  if (typeof value === "string") return value.split(home).join("~");
  if (value === null || typeof value !== "object" || depth >= MAX_DEPTH)
    return value;
  if (Array.isArray(value))
    return value.map((v) => maskHome(v, home, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, maskHome(v, home, depth + 1)]),
  );
}

const HOME = homedir();

let sink: LogSink | null = null;

/** Gắn (hoặc gỡ với null) nơi ghi nhật ký bền — gọi 1 lần lúc khởi động (088). */
export function setLogSink(next: LogSink | null): void {
  sink = next;
}

function emit(
  level: LogLevel,
  event: string,
  meta: Record<string, unknown>,
): void {
  // Ghi log KHÔNG được làm hỏng tầng gọi (có cả handler uncaughtException) ⇒ mọi lỗi dừng ở đây.
  try {
    const redacted = redact(meta);
    const safe = HOME.length > 1 ? maskHome(redacted, HOME) : redacted;
    if (level === "error") console.error(`[SourceCraft] ${event}`, safe);
    else console.log(`[SourceCraft] ${event}`, safe);
    sink?.write(
      formatLogLine({ ts: new Date().toISOString(), level, event, meta: safe }),
    );
  } catch (e) {
    console.error("[SourceCraft] log.emitFailed", {
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
  }
}

/** Log sự kiện an toàn: message tĩnh + metadata đã che. Không nhận nội dung tài liệu thô. */
export function logEvent(
  event: string,
  meta: Record<string, unknown> = {},
): void {
  emit("info", event, meta);
}

/** Như logEvent nhưng mức error (lỗi runtime/crash) — dễ lọc khi đọc nhật ký (088). */
export function logError(
  event: string,
  meta: Record<string, unknown> = {},
): void {
  emit("error", event, meta);
}
