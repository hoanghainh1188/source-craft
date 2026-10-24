import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEnterprisePolicyJson } from "../../../src/main/services/policy/policy-service";

describe("Enterprise Policy Example Template Validation", () => {
  it("successfully parses deployment/enterprise-policy.json.example with schema version 1", () => {
    const examplePath = resolve(
      process.cwd(),
      "deployment",
      "enterprise-policy.json.example",
    );
    const rawContent = readFileSync(examplePath, "utf-8");

    const result = parseEnterprisePolicyJson(rawContent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.policy.schemaVersion).toBe(1);
      expect(result.policy.policyId).toBe("POL-2026-CORP-001");
      expect(result.policy.organization).toContain(
        "Tập đoàn Công nghệ Mẫu (Example Corp)",
      );
      expect(result.policy.forceLocalOnly).toBe(true);
      expect(result.policy.enforceBackupEncryption).toBe(true);
      expect(result.policy.allowedLanHosts).toContain("10.0.0.0/8");
      expect(result.policy.preconfiguredLanAi).toBeDefined();
      expect(result.policy.preconfiguredLanAi?.provider).toBe("lan-openai");
      expect(result.policy.preconfiguredLanAi?.baseUrl).toBe(
        "http://192.168.1.50:8000",
      );
      expect(result.policy.preconfiguredLanAi?.chatModel).toBe(
        "Qwen/Qwen2.5-14B-Instruct",
      );
    }
  });
});
