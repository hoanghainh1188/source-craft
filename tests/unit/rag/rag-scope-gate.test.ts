import { describe, it, expect } from "vitest";
import { UserFacingError } from "@shared/codes/user-error";
import {
  createFeatureGate,
  entitlementsFor,
} from "../../../src/main/services/license/feature-gate";
import { assertRagScopeAllowed } from "../../../src/main/services/rag/scope-gate";

// 231 — chặn bản quyền cho rag:ask / rag:askStream (register.ts gọi đúng hàm này). Dùng FeatureGate THẬT.

const gateFor = (tier: "free" | "pro" | "enterprise") =>
  createFeatureGate(() => entitlementsFor(tier));

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof UserFacingError ? e.code : "khong-phai-UserFacingError";
  }
  return undefined;
}

describe("231 — assertRagScopeAllowed", () => {
  it("gói Free + scope 'all' → ném licenseRequireProCrossSearch", () => {
    expect(
      codeOf(() => assertRagScopeAllowed({ scope: "all" }, gateFor("free"))),
    ).toBe("licenseRequireProCrossSearch");
  });

  it.each(["pro", "enterprise"] as const)(
    "gói %s + scope 'all' → cho phép",
    (tier) => {
      expect(() =>
        assertRagScopeAllowed({ scope: "all" }, gateFor(tier)),
      ).not.toThrow();
    },
  );

  it.each([{ scope: "current" }, {}, null, undefined, "chuoi"])(
    "gói Free + input %j (không phải 'all') → cho phép",
    (input) => {
      expect(() => assertRagScopeAllowed(input, gateFor("free"))).not.toThrow();
    },
  );

  it("bản quyền đổi lúc chạy (kích hoạt Pro) → lần gọi sau được phép", () => {
    let tier: "free" | "pro" = "free";
    const gate = createFeatureGate(() => entitlementsFor(tier));
    expect(codeOf(() => assertRagScopeAllowed({ scope: "all" }, gate))).toBe(
      "licenseRequireProCrossSearch",
    );
    tier = "pro";
    expect(() => assertRagScopeAllowed({ scope: "all" }, gate)).not.toThrow();
  });

  it("không có licenseService (môi trường test/dev cũ) → giữ hành vi các cổng khác: cho phép", () => {
    expect(() =>
      assertRagScopeAllowed({ scope: "all" }, undefined),
    ).not.toThrow();
  });
});
