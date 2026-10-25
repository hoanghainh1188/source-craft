import { describe, expect, it } from "vitest";
import {
  decryptQuestion,
  encryptQuestion,
  questionAad,
} from "../../../src/main/services/audit/question-cipher";
import { keyIdOf } from "../../../src/main/services/audit/record-chain";
import { orgKeyPair } from "./helpers";

// T007 (236) — mã hoá lai X25519 + HKDF-SHA256 + AES-256-GCM bằng khoá công khai của tổ chức (Q1, R4).

const org = orgKeyPair();
const org2 = orgKeyPair();
const orgKeyId = keyIdOf(org.publicKeyPem);
const aad = questionAad(7, "int-1");
const Q = "Điều 5 khoản 2 của hợp đồng cung ứng nói gì? 📄";

describe("question-cipher", () => {
  it("khứ hồi đúng với tiếng Việt có dấu + emoji; len = số code point", () => {
    const enc = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    expect(enc.alg).toBe("x25519-hkdf-sha256-aes256gcm");
    expect(enc.orgKeyId).toBe(orgKeyId);
    expect(enc.len).toBe([...Q].length);
    expect(decryptQuestion(enc, org.privateKeyPem, aad)).toBe(Q);
  });

  it("bản mã không chứa bản rõ; mỗi lần ra epk/nonce/ct khác nhau", () => {
    const a = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    const b = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    expect(JSON.stringify(a)).not.toContain("hợp đồng");
    expect(a.epk).not.toBe(b.epk);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ct).not.toBe(b.ct);
  });

  it("AAD khác (seq hoặc interactionId khác) ⇒ ném", () => {
    const enc = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    expect(() =>
      decryptQuestion(enc, org.privateKeyPem, questionAad(8, "int-1")),
    ).toThrow();
    expect(() =>
      decryptQuestion(enc, org.privateKeyPem, questionAad(7, "int-2")),
    ).toThrow();
  });

  it("sửa ct hoặc tag ⇒ ném", () => {
    const enc = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    const flip = (b64: string) => {
      const b = Buffer.from(b64, "base64");
      b[0] = (b[0] ?? 0) ^ 0xff;
      return b.toString("base64");
    };
    expect(() =>
      decryptQuestion({ ...enc, ct: flip(enc.ct) }, org.privateKeyPem, aad),
    ).toThrow();
    expect(() =>
      decryptQuestion({ ...enc, tag: flip(enc.tag) }, org.privateKeyPem, aad),
    ).toThrow();
  });

  it("khoá tổ chức khác ⇒ ném; orgKeyId cho phép phát hiện trước khi giải mã", () => {
    const enc = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    expect(enc.orgKeyId).not.toBe(keyIdOf(org2.publicKeyPem));
    expect(() => decryptQuestion(enc, org2.privateKeyPem, aad)).toThrow();
  });

  it("questionAad = '<seq>|<interactionId>'", () => {
    expect(questionAad(12, "abc")).toBe("12|abc");
  });

  it("tag GCM bị cắt ngắn ⇒ ném (cố định authTagLength 16 — review S5)", () => {
    const enc = encryptQuestion(Q, org.publicKeyPem, orgKeyId, aad);
    const short = Buffer.from(enc.tag, "base64")
      .subarray(0, 4)
      .toString("base64");
    expect(() =>
      decryptQuestion({ ...enc, tag: short }, org.privateKeyPem, aad),
    ).toThrow();
  });
});
