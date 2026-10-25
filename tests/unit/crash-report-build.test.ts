import { describe, it, expect } from "vitest";
import {
  ISSUE_URL_BASE,
  MAX_REPORT_CHARS,
  MAX_URL_LENGTH,
  buildIssueUrl,
  buildReport,
  isAllowedIssueUrl,
  parseLogRecords,
  reportTitle,
  summarizeNativeCrashes,
  validateIssueInput,
} from "../../src/main/services/crash-report/report";

// 093 — báo lỗi opt-in: soạn báo cáo đã làm sạch từ main.log + tóm tắt crash native (không đính kèm dump),
// tạo URL GitHub issue điền sẵn với đích CỐ ĐỊNH; giới hạn độ dài theo giới hạn URL.

const ENV = {
  appVersion: "0.2.4",
  electronVersion: "43.1.0",
  platform: "darwin",
  arch: "arm64",
  osRelease: "25.0.0",
};

const line = (o: Record<string, unknown>): string => JSON.stringify(o);

describe("parseLogRecords", () => {
  it("bỏ qua dòng hỏng/rỗng, giữ bản ghi hợp lệ", () => {
    const recs = parseLogRecords([
      line({ ts: "t1", level: "info", event: "app.start", meta: {} }),
      "{hỏng",
      "",
      line({ ts: "t2", level: "error", event: "renderer.gone", meta: {} }),
      line({ foo: 1 }),
    ]);
    expect(recs.map((r) => r.event)).toEqual(["app.start", "renderer.gone"]);
  });
});

describe("buildReport", () => {
  it("môi trường + lỗi gần đây (chỉ mức error) + crash native + chỗ mô tả", () => {
    const text = buildReport({
      env: ENV,
      records: parseLogRecords([
        line({
          ts: "2026-10-06T01:00:00.000Z",
          level: "info",
          event: "app.start",
          meta: {},
        }),
        line({
          ts: "2026-10-06T01:02:00.000Z",
          level: "error",
          event: "renderer.error",
          meta: {
            source: "boundary",
            errorType: "TypeError",
            components: ["Workspace", "ErrorBoundary"],
          },
        }),
      ]),
      nativeCrashes: { count: 2, latestAt: "2026-10-05T10:00:00.000Z" },
    });
    expect(text).toContain("SourceCraft 0.2.4");
    expect(text).toContain("Electron 43.1.0");
    expect(text).toContain("darwin 25.0.0 (arm64)");
    expect(text).toContain(
      "2026-10-06T01:02:00.000Z renderer.error source=boundary errorType=TypeError components=Workspace>ErrorBoundary",
    );
    expect(text).not.toContain("app.start");
    expect(text).toContain("Native crashes on this computer: 2");
    // 123 (decision #13): khung báo cáo gửi nhà phát triển cố định English — không ký tự tiếng Việt.
    expect(text).not.toMatch(
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i,
    );
    expect(text).toContain("2026-10-05T10:00:00.000Z");
    expect(text).toMatch(/minidump.*not attached/i);
    expect(text).toContain("What were you doing");
  });

  it("không có lỗi ⇒ ghi rõ, chỉ giữ tối đa maxEvents lỗi mới nhất", () => {
    expect(
      buildReport({
        env: ENV,
        records: [],
        nativeCrashes: { count: 0, latestAt: null },
      }),
    ).toContain("(no errors in the recent log)");
    const recs = parseLogRecords(
      Array.from({ length: 30 }, (_, i) =>
        line({ ts: `t${i}`, level: "error", event: `e${i}`, meta: {} }),
      ),
    );
    const text = buildReport({
      env: ENV,
      records: recs,
      nativeCrashes: { count: 0, latestAt: null },
      maxEvents: 5,
    });
    expect(text).toContain("t29 e29");
    expect(text).toContain("t25 e25");
    expect(text).not.toContain("t24 e24");
  });

  it("phòng thủ chiều sâu: chỉ khoá trong allowlist, giá trị làm sạch, che nhà, dòng dài bị cắt", () => {
    const text = buildReport({
      env: ENV,
      records: parseLogRecords([
        line({
          ts: "t",
          level: "error",
          event: "x",
          meta: {
            content: "tài liệu mật",
            stack: "at /Users/ai-do/Docs/hop-dong.pdf",
            where: "/Users/ai-do/Docs",
            errorType: "Type\n```Error",
            components: Array.from({ length: 20 }, (_, i) =>
              `C${i}`.repeat(10),
            ),
            reason: "/Users/ai-do/x",
          },
        }),
      ]),
      nativeCrashes: { count: 0, latestAt: null },
      home: "/Users/ai-do",
    });
    expect(text).not.toContain("tài liệu mật");
    expect(text).not.toContain("ai-do");
    expect(text).not.toContain("hop-dong");
    expect(text).not.toContain("where=");
    expect(text).not.toContain("stack=");
    expect(text).toContain("errorType=Type____Error");
    expect(text).toContain("reason=__x");
    expect((text.match(/```/g) ?? []).length).toBe(2);
    const errLine = text.split("\n").find((l) => l.startsWith("t x"))!;
    expect(errLine.length).toBeLessThanOrEqual(300);
  });
});

describe("summarizeNativeCrashes", () => {
  it("đếm dump sau mốc đã xem, lấy thời điểm mới nhất", () => {
    const s = summarizeNativeCrashes(
      [{ mtimeMs: 1000 }, { mtimeMs: 3000 }, { mtimeMs: 2000 }],
      1500,
    );
    expect(s).toEqual({ count: 2, latestAt: new Date(3000).toISOString() });
    expect(summarizeNativeCrashes([], 0)).toEqual({ count: 0, latestAt: null });
  });
});

describe("reportTitle / buildIssueUrl", () => {
  it("tiêu đề có phiên bản + HĐH", () => {
    expect(reportTitle(ENV)).toBe(
      "Bug report: SourceCraft 0.2.4 (darwin arm64)",
    );
  });

  it("URL đích cố định của repo, tiêu đề + nội dung được mã hoá", () => {
    const url = buildIssueUrl("Tiêu đề & #1", "Nội dung\ndòng 2");
    expect(url.startsWith(`${ISSUE_URL_BASE}?`)).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("title")).toBe("Tiêu đề & #1");
    expect(q.get("body")).toBe("Nội dung\ndòng 2");
  });

  it("quá dài ⇒ cắt PHẦN GIỮA (lỗi cũ), giữ đầu báo cáo + lỗi mới nhất + đóng code fence", () => {
    const records = parseLogRecords(
      Array.from({ length: 20 }, (_, i) =>
        line({
          ts: `2026-10-06T01:${String(i).padStart(2, "0")}:00.000Z`,
          level: "error",
          event: "renderer.error",
          meta: {
            source: "boundary",
            errorType: `Loi${i}`,
            components: [
              "Thành",
              "Phần",
              "Giao",
              "Diện",
              "Người",
              "Dùng",
              "Tiếng",
              "Việt",
              "Đầy",
              "Đủ",
            ],
            reason: "Tiếng Việt có dấu đầy đủ ".repeat(5),
          },
        }),
      ),
    );
    const body = buildReport({
      env: ENV,
      records,
      nativeCrashes: { count: 1, latestAt: "x" },
    });
    const url = buildIssueUrl("t", body);
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    const sent = new URL(url).searchParams.get("body")!;
    expect(sent).toContain("### Description");
    expect(sent).toContain("errorType=Loi19");
    expect(sent).not.toContain("errorType=Loi0 ");
    expect(sent).toContain("### Native crashes");
    expect(sent).toMatch(/middle trimmed/);
    expect((sent.match(/```/g) ?? []).length % 2).toBe(0);
  });

  it("emoji/surrogate lẻ không làm hỏng việc mã hoá URL (kể cả ở điểm cắt)", () => {
    expect(() => buildIssueUrl("t", "😀".repeat(5000))).not.toThrow();
    expect(() =>
      buildIssueUrl("lỗi \uD83D", "nội dung \uDE00 lẻ"),
    ).not.toThrow();
    const url = buildIssueUrl("t", "a😀".repeat(3000));
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
  });

  it("nội dung quá dài ⇒ cắt cho vừa giới hạn URL kèm ghi chú", () => {
    const url = buildIssueUrl("t", "Đ".repeat(20_000));
    expect(url.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    expect(new URL(url).searchParams.get("body")).toMatch(/middle trimmed/);
  });
});

describe("isAllowedIssueUrl", () => {
  it("chỉ https://github.com", () => {
    expect(isAllowedIssueUrl(`${ISSUE_URL_BASE}?title=a`)).toBe(true);
    expect(isAllowedIssueUrl("http://github.com/x")).toBe(false);
    expect(isAllowedIssueUrl("https://github.com.evil.io/x")).toBe(false);
    expect(isAllowedIssueUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedIssueUrl("không phải url")).toBe(false);
  });
});

describe("validateIssueInput", () => {
  it("chỉ nhận {title, text} là chuỗi trong giới hạn", () => {
    expect(validateIssueInput({ title: "a", text: "b" })).toEqual({
      title: "a",
      text: "b",
    });
    expect(validateIssueInput({ title: "", text: "b" })).toBeNull();
    expect(validateIssueInput({ title: "a", text: 1 })).toBeNull();
    expect(validateIssueInput(null)).toBeNull();
    expect(
      validateIssueInput({ title: "a".repeat(300), text: "b" }),
    ).toBeNull();
    expect(
      validateIssueInput({
        title: "a",
        text: "b".repeat(MAX_REPORT_CHARS + 1),
      }),
    ).toBeNull();
  });
});

describe("buildReport — hiệu năng ghi cuộc họp (186 PR B, ADR meeting-asr-spike mục 7)", () => {
  const perf = (ts: string, meta: Record<string, unknown>) => ({
    ts,
    level: "info" as const,
    event: "meeting.perf",
    meta,
  });
  const PERF = {
    platform: "win32",
    arch: "x64",
    cpu: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
    cores: 8,
    ramGb: 8,
    draftWindows: 120,
    draftRtfMean: 0.41,
    draftRtfP95: 0.73,
    draftDropped: 3,
    draftDowngraded: false,
    draftModel: "primary",
    title: "Họp bí mật", // khoá ngoài allowlist ⇒ KHÔNG được vào
  };

  it("có phiên ghi ⇒ mục riêng với 6 dòng gần nhất (≈ 3 phiên perf + finalPerf), chỉ khoá trong allowlist", () => {
    const text = buildReport({
      env: ENV,
      records: [
        perf("t1", PERF),
        perf("t2", PERF),
        perf("t3", PERF),
        perf("t3b", PERF),
        perf("t3c", PERF),
        perf("t4", { ...PERF, draftModel: "fallback", draftDowngraded: true }),
        {
          ts: "t5",
          level: "info",
          event: "meeting.finalPerf",
          meta: { rtf: 0.12, audioMin: 42.5 },
        },
      ],
      nativeCrashes: { count: 0, latestAt: null },
    });
    expect(text).toContain("### Meeting recording performance");
    const block = text.slice(text.indexOf("### Meeting recording performance"));
    expect(block).not.toContain("t1 ");
    expect(block).toContain("t4 meeting.perf");
    expect(block).toContain("draftRtfP95=0.73");
    expect(block).toContain("draftModel=fallback");
    expect(block).toContain("cpu=Intel_R__Core_TM__i5-8250U_CPU___1.60GHz");
    expect(block).toContain("t5 meeting.finalPerf rtf=0.12 audioMin=42.5");
    expect(text).not.toContain("bí mật");
  });

  it("chưa ghi cuộc họp ⇒ không có mục này", () => {
    const text = buildReport({
      env: ENV,
      records: [],
      nativeCrashes: { count: 0, latestAt: null },
    });
    expect(text).not.toContain("Meeting recording performance");
  });
});

// T023 (236) — báo lỗi chỉ đọc logs/, không bao giờ đọc thư mục audit; sự kiện audit trong main.log chỉ có mã (FR-022).
describe("crash report và nhật ký kiểm toán", () => {
  it("readLogTail chỉ đọc main.log trong logsDir, bỏ qua thư mục audit kề bên", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { readLogTail } =
      await import("../../src/main/services/crash-report/crash-fs");
    const root = mkdtempSync(join(tmpdir(), "sc-crash-audit-"));
    const logs = join(root, "logs");
    mkdirSync(logs);
    mkdirSync(join(root, "audit"));
    mkdirSync(join(logs, "audit"));
    writeFileSync(
      join(logs, "main.log"),
      line({ ts: "t", level: "info", event: "app.start", meta: {} }) + "\n",
    );
    writeFileSync(
      join(root, "audit", "audit-000000000000.jsonl"),
      '{"type":"interaction.start","secret":"Q"}\n',
    );
    writeFileSync(
      join(logs, "audit", "audit-000000000000.jsonl"),
      '{"type":"interaction.start","secret":"Q"}\n',
    );
    const tail = readLogTail(logs, 100);
    expect(tail.join("\n")).not.toContain("interaction.start");
    expect(tail.filter((l) => l.trim() !== "")).toHaveLength(1);
  });

  it("dòng audit.writeFailed trong báo cáo chỉ mang errorType", () => {
    const text = buildReport({
      env: ENV,
      records: parseLogRecords([
        line({
          ts: "2026-10-25T01:00:00.000Z",
          level: "error",
          event: "audit.writeFailed",
          meta: { errorType: "ENOSPC" },
        }),
      ]),
      nativeCrashes: { count: 0, latestAt: null },
    });
    expect(text).toContain("audit.writeFailed");
    expect(text).toContain("ENOSPC");
  });
});
