import { describe, expect, it } from "vitest";
import { parseAuditPolicy } from "../../../src/main/services/audit/audit-policy";
import { keyIdOf } from "../../../src/main/services/audit/record-chain";
import { deviceKeyPair, orgKeyPair } from "./helpers";

// T004 (236) — đọc phần audit của tệp chính sách HỆ THỐNG (R9, C1).

const org = orgKeyPair();
const base = {
  schemaVersion: 1,
  policyId: "pol-1",
  organization: "Ngân hàng X",
};
const text = (o: Record<string, unknown>) => JSON.stringify({ ...base, ...o });

describe("parseAuditPolicy", () => {
  it("không có tệp ⇒ notConfigured", () => {
    expect(parseAuditPolicy(null)).toEqual({ status: "notConfigured" });
  });

  it.each([
    ["JSON hỏng", "{not json"],
    ["sai schemaVersion", JSON.stringify({ ...base, schemaVersion: 2 })],
    ["thiếu policyId", JSON.stringify({ schemaVersion: 1, organization: "X" })],
    ["thiếu organization", JSON.stringify({ schemaVersion: 1, policyId: "p" })],
    ["mảng", "[]"],
  ])("%s ⇒ policyError(unreadableSystemPolicy)", (_n, raw) => {
    expect(parseAuditPolicy(raw)).toEqual({
      status: "policyError",
      reason: "unreadableSystemPolicy",
    });
  });

  it.each([
    ["thiếu", {}],
    ["false", { enableAuditLogging: false }],
  ])("enableAuditLogging %s ⇒ notConfigured", (_n, o) => {
    expect(parseAuditPolicy(text(o))).toEqual({ status: "notConfigured" });
  });

  it.each([
    ["thiếu khoá", { enableAuditLogging: true }],
    ["PEM hỏng", { enableAuditLogging: true, auditPublicKey: "not a pem" }],
    [
      "khoá Ed25519 thay vì X25519",
      {
        enableAuditLogging: true,
        auditPublicKey: deviceKeyPair().publicKeyPem,
      },
    ],
    [
      "khoá bí mật thay vì công khai",
      { enableAuditLogging: true, auditPublicKey: org.privateKeyPem },
    ],
  ])("%s ⇒ policyError(invalidAuditPublicKey)", (_n, o) => {
    expect(parseAuditPolicy(text(o))).toEqual({
      status: "policyError",
      reason: "invalidAuditPublicKey",
    });
  });

  it.each([
    ["tương đối", "audit/logs"],
    ["rỗng", "   "],
    ["không phải chuỗi", 42],
  ])(
    "auditLogDirectory %s ⇒ policyError(invalidAuditLogDirectory)",
    (_n, d) => {
      expect(
        parseAuditPolicy(
          text({
            enableAuditLogging: true,
            auditPublicKey: org.publicKeyPem,
            auditLogDirectory: d,
          }),
        ),
      ).toEqual({ status: "policyError", reason: "invalidAuditLogDirectory" });
    },
  );

  it("hợp lệ ⇒ configured, orgKeyId = 32 hex đầu SHA-256 SPKI, directory null khi thiếu", () => {
    const r = parseAuditPolicy(
      text({ enableAuditLogging: true, auditPublicKey: org.publicKeyPem }),
    );
    expect(r).toEqual({
      status: "configured",
      organization: "Ngân hàng X",
      policyId: "pol-1",
      orgPublicKeyPem: org.publicKeyPem,
      orgKeyId: keyIdOf(org.publicKeyPem),
      directory: null,
    });
    if (r.status === "configured") expect(r.orgKeyId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("giữ thư mục tuyệt đối (đã trim)", () => {
    const r = parseAuditPolicy(
      text({
        enableAuditLogging: true,
        auditPublicKey: org.publicKeyPem,
        auditLogDirectory: "  /Volumes/Audit/SourceCraft  ",
      }),
    );
    expect(r.status === "configured" && r.directory).toBe(
      "/Volumes/Audit/SourceCraft",
    );
  });

  it.each([["true"], [1], ["yes"]])(
    "enableAuditLogging sai kiểu %j ⇒ policyError (không âm thầm tắt — review S2)",
    (v) => {
      expect(parseAuditPolicy(text({ enableAuditLogging: v }))).toEqual({
        status: "policyError",
        reason: "unreadableSystemPolicy",
      });
    },
  );

  it("chỉ giữ khối khoá công khai đã chuẩn hoá (bỏ mọi khối PEM dán thừa phía sau — review S-info)", () => {
    const r = parseAuditPolicy(
      text({
        enableAuditLogging: true,
        auditPublicKey: org.publicKeyPem + org.privateKeyPem,
      }),
    );
    expect(r.status).toBe("configured");
    if (r.status === "configured") {
      expect(r.orgPublicKeyPem).not.toContain("PRIVATE KEY");
      expect(r.orgPublicKeyPem).toBe(org.publicKeyPem);
    }
  });
});
