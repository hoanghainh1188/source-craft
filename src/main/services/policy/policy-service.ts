import { join } from "node:path";
import type { EnterprisePolicy, PreconfiguredLanAi } from "@shared/ipc/types";

// 228 — Enterprise IT Policy Service: reads read-only enterprise-policy.json from system or userData paths.
// Enforces IT governance (e.g. forceLocalOnly to disable public cloud APIs, preconfigured LAN AI).

export interface PolicyServiceDeps {
  systemPath?: string;
  userDataPath?: string;
  fileExists?: (path: string) => boolean;
  readFileText?: (path: string) => string;
  logEvent?: (event: string, meta?: Record<string, unknown>) => void;
}

export interface PolicyService {
  getPolicy(): EnterprisePolicy | null;
  isCloudDisabled(): boolean;
  getAllowedLanHosts(): string[];
  getPreconfiguredLanAi(): PreconfiguredLanAi | null;
}

export function getDefaultSystemPolicyPath(
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === "darwin") {
    return "/Library/Application Support/SourceCraft/enterprise-policy.json";
  }
  if (platform === "win32") {
    const programData = process.env["ProgramData"] || "C:\\ProgramData";
    return join(programData, "SourceCraft", "enterprise-policy.json");
  }
  return "/etc/sourcecraft/enterprise-policy.json";
}

export function parseEnterprisePolicyJson(
  rawText: string,
): { ok: true; policy: EnterprisePolicy } | { ok: false; error: string } {
  try {
    const obj = JSON.parse(rawText) as Record<string, unknown>;
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return { ok: false, error: "invalidJson" };
    }
    if (obj["schemaVersion"] !== 1) {
      return { ok: false, error: "invalidSchemaVersion" };
    }
    if (typeof obj["policyId"] !== "string" || !obj["policyId"].trim()) {
      return { ok: false, error: "missingPolicyId" };
    }
    if (
      typeof obj["organization"] !== "string" ||
      !obj["organization"].trim()
    ) {
      return { ok: false, error: "missingOrganization" };
    }

    const forceLocalOnly = Boolean(obj["forceLocalOnly"]);
    const allowedLanHosts = Array.isArray(obj["allowedLanHosts"])
      ? (obj["allowedLanHosts"] as unknown[]).filter(
          (h): h is string => typeof h === "string" && h.trim().length > 0,
        )
      : undefined;

    let preconfiguredLanAi: PreconfiguredLanAi | undefined;
    if (
      typeof obj["preconfiguredLanAi"] === "object" &&
      obj["preconfiguredLanAi"] !== null
    ) {
      const lanObj = obj["preconfiguredLanAi"] as Record<string, unknown>;
      const provider =
        lanObj["provider"] === "lan-openai" ? "lan-openai" : "lan-ollama";
      if (
        typeof lanObj["baseUrl"] === "string" &&
        lanObj["baseUrl"].trim().length > 0
      ) {
        preconfiguredLanAi = {
          enabled: Boolean(lanObj["enabled"]),
          provider,
          baseUrl: lanObj["baseUrl"].trim(),
          chatModel:
            typeof lanObj["chatModel"] === "string"
              ? lanObj["chatModel"].trim()
              : undefined,
        };
      }
    }

    const policy: EnterprisePolicy = {
      schemaVersion: 1,
      policyId: obj["policyId"].trim(),
      organization: obj["organization"].trim(),
      forceLocalOnly,
      ...(allowedLanHosts ? { allowedLanHosts } : {}),
      ...(preconfiguredLanAi ? { preconfiguredLanAi } : {}),
      ...(typeof obj["enforceBackupEncryption"] === "boolean"
        ? { enforceBackupEncryption: obj["enforceBackupEncryption"] }
        : {}),
    };

    return { ok: true, policy };
  } catch {
    return { ok: false, error: "malformedJson" };
  }
}

export function createPolicyService(deps: PolicyServiceDeps): PolicyService {
  const {
    systemPath = getDefaultSystemPolicyPath(),
    userDataPath,
    fileExists = () => false,
    readFileText = () => "",
    logEvent,
  } = deps;

  let cachedPolicy: EnterprisePolicy | null = null;
  let hasLoaded = false;

  const loadPolicy = (): EnterprisePolicy | null => {
    if (hasLoaded) return cachedPolicy;
    hasLoaded = true;

    const candidates = [systemPath, userDataPath].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );

    for (const p of candidates) {
      try {
        if (fileExists(p)) {
          const text = readFileText(p);
          const parsed = parseEnterprisePolicyJson(text);
          if (parsed.ok) {
            cachedPolicy = parsed.policy;
            logEvent?.("policy.loaded", {
              policyId: parsed.policy.policyId,
              forceLocalOnly: parsed.policy.forceLocalOnly,
            });
            return cachedPolicy;
          } else {
            logEvent?.("policy.loadFailed", { path: p, error: parsed.error });
          }
        }
      } catch {
        logEvent?.("policy.readError", { path: p });
      }
    }

    return null;
  };

  return {
    getPolicy: () => loadPolicy(),
    isCloudDisabled: () => {
      const p = loadPolicy();
      return p !== null && p.forceLocalOnly === true;
    },
    getAllowedLanHosts: () => {
      const p = loadPolicy();
      return p?.allowedLanHosts ?? [];
    },
    getPreconfiguredLanAi: () => {
      const p = loadPolicy();
      return p?.preconfiguredLanAi ?? null;
    },
  };
}
