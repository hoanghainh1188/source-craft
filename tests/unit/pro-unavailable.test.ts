import { describe, expect, it } from "vitest";
import { ProUnavailableError } from "../../src/main/services/pro-bridge/pro-unavailable";
import { UserFacingError } from "../../src/shared/codes/user-error";
import { parseIpcError } from "../../src/shared/online-error-tag";
import { createTranslator } from "../../src/shared/i18n";

// 248 — lỗi chung khi bản build không có chức năng Pro (stub src/main/pro/). Đi qua IPC như mọi lỗi người-dùng-thấy
// (mã proUnavailable, renderer tự dịch); `text` là câu đã dịch cho nơi không có renderer (CLI, nhật ký).

describe("ProUnavailableError", () => {
  it("là UserFacingError mã proUnavailable, IPC tách được mã", () => {
    const e = new ProUnavailableError("vi");
    expect(e).toBeInstanceOf(UserFacingError);
    expect(e.name).toBe("ProUnavailableError");
    expect(e.code).toBe("proUnavailable");
    expect(parseIpcError(e.message).code).toBe("proUnavailable");
  });

  it("text dịch theo ngôn ngữ được truyền vào", () => {
    const vi = new ProUnavailableError("vi").text;
    const en = new ProUnavailableError("en").text;
    expect(vi).toBe(createTranslator("vi").t("errors.proUnavailable"));
    expect(en).toBe(createTranslator("en").t("errors.proUnavailable"));
    expect(vi).not.toBe(en);
    expect(en).toMatch(/Pro/);
  });
});
