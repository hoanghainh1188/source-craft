import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseLicenseJson,
  verifyLicenseFile,
} from "../../../src/main/services/license/license-verifier";
// @ts-expect-error — importing .mjs vendor CLI directly for round-trip verification
import { runCli } from "../../../scripts/issue-license.mjs";

describe("scripts/issue-license.mjs vendor CLI", () => {
  it("generates an Ed25519 keypair and signs a .sclicense file that passes verifyLicenseFile", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sc-license-cli-"));
    try {
      const keysDir = join(tempDir, "keys");
      const keygenRes = runCli(["keygen", "--out-dir", keysDir]);
      expect(keygenRes.command).toBe("keygen");

      const publicKeyPem = readFileSync(keygenRes.pubPath, "utf8");
      const outLicensePath = join(tempDir, "acme-enterprise.sclicense");

      const signRes = runCli([
        "sign",
        "--private-key",
        keygenRes.privPath,
        "--org",
        "Công ty Cổ phần Công nghệ ACME",
        "--tier",
        "enterprise",
        "--seats",
        "75",
        "--days",
        "365",
        "--out",
        outLicensePath,
      ]);
      expect(signRes.command).toBe("sign");

      const rawText = readFileSync(outLicensePath, "utf8");
      const parsed = parseLicenseJson(rawText);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const verified = verifyLicenseFile(parsed.file, publicKeyPem);
        expect(verified.ok).toBe(true);
        if (verified.ok) {
          expect(verified.payload.orgName).toBe(
            "Công ty Cổ phần Công nghệ ACME",
          );
          expect(verified.payload.tier).toBe("enterprise");
          expect(verified.payload.seats).toBe(75);
          expect(verified.payload.features).toContain("lanAi");
          expect(verified.payload.features).toContain("sharedNotebooks");
          expect(verified.payload.features).toContain("itPolicy");
        }
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("supports perpetual Pro licenses (--days perpetual)", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "sc-license-cli-pro-"));
    try {
      const keysDir = join(tempDir, "keys");
      const keygenRes = runCli(["keygen", "--out-dir", keysDir]);
      const publicKeyPem = readFileSync(keygenRes.pubPath, "utf8");
      const outPath = join(tempDir, "pro-perpetual.sclicense");

      runCli([
        "sign",
        "--private-key",
        keygenRes.privPath,
        "--org",
        "Pro Individual User",
        "--tier",
        "pro",
        "--seats",
        "1",
        "--days",
        "perpetual",
        "--out",
        outPath,
      ]);

      const rawText = readFileSync(outPath, "utf8");
      const parsed = parseLicenseJson(rawText);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const verified = verifyLicenseFile(parsed.file, publicKeyPem);
        expect(verified.ok).toBe(true);
        if (verified.ok) {
          expect(verified.payload.tier).toBe("pro");
          expect(verified.payload.expiresAt).toBeNull();
        }
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
