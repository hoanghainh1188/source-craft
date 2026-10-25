import { describe, expect, it } from "vitest";
import {
  AUDIT_KEYTAR_ACCOUNT,
  AUDIT_KEYTAR_SERVICE,
} from "../../../src/main/services/audit/audit-constants";
import { loadOrCreateDeviceKey } from "../../../src/main/services/audit/device-key";
import { keyIdOf } from "../../../src/main/services/audit/record-chain";
import { memoryKeystore } from "./helpers";

// T008 (236) — khoá ký của máy trong keychain; phát hiện mất / đổi khoá (Q2, R5, R19).

const slot = `${AUDIT_KEYTAR_SERVICE}/${AUDIT_KEYTAR_ACCOUNT}`;

describe("loadOrCreateDeviceKey", () => {
  it("keystore rỗng + chưa có chuỗi ⇒ sinh khoá, lưu PKCS8 PEM, không rotation", async () => {
    const ks = memoryKeystore();
    const r = await loadOrCreateDeviceKey(ks, null);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rotation).toBeNull();
    expect(ks.store.get(slot)).toContain("BEGIN PRIVATE KEY");
    expect(r.key.deviceKeyId).toBe(keyIdOf(r.key.publicKeyPem));
    expect(r.key.deviceKeyId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("đã có khoá khớp chuỗi ⇒ dùng lại, không rotation", async () => {
    const ks = memoryKeystore();
    const first = await loadOrCreateDeviceKey(ks, null);
    if (!first.ok) throw new Error("setup");
    const again = await loadOrCreateDeviceKey(ks, first.key.deviceKeyId);
    expect(again.ok && again.key.deviceKeyId).toBe(first.key.deviceKeyId);
    expect(again.ok && again.rotation).toBeNull();
  });

  it("keystore rỗng nhưng chuỗi đã có ⇒ khoá mới + rotation keyMissing", async () => {
    const ks = memoryKeystore();
    const r = await loadOrCreateDeviceKey(ks, "f".repeat(32));
    expect(r.ok && r.rotation).toEqual({
      reason: "keyMissing",
      previousDeviceKeyId: "f".repeat(32),
    });
  });

  it("có khoá nhưng khác deviceKeyId của chuỗi ⇒ rotation keyMismatch (giữ khoá đang có)", async () => {
    const ks = memoryKeystore();
    const first = await loadOrCreateDeviceKey(ks, null);
    if (!first.ok) throw new Error("setup");
    const r = await loadOrCreateDeviceKey(ks, "e".repeat(32));
    expect(r.ok && r.key.deviceKeyId).toBe(first.key.deviceKeyId);
    expect(r.ok && r.rotation).toEqual({
      reason: "keyMismatch",
      previousDeviceKeyId: "e".repeat(32),
    });
  });

  it("khoá trong keystore hỏng ⇒ coi như mất: sinh mới", async () => {
    const ks = memoryKeystore();
    ks.store.set(slot, "garbage");
    const r = await loadOrCreateDeviceKey(ks, null);
    expect(r.ok).toBe(true);
    expect(ks.store.get(slot)).toContain("BEGIN PRIVATE KEY");
  });

  it("keychain ném ⇒ { ok:false, reason:keyUnavailable } (không ném xuyên)", async () => {
    const ks = memoryKeystore();
    ks.failing = true;
    await expect(loadOrCreateDeviceKey(ks, null)).resolves.toEqual({
      ok: false,
      reason: "keyUnavailable",
    });
  });
});

describe("loadOrCreateDeviceKey — kho nuốt lệnh ghi", () => {
  it("setPassword không lưu (no-op) ⇒ keyUnavailable thay vì âm thầm dùng khoá tạm", async () => {
    const noop = {
      getPassword: async () => null,
      setPassword: async () => {},
      deletePassword: async () => false,
    };
    await expect(loadOrCreateDeviceKey(noop, null)).resolves.toEqual({
      ok: false,
      reason: "keyUnavailable",
    });
  });
});
