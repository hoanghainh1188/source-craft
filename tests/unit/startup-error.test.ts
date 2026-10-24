import { describe, it, expect } from "vitest";
import { startupErrorDialog } from "../../src/main/services/app-shell/startup-error";
import { SchemaVersionError } from "../../src/main/db/migrations";
import { trEn } from "./helpers/t-vi";

describe("startupErrorDialog", () => {
  it("SchemaVersionError → thông báo cập nhật, kèm số schema, không xoá dữ liệu", () => {
    const r = startupErrorDialog(new SchemaVersionError(7, 4));
    expect(r.title).toBe("Cần cập nhật SourceCraft");
    expect(r.detail).toContain("v7");
    expect(r.detail).toContain("v4");
    expect(r.detail).toMatch(/an toàn/i);
    expect(r.detail).not.toMatch(/xo[áa] d[ữu] li[ệe]u/i);
    expect(r.errorType).toBe("SchemaVersionError");
  });

  it("lỗi thường → thông báo chung + errorType, KHÔNG rò message thô (path/nội dung)", () => {
    const leaky = new Error(
      "open /Users/secret/insightvault.db failed: 'nội dung nhạy cảm'",
    );
    const r = startupErrorDialog(leaky);
    expect(r.title).toBe("SourceCraft gặp lỗi khi khởi động");
    expect(r.errorType).toBe("Error");
    // Không được lộ đường dẫn hay nội dung message gốc.
    expect(r.detail).not.toContain("/Users/secret");
    expect(r.detail).not.toContain("nội dung nhạy cảm");
    expect(r.detail).toContain("Error");
  });

  it("lỗi không phải Error (throw string/undefined) → dùng typeof, không crash", () => {
    expect(startupErrorDialog("boom").errorType).toBe("string");
    expect(startupErrorDialog(undefined).errorType).toBe("undefined");
    expect(startupErrorDialog(undefined).title).toBe(
      "SourceCraft gặp lỗi khi khởi động",
    );
  });

  it("lớp con của Error giữ đúng errorType theo constructor", () => {
    class DbLocked extends Error {
      constructor() {
        super("locked");
        this.name = "DbLocked";
      }
    }
    expect(startupErrorDialog(new DbLocked()).errorType).toBe("DbLocked");
  });
});

describe("123: startupErrorDialog theo ngôn ngữ", () => {
  it("English khi translator English; vẫn không rò message thô", () => {
    const r = startupErrorDialog(new SchemaVersionError(12, 10), trEn);
    expect(r.title).toBe("Please update SourceCraft");
    expect(r.detail).toContain("schema v12");
    expect(r.detail).toContain("v10");
    const g = startupErrorDialog(new Error("/Users/secret x"), trEn);
    expect(g.title).toBe("SourceCraft failed to start");
    expect(g.detail).toContain("error type: Error");
    expect(g.detail).not.toContain("/Users/secret");
  });
});
