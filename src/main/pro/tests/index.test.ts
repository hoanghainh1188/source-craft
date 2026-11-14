// SPDX-License-Identifier: MIT
// 248/261 — test module chức năng nâng cao (gộp từ repo source-craft-pro ở #261).
import { describe, expect, it } from "vitest";
import { ProUnavailableError } from "../../services/pro-bridge/pro-unavailable";
import { available, unavailable } from "../index";

describe("module Pro", () => {
  it("available() = true", () => {
    expect(available()).toBe(true);
  });

  it("unavailable(lang) trả ProUnavailableError theo ngôn ngữ", () => {
    const e = unavailable("vi");
    expect(e).toBeInstanceOf(ProUnavailableError);
    expect(e.code).toBe("proUnavailable");
  });
});
