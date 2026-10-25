import { generateKeyPairSync } from "node:crypto";
import { join } from "node:path";
import { keyIdOf } from "../record-chain";
import { AuditCliError } from "./cli-error";

// 236 (PR B) — sinh cặp khoá X25519 của tổ chức (R4). IT giữ khoá bí mật NGOÀI máy nhân viên; khoá công khai dán vào
// enterprise-policy.json (auditPublicKey). Từ chối ghi đè tệp đã có.

export interface OrgKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
  orgKeyId: string;
  /** Đoạn JSON dán vào policy: `"auditPublicKey": "-----BEGIN PUBLIC KEY-----\n…"`. */
  policySnippet: string;
}

export interface KeyFs {
  exists(path: string): boolean;
  mkdirp(dir: string): void;
  writeFile(path: string, data: string, mode?: number): void;
}

export const ORG_PRIVATE_FILE = "sourcecraft-audit-org-private.pem";
export const ORG_PUBLIC_FILE = "sourcecraft-audit-org-public.pem";

export function generateOrgKeyPair(): OrgKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("x25519");
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
    orgKeyId: keyIdOf(publicKeyPem),
    policySnippet: `"auditPublicKey": ${JSON.stringify(publicKeyPem)}`,
  };
}

export function writeOrgKeyFiles(
  fs: KeyFs,
  outDir: string,
  pair: OrgKeyPair,
): { privatePath: string; publicPath: string } {
  const privatePath = join(outDir, ORG_PRIVATE_FILE);
  const publicPath = join(outDir, ORG_PUBLIC_FILE);
  for (const p of [privatePath, publicPath]) {
    if (fs.exists(p)) throw new AuditCliError(2, "exists", p);
  }
  fs.mkdirp(outDir);
  fs.writeFile(publicPath, pair.publicKeyPem, 0o644);
  fs.writeFile(privatePath, pair.privateKeyPem, 0o600);
  return { privatePath, publicPath };
}
