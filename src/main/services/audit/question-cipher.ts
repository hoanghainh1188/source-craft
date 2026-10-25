import {
  createCipheriv,
  createDecipheriv,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  createPrivateKey,
} from "node:crypto";
import { AUDIT_CIPHER_ALG, AUDIT_HKDF_INFO } from "./audit-constants";
import type { EncryptedText } from "./audit-types";

// 236 — mã hoá câu hỏi bằng khoá công khai X25519 của tổ chức (Q1, R4): khoá tạm mỗi bản ghi → X25519 → HKDF-SHA256 →
// AES-256-GCM, AAD gắn bản mã vào đúng bản ghi. Chỉ bên giữ khoá bí mật (IT) giải mã được. Không ghi bản rõ ra đâu.

/** AAD của bản ghi: "<seq>|<interactionId>" (contracts/audit-record.md). */
export function questionAad(seq: number, interactionId: string): string {
  return `${seq}|${interactionId}`;
}

function deriveKey(shared: Buffer, epkDer: Buffer): Buffer {
  return Buffer.from(hkdfSync("sha256", shared, epkDer, AUDIT_HKDF_INFO, 32));
}

export function encryptQuestion(
  text: string,
  orgPublicKeyPem: string,
  orgKeyId: string,
  aad: string,
): EncryptedText {
  const eph = generateKeyPairSync("x25519");
  const epkDer = eph.publicKey.export({ type: "spki", format: "der" });
  const shared = diffieHellman({
    privateKey: eph.privateKey,
    publicKey: createPublicKey(orgPublicKeyPem),
  });
  const key = deriveKey(shared, epkDer);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    alg: AUDIT_CIPHER_ALG,
    orgKeyId,
    epk: epkDer.toString("base64"),
    nonce: nonce.toString("base64"),
    ct: ct.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    len: [...text].length,
  };
}

/** Giải mã (chỉ ở công cụ IT). Sai khoá / sai AAD / bản mã bị sửa ⇒ ném. */
export function decryptQuestion(
  enc: EncryptedText,
  orgPrivateKeyPem: string,
  aad: string,
): string {
  if (enc.alg !== AUDIT_CIPHER_ALG)
    throw new Error("Unsupported audit cipher.");
  const epkDer = Buffer.from(enc.epk, "base64");
  const shared = diffieHellman({
    privateKey: createPrivateKey(orgPrivateKeyPem),
    publicKey: createPublicKey({ key: epkDer, format: "der", type: "spki" }),
  });
  const key = deriveKey(shared, epkDer);
  const tag = Buffer.from(enc.tag, "base64");
  // Cố định độ dài tag 16 byte: Node chấp nhận tag cắt ngắn nếu không đặt authTagLength (review S5).
  if (tag.length !== 16) throw new Error("Invalid audit cipher tag.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(enc.nonce, "base64"),
    { authTagLength: 16 },
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ct, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
