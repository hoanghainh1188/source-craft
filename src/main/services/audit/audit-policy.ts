import { createPublicKey } from "node:crypto";
import { isAbsolute } from "node:path";
import { keyIdOf } from "./record-chain";
import type { AuditPolicyState } from "./audit-types";

// 236 — phần nhật ký kiểm toán của enterprise-policy.json, CHỈ từ tệp hệ thống (R9, C1). Thuần: nhận văn bản (null = không có tệp).
// Khoá mới tuỳ chọn, giữ schemaVersion 1; parseEnterprisePolicyJson (228) không đổi.

function isX25519PublicKey(pem: string): boolean {
  // createPublicKey nhận cả khoá BÍ MẬT (tự suy khoá công khai) ⇒ chặn tường minh: policy không được chứa khoá bí mật.
  if (!pem.includes("BEGIN PUBLIC KEY")) return false;
  try {
    const k = createPublicKey(pem);
    return k.type === "public" && k.asymmetricKeyType === "x25519";
  } catch {
    return false;
  }
}

export function parseAuditPolicy(rawText: string | null): AuditPolicyState {
  if (rawText === null) return { status: "notConfigured" };
  let obj: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { status: "policyError", reason: "unreadableSystemPolicy" };
    }
    obj = parsed as Record<string, unknown>;
  } catch {
    return { status: "policyError", reason: "unreadableSystemPolicy" };
  }
  const policyId =
    typeof obj["policyId"] === "string" ? obj["policyId"].trim() : "";
  const organization =
    typeof obj["organization"] === "string" ? obj["organization"].trim() : "";
  if (obj["schemaVersion"] !== 1 || !policyId || !organization) {
    return { status: "policyError", reason: "unreadableSystemPolicy" };
  }

  const enable = obj["enableAuditLogging"];
  if (enable === undefined || enable === false)
    return { status: "notConfigured" };
  // Sai kiểu ("true", 1…) KHÔNG được âm thầm tắt audit — tổ chức đã có ý bật (review S2).
  if (enable !== true) {
    return { status: "policyError", reason: "unreadableSystemPolicy" };
  }

  const pem = obj["auditPublicKey"];
  if (typeof pem !== "string" || !isX25519PublicKey(pem)) {
    return { status: "policyError", reason: "invalidAuditPublicKey" };
  }

  let directory: string | null = null;
  if (obj["auditLogDirectory"] !== undefined) {
    const d = obj["auditLogDirectory"];
    if (typeof d !== "string" || !d.trim() || !isAbsolute(d.trim())) {
      return { status: "policyError", reason: "invalidAuditLogDirectory" };
    }
    directory = d.trim();
  }

  // Chỉ giữ khoá công khai đã chuẩn hoá: bỏ mọi khối PEM dán thừa (vd lỡ dán cả khoá bí mật) — review.
  const orgPublicKeyPem = createPublicKey(pem).export({
    type: "spki",
    format: "pem",
  }) as string;
  return {
    status: "configured",
    organization,
    policyId,
    orgPublicKeyPem,
    orgKeyId: keyIdOf(orgPublicKeyPem),
    directory,
  };
}
