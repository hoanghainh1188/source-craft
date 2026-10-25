import { createHash, createPublicKey, sign, verify } from "node:crypto";
import { canonicalizeJson } from "../license/canonical-json";
import { AUDIT_RECORD_VERSION, GENESIS_PREV_HASH } from "./audit-constants";
import type { AuditRecord, AuditRecordBody, ChainHead } from "./audit-types";

// 236 — niêm phong bản ghi kiểm toán: chuỗi băm SHA-256 trên JSON chuẩn hoá + chữ ký Ed25519 của máy (R3).
// Thuần (chỉ node:crypto) ⇒ CLI kiểm tra dùng chung đúng thuật toán với app.

/** SHA-256 hex của JSON chuẩn hoá bản ghi bỏ `hash` và `sig`. Không phụ thuộc thứ tự khoá. */
export function hashRecord(record: object): string {
  const rest: Record<string, unknown> = {
    ...(record as Record<string, unknown>),
  };
  delete rest["hash"];
  delete rest["sig"];
  return createHash("sha256")
    .update(canonicalizeJson(rest), "utf8")
    .digest("hex");
}

/** Định danh khoá công khai: 32 hex đầu của SHA-256 trên SPKI DER. Dùng cho cả khoá máy lẫn khoá tổ chức. */
export function keyIdOf(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  });
  return createHash("sha256").update(der).digest("hex").slice(0, 32);
}

/** Niêm phong bản ghi kế tiếp sau `head` (null ⇒ bản ghi đầu tiên, seq 0). */
export function sealRecord(
  head: ChainHead | null,
  body: AuditRecordBody,
  tsMs: number,
  privateKeyPem: string,
): AuditRecord {
  const unsigned = {
    ...body,
    v: AUDIT_RECORD_VERSION,
    seq: head ? head.seq + 1 : 0,
    ts: new Date(tsMs).toISOString(),
    prevHash: head ? head.hash : GENESIS_PREV_HASH,
    ...(head && tsMs < head.tsMs ? { clockBackwards: true as const } : {}),
  };
  const hash = hashRecord(unsigned);
  const sig = sign(null, Buffer.from(hash, "utf8"), privateKeyPem).toString(
    "base64",
  );
  return { ...unsigned, hash, sig } as AuditRecord;
}

export type SealCheck =
  { ok: true } | { ok: false; kind: "badHash" | "badSignature" };

/** Kiểm một bản ghi đứng riêng: hash tính lại khớp và chữ ký hợp lệ với khoá công khai đang hiệu lực. */
export function verifySeal(
  record: AuditRecord,
  publicKeyPem: string,
): SealCheck {
  if (hashRecord(record) !== record.hash) return { ok: false, kind: "badHash" };
  try {
    const ok = verify(
      null,
      Buffer.from(record.hash, "utf8"),
      publicKeyPem,
      Buffer.from(record.sig, "base64"),
    );
    return ok ? { ok: true } : { ok: false, kind: "badSignature" };
  } catch {
    return { ok: false, kind: "badSignature" };
  }
}

/** Một dòng trên đĩa: JSON chuẩn hoá của bản ghi đã niêm phong + "\n". */
export function serializeRecord(record: AuditRecord): string {
  return `${canonicalizeJson(record)}\n`;
}
