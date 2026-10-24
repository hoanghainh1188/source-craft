// 123 (decision #13): khung báo cáo gửi nhà phát triển CỐ ĐỊNH English (dễ phân loại; khoá/tên sự kiện vốn English).
import { maskHome, redact } from "../../logging";
import type { LogRecord } from "../app-log/log-file";
import {
  CRASH_REPORT_MAX_CHARS,
  CRASH_TITLE_MAX_CHARS,
} from "@shared/crash-report-limits";

// 093 — báo lỗi opt-in (ADR 2026-10-06-crash-report-clarify): soạn báo cáo văn bản đã làm sạch để NGƯỜI DÙNG xem,
// sửa rồi tự gửi qua GitHub issue điền sẵn. Thuần (không I/O). Không đính kèm minidump — chỉ đếm.

/** Đích CỐ ĐỊNH (renderer không chọn được). */
export const ISSUE_URL_BASE =
  "https://github.com/hoanghainh1188/source-craft/issues/new";
/** GitHub từ chối URL quá dài (~8 KB); chừa biên an toàn. */
export const MAX_URL_LENGTH = 7500;
/** Giới hạn nội dung người dùng có thể gửi qua IPC (dùng chung với ô nhập ở renderer). */
export const MAX_REPORT_CHARS = CRASH_REPORT_MAX_CHARS;
const MAX_TITLE_CHARS = CRASH_TITLE_MAX_CHARS;
const MAX_LINE_CHARS = 300;
const DEFAULT_MAX_EVENTS = 20;

export interface ReportEnv {
  appVersion: string;
  electronVersion: string;
  platform: string;
  arch: string;
  osRelease: string;
}

export interface NativeCrashSummary {
  count: number;
  latestAt: string | null;
}

/** Dòng JSON của main.log → bản ghi; bỏ dòng hỏng (tệp có thể bị cắt giữa chừng khi crash). */
export function parseLogRecords(lines: string[]): LogRecord[] {
  const out: LogRecord[] = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    try {
      const r = JSON.parse(l) as Partial<LogRecord>;
      if (typeof r.event === "string" && typeof r.ts === "string") {
        out.push({
          ts: r.ts,
          level: r.level === "error" ? "error" : "info",
          event: r.event,
          meta: r.meta ?? {},
        });
      }
    } catch {
      /* dòng hỏng — bỏ qua */
    }
  }
  return out;
}

/**
 * Chỉ các khoá meta này được vào báo cáo (allowlist — sắp rời máy). Một logError tương lai thêm khoá chứa chuỗi tự do
 * (stack, message, file…) sẽ KHÔNG lọt ra ngoài dù redact theo tên khoá bỏ sót.
 */
export const REPORT_META_KEYS: ReadonlySet<string> = new Set([
  "errorType",
  "source",
  "components",
  "reason",
  "exitCode",
  "type",
  "code",
  "max",
  "version",
  "platform",
  "arch",
  "packaged",
  "ready",
  "outcome",
]);
const MAX_VALUE_CHARS = 80;

/** 186 PR B (ADR meeting-asr-spike mục 7): khoá của dòng chẩn đoán hiệu năng ghi cuộc họp — chỉ số đo + cấu hình máy. */
const PERF_EVENTS: ReadonlySet<string> = new Set([
  "meeting.perf",
  "meeting.finalPerf",
]);
const PERF_META_KEYS: ReadonlySet<string> = new Set([
  "platform",
  "arch",
  "cpu",
  "cores",
  "ramGb",
  "draftWindows",
  "draftRtfMean",
  "draftRtfP95",
  "draftDropped",
  "draftDowngraded",
  "draftModel",
  "rtf",
  "audioMin",
]);
const MAX_PERF_RECORDS = 6;

/** Giá trị → chuỗi an toàn: chỉ chữ/số/._:>- (không xuống dòng, không ``` phá khối code), cắt độ dài. */
function cleanValue(v: unknown): string {
  const raw = Array.isArray(v) ? v.map(String).join(">") : String(v);
  const clean = raw.replace(/[^\p{L}\p{N}_.:>-]/gu, "_");
  return clean.length > MAX_VALUE_CHARS
    ? `${clean.slice(0, MAX_VALUE_CHARS - 1)}…`
    : clean;
}

function formatRecord(
  r: LogRecord,
  home: string | undefined,
  keys: ReadonlySet<string> = REPORT_META_KEYS,
): string {
  // Phòng thủ chiều sâu: meta đã redact lúc ghi; soạn báo cáo thì redact + che thư mục nhà lại, rồi chỉ giữ khoá
  // trong allowlist với giá trị đã làm sạch.
  const clean = redact(r.meta);
  const safe = (home ? maskHome(clean, home) : clean) as unknown;
  const pairs =
    safe !== null && typeof safe === "object" && !Array.isArray(safe)
      ? Object.entries(safe as Record<string, unknown>)
          .filter(([k]) => keys.has(k))
          .map(([k, v]) => `${k}=${cleanValue(v)}`)
      : [];
  const text = [cleanValue(r.ts), cleanValue(r.event), ...pairs].join(" ");
  return text.length > MAX_LINE_CHARS
    ? `${text.slice(0, MAX_LINE_CHARS - 1)}…`
    : text;
}

export interface BuildReportInput {
  env: ReportEnv;
  records: LogRecord[];
  nativeCrashes: NativeCrashSummary;
  maxEvents?: number;
  /** Thư mục nhà để che (tên tài khoản HĐH). */
  home?: string;
}

export function buildReport({
  env,
  records,
  nativeCrashes,
  maxEvents = DEFAULT_MAX_EVENTS,
  home,
}: BuildReportInput): string {
  const errors = records.filter((r) => r.level === "error").slice(-maxEvents);
  const errorBlock =
    errors.length > 0
      ? errors.map((r) => formatRecord(r, home)).join("\n")
      : "(no errors in the recent log)";
  const perf = records
    .filter((r) => PERF_EVENTS.has(r.event))
    .slice(-MAX_PERF_RECORDS)
    .map((r) => formatRecord(r, home, PERF_META_KEYS));
  const perfBlock =
    perf.length > 0
      ? [
          "### Meeting recording performance",
          "Speed of on-device speech recognition on this computer (rtf < 1 = faster than real time), with its CPU model, core count and RAM. No audio, text or titles.",
          "```",
          ...perf,
          "```",
          "",
        ]
      : [];
  const native =
    nativeCrashes.count > 0
      ? `Native crashes on this computer: ${nativeCrashes.count} (latest ${nativeCrashes.latestAt})`
      : "Native crashes on this computer: 0";
  return [
    "### Description",
    "What were you doing when the error happened? Does it happen again? (Don't paste sensitive document content here.)",
    "",
    "",
    "### Environment",
    `- SourceCraft ${env.appVersion} · Electron ${env.electronVersion}`,
    `- ${env.platform} ${env.osRelease} (${env.arch})`,
    "",
    "### Recent errors (newest last)",
    "```",
    errorBlock,
    "```",
    "",
    ...perfBlock,
    "### Native crashes",
    `- ${native}`,
    "- Minidump files stay on this computer and are not attached (they may contain document content).",
    "",
    "_Report generated by SourceCraft from its local log — it contains no document content, questions or answers._",
  ].join("\n");
}

export function summarizeNativeCrashes(
  dumps: { mtimeMs: number }[],
  ackedAtMs: number,
): NativeCrashSummary {
  const fresh = dumps.filter((d) => d.mtimeMs > ackedAtMs);
  if (fresh.length === 0) return { count: 0, latestAt: null };
  const latest = Math.max(...fresh.map((d) => d.mtimeMs));
  return { count: fresh.length, latestAt: new Date(latest).toISOString() };
}

export function reportTitle(env: ReportEnv): string {
  return `Bug report: SourceCraft ${env.appVersion} (${env.platform} ${env.arch})`;
}

const MIDDLE_NOTE =
  "\n…(middle trimmed — older errors — to fit GitHub's limit; see main.log)…\n";

/** Thay surrogate lẻ bằng U+FFFD — encodeURIComponent ném URIError với chuỗi không hợp lệ (người dùng dán emoji hỏng). */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const wellFormed = (s: string): string => s.replace(LONE_SURROGATE, "\uFFFD");

const urlFor = (title: string, body: string): string =>
  `${ISSUE_URL_BASE}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

/**
 * URL trang tạo issue điền sẵn. Quá dài ⇒ cắt PHẦN GIỮA theo code point (không cắt đôi emoji): giữ đầu báo cáo (mô
 * tả, môi trường, mở khối lỗi) + đuôi (lỗi MỚI NHẤT, crash native, đóng khối code) — bỏ các lỗi cũ (ADR 093).
 */
export function buildIssueUrl(title: string, body: string): string {
  const t = wellFormed(title);
  const b = wellFormed(body);
  let url = urlFor(t, b);
  if (url.length <= MAX_URL_LENGTH) return url;
  const chars = Array.from(b);
  const fence = b.indexOf("```\n");
  let keep = chars.length;
  while (keep > 0) {
    keep = Math.floor(keep * 0.9);
    // Đầu: tới hết dòng mở khối code nếu nằm trong nửa đầu phần giữ lại, không thì 30%.
    const fenceEnd = fence >= 0 ? Array.from(b.slice(0, fence + 4)).length : -1;
    const head =
      fenceEnd > 0 && fenceEnd < keep * 0.5 ? fenceEnd : Math.floor(keep * 0.3);
    const tail = keep - head;
    url = urlFor(
      t,
      chars.slice(0, head).join("") +
        MIDDLE_NOTE +
        chars.slice(chars.length - tail).join(""),
    );
    if (url.length <= MAX_URL_LENGTH) return url;
  }
  return urlFor(t, MIDDLE_NOTE.trim());
}

/** Lưới cuối trước shell.openExternal: chỉ https://github.com (chặn hồi quy nếu ai đổi ISSUE_URL_BASE). */
export function isAllowedIssueUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.host === "github.com";
  } catch {
    return false;
  }
}

export interface IssueInput {
  title: string;
  text: string;
}

/** Đầu vào từ renderer (không tin cậy): chuỗi không rỗng, trong giới hạn. */
export function validateIssueInput(input: unknown): IssueInput | null {
  if (input === null || typeof input !== "object") return null;
  const { title, text } = input as Record<string, unknown>;
  if (typeof title !== "string" || typeof text !== "string") return null;
  if (title.trim() === "" || title.length > MAX_TITLE_CHARS) return null;
  if (text.length > MAX_REPORT_CHARS) return null;
  return { title, text };
}
