// 248 — Ghim chữ ký từng hàm của module Pro. Tệp này GIỐNG HỆT ở repo public (stub) và repo source-craft-pro
// (scripts/check-stub.mjs so khớp từng byte). Lệch chữ ký ⇒ `tsc` đỏ ở repo tương ứng; thêm/bớt hàm ⇒ sửa cả hai.
// Chỉ ghim export giá trị (hàm); export kiểu (type/interface) không có trong `typeof pro`.
import { describe, expect, it } from "vitest";
import type { LanguageCode } from "@shared/i18n";
import type { DomainMode, StudioKind } from "@shared/ipc/types";
import type { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";
import * as pro from "./index";

// Bằng nhau HAI CHIỀU (bớt tham số, nới tham số, thu hẹp kiểu trả về đều lệch) — lệch ⇒ never ⇒ `satisfies` lỗi.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Exact<Actual, Pinned> =
  Equal<Actual, Pinned> extends true ? Pinned : never;

// Kiểu ánh xạ buộc liệt kê ĐỦ mọi export (thiếu ⇒ lỗi thiếu khoá, thừa ⇒ lỗi khoá lạ).
const PINNED: { readonly [K in keyof typeof pro]: unknown } = {
  available: pro.available satisfies Exact<typeof pro.available, () => boolean>,
  unavailable: pro.unavailable satisfies Exact<
    typeof pro.unavailable,
    (lang: LanguageCode) => ProUnavailableError
  >,
  studioTask: pro.studioTask satisfies Exact<
    typeof pro.studioTask,
    (kind: StudioKind, lang: LanguageCode) => string
  >,
  studioDiffMapPrompt: pro.studioDiffMapPrompt satisfies Exact<
    typeof pro.studioDiffMapPrompt,
    (lang: LanguageCode) => string
  >,
  studioDiffCondensePrompt: pro.studioDiffCondensePrompt satisfies Exact<
    typeof pro.studioDiffCondensePrompt,
    (lang: LanguageCode) => string
  >,
  pickDiffBatches: pro.pickDiffBatches satisfies Exact<
    typeof pro.pickDiffBatches,
    <T>(base: T[], revised: T[], max: number) => [T[], T[]]
  >,
  domainDirectives: pro.domainDirectives satisfies Exact<
    typeof pro.domainDirectives,
    (mode: DomainMode, lang?: LanguageCode) => string[]
  >,
};

describe("API module Pro", () => {
  it("export đúng các hàm đã ghim", () => {
    expect(Object.keys(pro).sort()).toEqual(Object.keys(PINNED).sort());
    for (const fn of Object.values(PINNED)) expect(typeof fn).toBe("function");
  });
});
