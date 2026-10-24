import { describe, it, expect, vi } from "vitest";
import { createCrashService } from "../../src/main/services/crash-report/crash-service";
import { ISSUE_URL_BASE } from "../../src/main/services/crash-report/report";

// 093 — service báo lỗi (DI): soạn bản nháp, thông báo phiên bất thường / crash native mới, mở issue với đích cố
// định, ghi nhận "đã xem" để không hỏi lại.

const ENV = {
  appVersion: "0.2.4",
  electronVersion: "43.1.0",
  platform: "win32",
  arch: "x64",
  osRelease: "10.0.26100",
};

function setup(over: Partial<Parameters<typeof createCrashService>[0]> = {}) {
  let acked = 1000;
  const openExternal = vi.fn(() => Promise.resolve());
  const log = vi.fn();
  const svc = createCrashService({
    env: ENV,
    home: "C:\\Users\\ai-do",
    abnormalExit: true,
    readLogLines: () => [
      JSON.stringify({
        ts: "t1",
        level: "error",
        event: "runtime.uncaught",
        meta: { errorType: "RangeError" },
      }),
    ],
    listDumps: () => [{ mtimeMs: 500 }, { mtimeMs: 2000 }],
    getAckedAt: () => acked,
    setAckedAt: (ms) => void (acked = ms),
    openExternal,
    now: () => 5000,
    log,
    ...over,
  });
  return { svc, openExternal, log, acked: () => acked };
}

describe("createCrashService", () => {
  it("bản nháp: tiêu đề + nội dung từ nhật ký + mọi crash native trên máy", () => {
    const { svc } = setup();
    const d = svc.getReport();
    expect(d.title).toBe("Bug report: SourceCraft 0.2.4 (win32 x64)");
    expect(d.text).toContain("runtime.uncaught errorType=RangeError");
    expect(d.text).toContain("Native crashes on this computer: 2");
  });

  it("thông báo: phiên bất thường + chỉ đếm crash native SAU lần xem trước", () => {
    expect(setup().svc.getNotice()).toEqual({
      abnormalExit: true,
      newNativeCrashes: 1,
    });
  });

  it("bỏ qua ⇒ không còn thông báo, ghi mốc đã xem", () => {
    const { svc, acked } = setup();
    expect(svc.dismissNotice()).toEqual({ ok: true });
    expect(acked()).toBe(5000);
    expect(svc.getNotice()).toEqual({
      abnormalExit: false,
      newNativeCrashes: 0,
    });
  });

  it("mở issue: đích cố định, ghi mốc đã xem, log KHÔNG chứa nội dung", async () => {
    const { svc, openExternal, log, acked } = setup();
    const res = await svc.openIssue({
      title: "Lỗi",
      text: "nội dung người dùng sửa",
    });
    expect(res).toEqual({ ok: true });
    const url = (openExternal.mock.calls[0] as unknown[])[0] as string;
    expect(url.startsWith(ISSUE_URL_BASE)).toBe(true);
    expect(acked()).toBe(5000);
    expect(log).toHaveBeenCalledWith("crash.issueOpened", expect.any(Object));
    expect(JSON.stringify(log.mock.calls)).not.toContain("nội dung người dùng");
  });

  it("đầu vào sai ⇒ ok:false, không mở gì", async () => {
    const { svc, openExternal } = setup();
    expect(await svc.openIssue({ title: "", text: "x" })).toEqual({
      ok: false,
    });
    expect(await svc.openIssue("bậy")).toEqual({ ok: false });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("mở trình duyệt lỗi ⇒ ok:false, ghi loại lỗi", async () => {
    const { svc, log } = setup({
      openExternal: () => Promise.reject(new TypeError("no browser")),
    });
    expect(await svc.openIssue({ title: "a", text: "b" })).toEqual({
      ok: false,
    });
    expect(log).toHaveBeenCalledWith("crash.issueOpenFailed", {
      errorType: "TypeError",
    });
  });

  it("chặn mở trình duyệt dồn dập (renderer bị chiếm gọi lặp): cách nhau ≥ minIntervalMs, tối đa maxPerSession", async () => {
    let t = 10_000;
    const { svc, openExternal } = setup({
      now: () => t,
      minIntervalMs: 5000,
      maxPerSession: 2,
    });
    const input = { title: "a", text: "b" };
    expect(await svc.openIssue(input)).toEqual({ ok: true });
    expect(await svc.openIssue(input)).toEqual({ ok: false, throttled: true });
    t += 5000;
    expect(await svc.openIssue(input)).toEqual({ ok: true });
    t += 60_000;
    expect(await svc.openIssue(input)).toEqual({ ok: false, throttled: true });
    expect(openExternal).toHaveBeenCalledTimes(2);
  });

  it("lưới cuối: URL không phải https://github.com ⇒ không mở", async () => {
    const { svc, openExternal, log } = setup({
      buildUrl: () => "javascript:alert(1)",
    });
    expect(await svc.openIssue({ title: "a", text: "b" })).toEqual({
      ok: false,
    });
    expect(openExternal).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("crash.issueUrlRejected", {});
  });

  it("đọc nhật ký/dump lỗi ⇒ vẫn soạn được báo cáo", () => {
    const { svc } = setup({
      readLogLines: () => {
        throw new Error("ENOENT");
      },
      listDumps: () => {
        throw new Error("ENOENT");
      },
    });
    expect(svc.getReport().text).toContain("(no errors in the recent log)");
    expect(svc.getNotice().newNativeCrashes).toBe(0);
  });
});
