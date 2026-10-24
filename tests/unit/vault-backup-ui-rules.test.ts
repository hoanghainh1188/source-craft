import { describe, it, expect } from "vitest";
import { validatePassword } from "../../src/renderer/features/vault-backup/password-rules";
import {
  errorMessage,
  stepLabel,
  busyReasonLabel,
} from "../../src/renderer/features/vault-backup/messages";

describe("vault-backup password rules", () => {
  it("rỗng / < 8 ký tự / không khớp / hợp lệ", () => {
    expect(validatePassword("", "")).toEqual({ ok: false, reason: "tooShort" });
    expect(validatePassword("1234567", "1234567")).toEqual({
      ok: false,
      reason: "tooShort",
    });
    expect(validatePassword("12345678", "12345679")).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(validatePassword("12345678", "12345678")).toEqual({ ok: true });
    // đếm theo ký tự (tiếng Việt có dấu), không theo byte
    expect(validatePassword("mậtkhẩuu", "mậtkhẩuu")).toEqual({ ok: true });
  });
});

describe("vault-backup messages", () => {
  it("mỗi mã lỗi có câu tiếng Việt; sai mật khẩu & file hỏng dùng chung 1 câu", () => {
    expect(errorMessage("badPasswordOrCorrupt")).toBe(
      "Sai mật khẩu hoặc file sao lưu bị hỏng.",
    );
    expect(errorMessage("notBackup")).toBe(
      "Không phải file sao lưu SourceCraft.",
    );
    for (const c of [
      "busy",
      "passwordTooShort",
      "unsupportedFormat",
      "passwordRequired",
      "newerSchema",
      "diskFull",
      "tokenInvalid",
      "ioError",
    ] as const) {
      expect(errorMessage(c).length).toBeGreaterThan(5);
    }
    expect(errorMessage("newerSchema")).toContain("cập nhật");
  });

  it("nhãn bước + lý do bận", () => {
    expect(stepLabel("snapshot")).toBe("Đang chụp dữ liệu…");
    expect(stepLabel("pack")).toBe("Đang nén và ghi file…");
    expect(stepLabel("decrypt")).toBe("Đang giải mã và giải nén…");
    expect(stepLabel("verify")).toBe("Đang kiểm tra dữ liệu…");
    expect(stepLabel("preBackup")).toBe("Đang sao lưu vault hiện tại…");
    expect(busyReasonLabel("processing")).toBe("Đang xử lý nguồn…");
    expect(busyReasonLabel("reindexing")).toBe("Đang tái lập chỉ mục…");
    expect(busyReasonLabel("operation")).toBe("Đang sao lưu/khôi phục…");
    expect(busyReasonLabel(null)).toBe("");
  });
});
