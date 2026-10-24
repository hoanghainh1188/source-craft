import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import {
  createFileSink,
  formatLogLine,
  logFileNames,
  resolveLogsDir,
  type LogFs,
} from "../../src/main/services/app-log/log-file";

// 088 — nhật ký ra file: dòng JSON + xoay vòng theo dung lượng. fs giả trong bộ nhớ (không chạm đĩa).

function memFs(initial: Record<string, string> = {}): LogFs & {
  files: Map<string, string>;
  dirs: string[];
} {
  const files = new Map(Object.entries(initial));
  const dirs: string[] = [];
  return {
    files,
    dirs,
    mkdir: (d) => void dirs.push(d),
    size: (p) => (files.has(p) ? Buffer.byteLength(files.get(p)!) : 0),
    append: (p, data) => void files.set(p, (files.get(p) ?? "") + data),
    rename: (from, to) => {
      if (!files.has(from)) return;
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    remove: (p) => void files.delete(p),
  };
}

const DIR = "/logs";

describe("formatLogLine", () => {
  it("1 dòng JSON kết thúc bằng xuống dòng", () => {
    const line = formatLogLine({
      ts: "2026-10-06T00:00:00.000Z",
      level: "info",
      event: "app.start",
      meta: { version: "0.2.4" },
    });
    expect(line.endsWith("\n")).toBe(true);
    expect(line.split("\n")).toHaveLength(2);
    expect(JSON.parse(line)).toEqual({
      ts: "2026-10-06T00:00:00.000Z",
      level: "info",
      event: "app.start",
      meta: { version: "0.2.4" },
    });
  });

  it("meta không tuần tự hoá được (vòng tham chiếu) ⇒ vẫn ra dòng hợp lệ", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    const parsed = JSON.parse(
      formatLogLine({ ts: "t", level: "error", event: "x", meta: loop }),
    );
    expect(parsed.event).toBe("x");
    expect(parsed.meta).toBe("[unserializable]");
  });
});

describe("logFileNames", () => {
  it("main.log, main.1.log, main.2.log theo maxFiles", () => {
    expect(logFileNames(DIR, 3)).toEqual([
      join(DIR, "main.log"),
      join(DIR, "main.1.log"),
      join(DIR, "main.2.log"),
    ]);
  });
});

describe("createFileSink", () => {
  it("tạo thư mục và ghi nối vào main.log", () => {
    const fs = memFs();
    const sink = createFileSink({ dir: DIR, fs });
    sink.write("a\n");
    sink.write("b\n");
    expect(fs.dirs).toContain(DIR);
    expect(fs.files.get(join(DIR, "main.log"))).toBe("a\nb\n");
  });

  it("vượt maxBytes ⇒ xoay vòng, giữ tối đa maxFiles tệp", () => {
    const fs = memFs();
    const sink = createFileSink({ dir: DIR, fs, maxBytes: 4, maxFiles: 3 });
    for (const l of ["111\n", "222\n", "333\n", "444\n"]) sink.write(l);
    expect(fs.files.get(join(DIR, "main.log"))).toBe("444\n");
    expect(fs.files.get(join(DIR, "main.1.log"))).toBe("333\n");
    expect(fs.files.get(join(DIR, "main.2.log"))).toBe("222\n");
    // bản cũ nhất ("111") đã bị bỏ — không có main.3.log
    expect(fs.files.has(join(DIR, "main.3.log"))).toBe(false);
    expect(fs.files.size).toBe(3);
  });

  it("tính cả dung lượng tệp có sẵn từ phiên trước", () => {
    const fs = memFs({ [join(DIR, "main.log")]: "old\n" });
    const sink = createFileSink({ dir: DIR, fs, maxBytes: 6 });
    sink.write("new\n");
    expect(fs.files.get(join(DIR, "main.log"))).toBe("new\n");
    expect(fs.files.get(join(DIR, "main.1.log"))).toBe("old\n");
  });

  it("1 dòng lớn hơn maxBytes vào tệp rỗng ⇒ vẫn ghi, không xoay vô ích", () => {
    const fs = memFs();
    const sink = createFileSink({ dir: DIR, fs, maxBytes: 2 });
    sink.write("dài-hơn\n");
    expect(fs.files.get(join(DIR, "main.log"))).toBe("dài-hơn\n");
    expect(fs.files.has(join(DIR, "main.1.log"))).toBe(false);
  });

  it("xoay vòng lỗi (Windows EBUSY khi đổi tên) ⇒ vẫn ghi tiếp vào main.log, không tắt sink", () => {
    const fs = memFs({ [join(DIR, "main.log")]: "cũ\n" });
    fs.rename = () => {
      throw new Error("EBUSY");
    };
    const onError = vi.fn();
    const sink = createFileSink({ dir: DIR, fs, maxBytes: 4, onError });
    sink.write("mới\n");
    sink.write("nữa\n");
    expect(fs.files.get(join(DIR, "main.log"))).toBe("cũ\nmới\nnữa\n");
    expect(onError).not.toHaveBeenCalled();
  });

  it("thư mục log bị xoá giữa phiên ⇒ tạo lại thư mục và ghi lại 1 lần", () => {
    const fs = memFs();
    let missing = true;
    const append = fs.append;
    fs.append = (p, d) => {
      if (missing) {
        missing = false;
        throw new Error("ENOENT");
      }
      append(p, d);
    };
    const onError = vi.fn();
    const sink = createFileSink({ dir: DIR, fs, onError });
    sink.write("a\n");
    expect(fs.files.get(join(DIR, "main.log"))).toBe("a\n");
    expect(fs.dirs.filter((d) => d === DIR)).toHaveLength(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("lỗi ghi ⇒ báo onError 1 lần rồi tắt sink (không ném lên tầng gọi)", () => {
    const fs = memFs();
    fs.append = () => {
      throw new Error("EACCES");
    };
    const onError = vi.fn();
    const sink = createFileSink({ dir: DIR, fs, onError });
    expect(() => sink.write("a\n")).not.toThrow();
    expect(() => sink.write("b\n")).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe("Error");
  });

  it("lỗi tạo thư mục ⇒ báo onError, sink không ghi", () => {
    const fs = memFs();
    fs.mkdir = () => {
      throw new Error("EROFS");
    };
    const onError = vi.fn();
    const sink = createFileSink({ dir: DIR, fs, onError });
    sink.write("a\n");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(fs.files.size).toBe(0);
  });
});

describe("resolveLogsDir", () => {
  it("bản đóng gói ⇒ thư mục log chuẩn của HĐH", () => {
    expect(
      resolveLogsDir({
        packaged: true,
        osLogsPath: "/Users/a/Library/Logs/SourceCraft",
        userDataPath: "/ud",
      }),
    ).toBe("/Users/a/Library/Logs/SourceCraft");
  });

  it("chưa đóng gói (dev/E2E) ⇒ <userData>/logs, không lẫn với log bản thật", () => {
    expect(
      resolveLogsDir({
        packaged: false,
        osLogsPath: "/os",
        userDataPath: "/ud",
      }),
    ).toBe(join("/ud", "logs"));
  });
});
