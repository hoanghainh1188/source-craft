import { describe, expect, it } from "vitest";
import {
  blocksAi,
  computeAuditState,
} from "../../../src/main/services/audit/effective-state";
import type { AuditPolicyState } from "../../../src/main/services/audit/audit-types";

// T009 (236) — bảng trạng thái hiệu lực (data-model §2, R10).

const configured: AuditPolicyState = {
  status: "configured",
  organization: "X",
  policyId: "p",
  orgPublicKeyPem: "pem",
  orgKeyId: "k",
  directory: null,
};
const okLicense = { valid: true, itPolicy: true };
const healthy = { healthy: true } as const;

describe("computeAuditState", () => {
  it("notConfigured ⇒ off (bất kể bản quyền / writer)", () => {
    expect(
      computeAuditState({
        policy: { status: "notConfigured" },
        license: okLicense,
        writer: { healthy: false, reason: "writeFailed" },
      }),
    ).toEqual({ state: "off" });
  });

  it("policyError + bản quyền đủ ⇒ policyError + lý do", () => {
    expect(
      computeAuditState({
        policy: { status: "policyError", reason: "invalidAuditPublicKey" },
        license: { valid: true, itPolicy: true },
        writer: healthy,
      }),
    ).toEqual({ state: "policyError", reason: "invalidAuditPublicKey" });
  });

  it("policyError + bản quyền KHÔNG đủ ⇒ licenseInactive (chính sách không có hiệu lực, không chặn AI)", () => {
    expect(
      computeAuditState({
        policy: { status: "policyError", reason: "invalidAuditPublicKey" },
        license: { valid: false, itPolicy: false },
        writer: healthy,
      }),
    ).toEqual({ state: "licenseInactive" });
  });

  it.each([
    [{ valid: false, itPolicy: true }],
    [{ valid: true, itPolicy: false }],
  ])("configured + bản quyền không đủ %j ⇒ licenseInactive", (license) => {
    expect(
      computeAuditState({ policy: configured, license, writer: healthy }),
    ).toEqual({ state: "licenseInactive" });
  });

  it("configured + bản quyền đủ + writer OK ⇒ active", () => {
    expect(
      computeAuditState({
        policy: configured,
        license: okLicense,
        writer: healthy,
      }),
    ).toEqual({ state: "active" });
  });

  it.each(["writeFailed", "keyUnavailable"] as const)(
    "writer lỗi %s ⇒ blocked + reason",
    (reason) => {
      expect(
        computeAuditState({
          policy: configured,
          license: okLicense,
          writer: { healthy: false, reason },
        }),
      ).toEqual({ state: "blocked", reason });
    },
  );
});

describe("blocksAi", () => {
  it("chỉ policyError và blocked chặn AI", () => {
    expect(blocksAi("policyError")).toBe(true);
    expect(blocksAi("blocked")).toBe(true);
    expect(blocksAi("active")).toBe(false);
    expect(blocksAi("off")).toBe(false);
    expect(blocksAi("licenseInactive")).toBe(false);
  });
});
