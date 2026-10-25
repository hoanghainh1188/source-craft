import { describe, it, expect } from "vitest";
import { UserFacingError } from "@shared/codes/user-error";
import {
  createFeatureGate,
  entitlementsFor,
} from "../../../src/main/services/license/feature-gate";
import { assertDomainModeAllowed } from "../../../src/main/services/rag/scope-gate";

// 238 — Chặn bản quyền cho chế độ AI Chuyên gia (Pháp lý / Y tế) ở rag:ask, rag:askStream, studio:generate.

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

describe("238 — assertDomainModeAllowed", () => {
  it.each(["legal", "medical"] as const)(
    "gói Free + domainMode '%s' → ném licenseRequireProSpecialistModes",
    (domainMode) => {
      expect(
        codeOf(() => assertDomainModeAllowed({ domainMode }, gateFor("free"))),
      ).toBe("licenseRequireProSpecialistModes");
    },
  );

  it.each(["pro", "enterprise"] as const)(
    "gói %s + domainMode 'legal' hoặc 'medical' → cho phép",
    (tier) => {
      expect(() =>
        assertDomainModeAllowed({ domainMode: "legal" }, gateFor(tier)),
      ).not.toThrow();
      expect(() =>
        assertDomainModeAllowed({ domainMode: "medical" }, gateFor(tier)),
      ).not.toThrow();
    },
  );

  it.each([{ domainMode: "general" }, {}, null, undefined, "chuoi"])(
    "gói Free + input %j (chế độ chung/không chuyên gia) → cho phép",
    (input) => {
      expect(() =>
        assertDomainModeAllowed(input, gateFor("free")),
      ).not.toThrow();
    },
  );

  it("bản quyền nâng cấp (kích hoạt Pro) → lần gọi sau được phép", () => {
    let tier: "free" | "pro" = "free";
    const gate = createFeatureGate(() => entitlementsFor(tier));
    expect(
      codeOf(() => assertDomainModeAllowed({ domainMode: "legal" }, gate)),
    ).toBe("licenseRequireProSpecialistModes");

    tier = "pro";
    expect(() =>
      assertDomainModeAllowed({ domainMode: "legal" }, gate),
    ).not.toThrow();
  });

  it("không có licenseService (môi trường dev/test cũ) → cho phép", () => {
    expect(() =>
      assertDomainModeAllowed({ domainMode: "legal" }, undefined),
    ).not.toThrow();
  });
});
