// SPDX-License-Identifier: MIT
// 248 — hành vi riêng của STUB. Tệp này chỉ có ở repo public: lúc build release, cả thư mục src/main/pro/ bị thay
// bằng bản ở repo source-craft-pro nên test này biến mất cùng stub.
import { describe, expect, it } from "vitest";
import { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";
import { available, unavailable } from "./index";

describe("stub src/main/pro", () => {
  it("available() = false", () => {
    expect(available()).toBe(false);
  });

  it("unavailable(lang) trả ProUnavailableError theo ngôn ngữ", () => {
    const e = unavailable("en");
    expect(e).toBeInstanceOf(ProUnavailableError);
    expect(e.text).toBe(new ProUnavailableError("en").text);
  });
});
