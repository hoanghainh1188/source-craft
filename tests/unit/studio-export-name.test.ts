import { describe, it, expect } from "vitest";
import { sanitizeName } from "../../src/main/services/studio/export-name";

describe("sanitizeName (studio export)", () => {
  it("bỏ ký tự cấm cho tên tệp", () => {
    expect(sanitizeName('Tóm tắt/tài liệu:*?"<>|x')).not.toMatch(
      /[/\\:*?"<>|]/,
    );
  });

  it("gộp khoảng trắng thừa + trim", () => {
    expect(sanitizeName("  Ý   chính  ")).toBe("Ý chính");
  });

  it("rỗng / chỉ ký tự cấm → mặc định 'studio'", () => {
    expect(sanitizeName("")).toBe("studio");
    expect(sanitizeName('/\\:*?"<>|')).toBe("studio");
  });

  it("cắt tên quá dài (≤ 80)", () => {
    const long = "a".repeat(200);
    expect(sanitizeName(long).length).toBeLessThanOrEqual(80);
  });

  it("giữ tên hợp lệ", () => {
    expect(sanitizeName("Tóm tắt tài liệu — 2026-07-11")).toBe(
      "Tóm tắt tài liệu — 2026-07-11",
    );
  });

  // 233 (T019): tên xuất gợi ý cho documentDiff
  it("xử lý tên xuất documentDiff theo ngôn ngữ vi và en", () => {
    expect(sanitizeName("So sánh văn bản — 2026-10-25")).toBe(
      "So sánh văn bản — 2026-10-25",
    );
    expect(sanitizeName("Compare documents — 2026-10-25")).toBe(
      "Compare documents — 2026-10-25",
    );
  });
});
