import { createHash, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalizeJson } from "../../../src/main/services/license/canonical-json";
import { GENESIS_PREV_HASH } from "../../../src/main/services/audit/audit-constants";
import {
  hashRecord,
  keyIdOf,
  sealRecord,
  serializeRecord,
  verifySeal,
} from "../../../src/main/services/audit/record-chain";
import type { AuditRecordBody } from "../../../src/main/services/audit/audit-types";
import { deviceKeyPair } from "./helpers";

// T006 (236) — chuỗi băm + chữ ký Ed25519 (R3, contracts/audit-record.md).

const key = deviceKeyPair();
const other = deviceKeyPair();
const body: AuditRecordBody = { type: "audit.stopped", reason: "appQuit" };
const T0 = Date.UTC(2026, 9, 25, 2, 0, 0);

describe("sealRecord", () => {
  it("bản ghi đầu: seq 0, prevHash genesis, v 1, ts ISO", () => {
    const r = sealRecord(null, body, T0, key.privateKeyPem);
    expect(r.seq).toBe(0);
    expect(r.prevHash).toBe(GENESIS_PREV_HASH);
    expect(r.v).toBe(1);
    expect(r.ts).toBe("2026-10-25T02:00:00.000Z");
    expect(r.clockBackwards).toBeUndefined();
  });

  it("nối chuỗi: seq + 1, prevHash = hash trước", () => {
    const a = sealRecord(null, body, T0, key.privateKeyPem);
    const b = sealRecord(
      { seq: a.seq, hash: a.hash, tsMs: T0 },
      body,
      T0 + 5,
      key.privateKeyPem,
    );
    expect(b.seq).toBe(1);
    expect(b.prevHash).toBe(a.hash);
  });

  it("hash = SHA-256 hex của JSON chuẩn hoá bỏ hash/sig; không phụ thuộc thứ tự khoá", () => {
    const r = sealRecord(null, body, T0, key.privateKeyPem);
    const rest: Record<string, unknown> = { ...r };
    delete rest["hash"];
    delete rest["sig"];
    const expected = createHash("sha256")
      .update(canonicalizeJson(rest), "utf8")
      .digest("hex");
    expect(r.hash).toBe(expected);
    const reordered = Object.fromEntries(Object.entries(r).reverse());
    expect(hashRecord(reordered)).toBe(r.hash);
  });

  it("sig = Ed25519 trên byte UTF-8 của hash", () => {
    const r = sealRecord(null, body, T0, key.privateKeyPem);
    expect(
      verify(
        null,
        Buffer.from(r.hash, "utf8"),
        key.publicKeyPem,
        Buffer.from(r.sig, "base64"),
      ),
    ).toBe(true);
  });

  it("đồng hồ lùi ⇒ clockBackwards: true", () => {
    const r = sealRecord(
      { seq: 3, hash: "a".repeat(64), tsMs: T0 },
      body,
      T0 - 1000,
      key.privateKeyPem,
    );
    expect(r.clockBackwards).toBe(true);
  });
});

describe("verifySeal", () => {
  const r = sealRecord(null, body, T0, key.privateKeyPem);

  it("nguyên vẹn ⇒ ok", () => {
    expect(verifySeal(r, key.publicKeyPem)).toEqual({ ok: true });
  });
  it("sửa một trường ⇒ badHash", () => {
    expect(
      verifySeal(
        { ...r, reason: "licenseInactive" } as typeof r,
        key.publicKeyPem,
      ),
    ).toEqual({
      ok: false,
      kind: "badHash",
    });
  });
  it("chữ ký khác / khoá khác ⇒ badSignature", () => {
    const forged = sealRecord(null, body, T0, other.privateKeyPem);
    expect(verifySeal(forged, key.publicKeyPem)).toEqual({
      ok: false,
      kind: "badSignature",
    });
    expect(verifySeal({ ...r, sig: "AAAA" }, key.publicKeyPem)).toEqual({
      ok: false,
      kind: "badSignature",
    });
  });
});

describe("serializeRecord / keyIdOf", () => {
  it("một dòng JSON chuẩn hoá kết thúc \\n, parse lại bằng nhau", () => {
    const r = sealRecord(null, body, T0, key.privateKeyPem);
    const line = serializeRecord(r);
    expect(line.endsWith("\n")).toBe(true);
    expect(line.slice(0, -1)).not.toContain("\n");
    expect(JSON.parse(line)).toEqual(r);
  });
  it("keyIdOf = 32 hex, ổn định, khác nhau giữa các khoá", () => {
    expect(keyIdOf(key.publicKeyPem)).toMatch(/^[0-9a-f]{32}$/);
    expect(keyIdOf(key.publicKeyPem)).toBe(keyIdOf(key.publicKeyPem));
    expect(keyIdOf(key.publicKeyPem)).not.toBe(keyIdOf(other.publicKeyPem));
  });
});
