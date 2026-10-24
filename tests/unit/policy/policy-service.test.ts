import { describe, expect, it } from "vitest";
import {
  createPolicyService,
  parseEnterprisePolicyJson,
} from "../../../src/main/services/policy/policy-service";
import type { EnterprisePolicy } from "@shared/ipc/types";

describe("parseEnterprisePolicyJson", () => {
  it("parses valid enterprise policy JSON", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      policyId: "POL-001",
      organization: "Tập đoàn ACME",
      forceLocalOnly: true,
      allowedLanHosts: ["*.acme.corp"],
      preconfiguredLanAi: {
        enabled: true,
        provider: "lan-ollama",
        baseUrl: "http://192.168.1.50:11434",
        chatModel: "qwen2.5:14b",
      },
    });

    const parsed = parseEnterprisePolicyJson(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.policy.organization).toBe("Tập đoàn ACME");
      expect(parsed.policy.forceLocalOnly).toBe(true);
      expect(parsed.policy.allowedLanHosts).toEqual(["*.acme.corp"]);
      expect(parsed.policy.preconfiguredLanAi?.provider).toBe("lan-ollama");
    }
  });

  it("rejects malformed or invalid schema JSON", () => {
    expect(parseEnterprisePolicyJson("not-json").ok).toBe(false);
    expect(parseEnterprisePolicyJson("{}").ok).toBe(false);
    expect(
      parseEnterprisePolicyJson(
        JSON.stringify({ schemaVersion: 2, organization: "Test" }),
      ).ok,
    ).toBe(false);
  });
});

describe("PolicyService", () => {
  it("returns null when no policy file exists in system or userData paths", () => {
    const service = createPolicyService({
      systemPath: "/non-existent/system/policy.json",
      userDataPath: "/non-existent/user/policy.json",
      fileExists: () => false,
      readFileText: () => "",
    });

    expect(service.getPolicy()).toBeNull();
    expect(service.isCloudDisabled()).toBe(false);
  });

  it("loads and enforces policy from system path first", () => {
    const systemPolicy: EnterprisePolicy = {
      schemaVersion: 1,
      policyId: "POL-SYS",
      organization: "System Admin Org",
      forceLocalOnly: true,
      allowedLanHosts: ["*.sys.corp"],
    };

    const service = createPolicyService({
      systemPath: "/etc/sourcecraft/enterprise-policy.json",
      userDataPath: "/userData/enterprise-policy.json",
      fileExists: (p) => p.startsWith("/etc/"),
      readFileText: () => JSON.stringify(systemPolicy),
    });

    const pol = service.getPolicy();
    expect(pol).not.toBeNull();
    expect(pol?.organization).toBe("System Admin Org");
    expect(service.isCloudDisabled()).toBe(true);
    expect(service.getAllowedLanHosts()).toEqual(["*.sys.corp"]);
  });

  it("falls back to userData path when system policy does not exist", () => {
    const userPolicy: EnterprisePolicy = {
      schemaVersion: 1,
      policyId: "POL-USER",
      organization: "User Dev Org",
      forceLocalOnly: false,
      allowedLanHosts: ["*.dev.local"],
    };

    const service = createPolicyService({
      systemPath: "/etc/sourcecraft/enterprise-policy.json",
      userDataPath: "/userData/enterprise-policy.json",
      fileExists: (p) => p.includes("userData"),
      readFileText: () => JSON.stringify(userPolicy),
    });

    const pol = service.getPolicy();
    expect(pol?.organization).toBe("User Dev Org");
    expect(service.isCloudDisabled()).toBe(false);
    expect(service.getAllowedLanHosts()).toEqual(["*.dev.local"]);
  });
});
