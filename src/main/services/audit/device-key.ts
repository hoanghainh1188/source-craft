import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import type { KeytarLike } from "../ai-runtime/online/secret-store";
import { AUDIT_KEYTAR_ACCOUNT, AUDIT_KEYTAR_SERVICE } from "./audit-constants";
import type { DeviceKey } from "./audit-types";
import { keyIdOf } from "./record-chain";

// 236 — khoá ký Ed25519 của máy trong keychain (Q2, R5). Mất / khác khoá đầu chuỗi ⇒ báo rotation để ghi audit.keyRotated (R19).
// KHÔNG log khoá.

export type DeviceKeyRotation = {
  reason: "keyMissing" | "keyMismatch";
  previousDeviceKeyId: string;
};

export type DeviceKeyResult =
  | { ok: true; key: DeviceKey; rotation: DeviceKeyRotation | null }
  | { ok: false; reason: "keyUnavailable" };

/** Dựng DeviceKey từ khoá bí mật PKCS8 PEM; không phải Ed25519 ⇒ null. */
export function deviceKeyFromPrivatePem(
  privateKeyPem: string,
): DeviceKey | null {
  try {
    const priv = createPrivateKey(privateKeyPem);
    if (priv.asymmetricKeyType !== "ed25519") return null;
    const publicKeyPem = createPublicKey(priv).export({
      type: "spki",
      format: "pem",
    }) as string;
    return { privateKeyPem, publicKeyPem, deviceKeyId: keyIdOf(publicKeyPem) };
  } catch {
    return null;
  }
}

function generate(): DeviceKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({
    type: "spki",
    format: "pem",
  }) as string;
  return {
    privateKeyPem: privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string,
    publicKeyPem,
    deviceKeyId: keyIdOf(publicKeyPem),
  };
}

/**
 * Đọc khoá máy; không có (hoặc hỏng) ⇒ sinh + lưu. `lastKnownDeviceKeyId` = khoá đang hiệu lực ở đuôi nhật ký (null nếu chưa có chuỗi).
 * Keychain ném ⇒ { ok:false } (không ném xuyên — service chuyển blocked/keyUnavailable).
 */
export async function loadOrCreateDeviceKey(
  keyStore: KeytarLike,
  lastKnownDeviceKeyId: string | null,
): Promise<DeviceKeyResult> {
  try {
    const stored = await keyStore.getPassword(
      AUDIT_KEYTAR_SERVICE,
      AUDIT_KEYTAR_ACCOUNT,
    );
    const existing = stored ? deviceKeyFromPrivatePem(stored) : null;
    if (existing) {
      const mismatch =
        lastKnownDeviceKeyId !== null &&
        lastKnownDeviceKeyId !== existing.deviceKeyId;
      return {
        ok: true,
        key: existing,
        rotation: mismatch
          ? { reason: "keyMismatch", previousDeviceKeyId: lastKnownDeviceKeyId }
          : null,
      };
    }
    const key = generate();
    await keyStore.setPassword(
      AUDIT_KEYTAR_SERVICE,
      AUDIT_KEYTAR_ACCOUNT,
      key.privateKeyPem,
    );
    // Đọc lại: kho "nuốt" lệnh ghi (no-op) ⇒ khoá sẽ khác ở lần mở sau mà không ai biết ⇒ coi như không khả dụng.
    const readBack = await keyStore.getPassword(
      AUDIT_KEYTAR_SERVICE,
      AUDIT_KEYTAR_ACCOUNT,
    );
    if (readBack !== key.privateKeyPem)
      return { ok: false, reason: "keyUnavailable" };
    return {
      ok: true,
      key,
      rotation:
        lastKnownDeviceKeyId !== null
          ? { reason: "keyMissing", previousDeviceKeyId: lastKnownDeviceKeyId }
          : null,
    };
  } catch {
    return { ok: false, reason: "keyUnavailable" };
  }
}
