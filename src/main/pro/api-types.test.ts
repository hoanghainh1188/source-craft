// 248 — Ghim chữ ký từng hàm của module Pro. Tệp này GIỐNG HỆT ở repo public (stub) và repo source-craft-pro
// (scripts/check-stub.mjs so khớp từng byte). Lệch chữ ký ⇒ `tsc` đỏ ở repo tương ứng; thêm/bớt hàm ⇒ sửa cả hai.
import { describe, expect, it } from "vitest";
import type { LanguageCode } from "@shared/i18n";
import type { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";
import * as pro from "./index";

// Kiểu ánh xạ buộc liệt kê ĐỦ mọi export (thiếu ⇒ lỗi thiếu khoá, thừa ⇒ lỗi khoá lạ); `satisfies` ghim chữ ký.
const PINNED: { readonly [K in keyof typeof pro]: unknown } = {
  available: pro.available satisfies () => boolean,
  unavailable: pro.unavailable satisfies (
    lang: LanguageCode,
  ) => ProUnavailableError,
};

describe("API module Pro", () => {
  it("export đúng các hàm đã ghim", () => {
    expect(Object.keys(pro).sort()).toEqual(Object.keys(PINNED).sort());
    for (const fn of Object.values(PINNED)) expect(typeof fn).toBe("function");
  });
});
