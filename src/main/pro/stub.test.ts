// SPDX-License-Identifier: MIT
// 248 — hành vi riêng của STUB. Tệp này chỉ có ở repo public: lúc build release, cả thư mục src/main/pro/ bị thay
// bằng bản ở repo source-craft-pro nên test này biến mất cùng stub.
import { describe, expect, it } from "vitest";
import { ProUnavailableError } from "../services/pro-bridge/pro-unavailable";
import {
  available,
  domainDirectives,
  pickDiffBatches,
  studioDiffCondensePrompt,
  studioDiffMapPrompt,
  studioTask,
  unavailable,
} from "./index";

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

describe("stub src/main/pro — đợt 2 (prompt Studio Pro, chế độ chuyên gia)", () => {
  it("mọi hàm Pro ném ProUnavailableError", () => {
    const calls: (() => unknown)[] = [
      () => studioTask("faq", "en"),
      () => studioDiffMapPrompt("en"),
      () => studioDiffCondensePrompt("en"),
      () => pickDiffBatches([1], [2], 2),
      () => domainDirectives("legal", "en"),
    ];
    for (const call of calls) expect(call).toThrow(ProUnavailableError);
  });
});
