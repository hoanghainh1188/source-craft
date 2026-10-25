import { describe, expect, it } from "vitest";
import { parseAuditPolicy } from "../../../../src/main/services/audit/audit-policy";
import { AuditCliError } from "../../../../src/main/services/audit/cli/cli-error";
import {
  generateOrgKeyPair,
  writeOrgKeyFiles,
} from "../../../../src/main/services/audit/cli/keygen";
import {
  decryptQuestion,
  encryptQuestion,
  questionAad,
} from "../../../../src/main/services/audit/question-cipher";

// T058 (236) — sinh cặp khoá X25519 của tổ chức cho IT; khoá công khai dùng được ngay trong policy.

const memKeyFs = () => {
  const files = new Map<string, { data: string; mode?: number }>();
  return {
    files,
    exists: (p: string) => files.has(p),
    mkdirp: () => {},
    writeFile: (p: string, data: string, mode?: number) => {
      files.set(p, { data, ...(mode !== undefined ? { mode } : {}) });
    },
  };
};

describe("generateOrgKeyPair", () => {
  it("khoá công khai hợp lệ với parseAuditPolicy; orgKeyId khớp; đoạn policy thoát \\n đúng", () => {
    const k = generateOrgKeyPair();
    const snippet = JSON.parse(`{${k.policySnippet}}`) as {
      auditPublicKey: string;
    };
    expect(snippet.auditPublicKey).toBe(k.publicKeyPem);
    const policy = parseAuditPolicy(
      JSON.stringify({
        schemaVersion: 1,
        policyId: "p",
        organization: "o",
        enableAuditLogging: true,
        auditPublicKey: snippet.auditPublicKey,
      }),
    );
    expect(policy).toMatchObject({
      status: "configured",
      orgKeyId: k.orgKeyId,
    });
    const enc = encryptQuestion(
      "xin chào",
      k.publicKeyPem,
      k.orgKeyId,
      questionAad(1, "a"),
    );
    expect(decryptQuestion(enc, k.privateKeyPem, questionAad(1, "a"))).toBe(
      "xin chào",
    );
  });
});

describe("writeOrgKeyFiles", () => {
  it("ghi 2 tệp, khoá bí mật quyền 0600", () => {
    const fs = memKeyFs();
    const paths = writeOrgKeyFiles(fs, "/k", generateOrgKeyPair());
    expect(fs.files.get(paths.privatePath)?.mode).toBe(0o600);
    expect(fs.files.get(paths.publicPath)?.data).toContain("BEGIN PUBLIC KEY");
    expect(fs.files.get(paths.privatePath)?.data).toContain(
      "BEGIN PRIVATE KEY",
    );
  });

  it("tệp đã có ⇒ AuditCliError mã 2, không ghi đè", () => {
    const fs = memKeyFs();
    writeOrgKeyFiles(fs, "/k", generateOrgKeyPair());
    const before = new Map(fs.files);
    expect(() => writeOrgKeyFiles(fs, "/k", generateOrgKeyPair())).toThrow(
      AuditCliError,
    );
    expect(fs.files).toEqual(before);
  });
});
