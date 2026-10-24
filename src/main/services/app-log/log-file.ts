import { join } from "node:path";

// 088 — nhật ký ra file (JSON lines, xoay vòng theo dung lượng). Logic thuần + fs tiêm vào (test không chạm đĩa).
// Nội dung ghi đã qua `redact` ở logging.ts (Constitution III) — module này không biết gì về dữ liệu người dùng.

export type LogLevel = "info" | "error";

export interface LogRecord {
  ts: string;
  level: LogLevel;
  event: string;
  meta: unknown;
}

/** Thao tác fs tối thiểu sink cần (đồng bộ: log ít, cần ghi xong trước khi tiến trình thoát vì lỗi). */
export interface LogFs {
  mkdir(dir: string): void;
  /** Kích thước tệp tính bằng byte; 0 nếu chưa có. */
  size(path: string): number;
  append(path: string, data: string): void;
  /** Đổi tên; bỏ qua nếu nguồn không tồn tại. */
  rename(from: string, to: string): void;
  /** Xoá; bỏ qua nếu không tồn tại. */
  remove(path: string): void;
}

export interface LogSink {
  write(line: string): void;
}

export const LOG_MAX_BYTES = 1_000_000;
export const LOG_MAX_FILES = 3;

/** 1 bản ghi → 1 dòng JSON. Meta không tuần tự hoá được (vòng tham chiếu…) ⇒ thay bằng chuỗi đánh dấu. */
export function formatLogLine(record: LogRecord): string {
  try {
    return JSON.stringify(record) + "\n";
  } catch {
    return JSON.stringify({ ...record, meta: "[unserializable]" }) + "\n";
  }
}

/** [main.log, main.1.log, …] — chỉ số càng lớn càng cũ. */
export function logFileNames(dir: string, maxFiles: number): string[] {
  return Array.from({ length: maxFiles }, (_, i) =>
    join(dir, i === 0 ? "main.log" : `main.${i}.log`),
  );
}

export interface FileSinkOptions {
  dir: string;
  fs: LogFs;
  maxBytes?: number;
  maxFiles?: number;
  /** Gọi 1 lần khi sink hỏng (truyền loại lỗi, không message) — sau đó sink tắt, app chạy tiếp. */
  onError?: (errorType: string) => void;
}

const errorTypeOf = (e: unknown): string =>
  e instanceof Error ? e.constructor.name : typeof e;

export function createFileSink({
  dir,
  fs,
  maxBytes = LOG_MAX_BYTES,
  maxFiles = LOG_MAX_FILES,
  onError,
}: FileSinkOptions): LogSink {
  const files = logFileNames(dir, maxFiles);
  const current = files[0];
  let disabled = false;
  let size = 0;

  const disable = (e: unknown): void => {
    disabled = true;
    onError?.(errorTypeOf(e));
  };

  try {
    fs.mkdir(dir);
    size = fs.size(current);
  } catch (e) {
    disable(e);
  }

  // Xoay vòng là phụ: lỗi (Windows EBUSY khi antivirus/trình xem log giữ tệp) ⇒ ghi tiếp vào tệp hiện tại, lần
  // ghi sau thử xoay lại. KHÔNG tắt nhật ký: 1 lần đổi tên lỗi mà mất cả phiên log là mất đúng thứ cần để chẩn đoán.
  const tryRotate = (): void => {
    try {
      fs.remove(files[files.length - 1]);
      for (let i = files.length - 2; i >= 0; i--)
        fs.rename(files[i], files[i + 1]);
      size = 0;
    } catch {
      /* giữ nguyên size ⇒ lần ghi sau thử lại */
    }
  };

  // Thư mục log bị xoá giữa phiên (ENOENT) ⇒ tạo lại rồi ghi lại 1 lần; vẫn lỗi (EACCES, ENOSPC…) ⇒ tắt sink.
  const append = (line: string): void => {
    try {
      fs.append(current, line);
    } catch {
      fs.mkdir(dir);
      fs.append(current, line);
    }
  };

  return {
    write(line: string): void {
      if (disabled) return;
      const bytes = Buffer.byteLength(line);
      if (size > 0 && size + bytes > maxBytes) tryRotate();
      try {
        append(line);
        size += bytes;
      } catch (e) {
        disable(e);
      }
    },
  };
}

export interface LogsDirInput {
  packaged: boolean;
  /** app.getPath("logs") — thư mục log chuẩn HĐH. */
  osLogsPath: string;
  userDataPath: string;
}

/**
 * Bản đóng gói ghi vào thư mục log chuẩn HĐH (macOS ~/Library/Logs/SourceCraft, Windows <userData>\logs).
 * Dev/E2E (chưa đóng gói) ghi vào <userData>/logs để không lẫn với log của bản cài thật và mỗi E2E có
 * userData tạm riêng.
 */
export function resolveLogsDir({
  packaged,
  osLogsPath,
  userDataPath,
}: LogsDirInput): string {
  return packaged ? osLogsPath : join(userDataPath, "logs");
}
