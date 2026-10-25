import { sign, verify } from "node:crypto";
import type {
  LicenseFeature,
  LicenseFile,
  LicensePayload,
} from "@shared/ipc/types";
import { canonicalizePayload } from "./canonical-json";

// 226 — Offline Ed25519 signature & schema verification for .sclicense files (Constitution Principle I & III).
// Zero network egress. Never log orgName, licenseId, or sig.

/**
 * Embedded default vendor Ed25519 SPKI public key (PEM).
 * Can be overridden in tests or dev environments via dependency injection.
 */
export const DEFAULT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA8dJ4X7qK0wG1vM9nL2pR5sT8uV3wX6yZ9aB2cD4eF7g=
-----END PUBLIC KEY-----`;

const VALID_FEATURES: ReadonlySet<LicenseFeature> = new Set<LicenseFeature>([
  "multimedia",
  "studioPro",
  "meetingLong",
  "lanAi",
  "sharedNotebooks",
  "itPolicy",
  "crossNotebookSearch",
  "brandedExport",
  "specialistAiModes",
]);

const MAX_ORG_NAME_LEN = 120;

export type VerifyLicenseResult =
  | { ok: true; payload: LicensePayload }
  | { ok: false; code: "invalidFormat" | "invalidSignature" };

function isIsoTimestamp(val: unknown): val is string {
  if (typeof val !== "string" || val.trim() === "") return false;
  const ms = Date.parse(val);
  return Number.isFinite(ms);
}

/**
 * Validates that an unknown object conforms strictly to the LicensePayload schema.
 */
export function validateLicensePayload(raw: unknown): LicensePayload | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj["schemaVersion"] !== 1) return null;
  if (typeof obj["licenseId"] !== "string" || obj["licenseId"].trim() === "") {
    return null;
  }
  if (
    typeof obj["orgName"] !== "string" ||
    obj["orgName"].trim().length === 0 ||
    obj["orgName"].trim().length > MAX_ORG_NAME_LEN
  ) {
    return null;
  }
  const tier = obj["tier"];
  if (tier !== "pro" && tier !== "enterprise") return null;

  const seats = obj["seats"];
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1) {
    return null;
  }
  if (!isIsoTimestamp(obj["issuedAt"])) return null;

  const expiresAt = obj["expiresAt"];
  if (expiresAt !== null && !isIsoTimestamp(expiresAt)) {
    return null;
  }
  if (
    typeof expiresAt === "string" &&
    Date.parse(expiresAt) <= Date.parse(obj["issuedAt"])
  ) {
    return null;
  }

  const featuresRaw = obj["features"];
  if (!Array.isArray(featuresRaw)) return null;
  const features: LicenseFeature[] = [];
  for (const f of featuresRaw) {
    if (typeof f !== "string" || !VALID_FEATURES.has(f as LicenseFeature)) {
      return null;
    }
    features.push(f as LicenseFeature);
  }

  return {
    schemaVersion: 1,
    licenseId: obj["licenseId"],
    orgName: obj["orgName"],
    tier,
    seats,
    issuedAt: obj["issuedAt"],
    expiresAt: expiresAt ?? null,
    features,
  };
}

/**
 * Parses a raw JSON string into a structured LicenseFile before cryptographic verification.
 */
export function parseLicenseJson(
  rawText: string,
): { ok: true; file: LicenseFile } | { ok: false; code: "invalidFormat" } {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false, code: "invalidFormat" };
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj["sig"] !== "string" || obj["sig"].trim() === "") {
      return { ok: false, code: "invalidFormat" };
    }
    const payload = validateLicensePayload(obj["payload"]);
    if (!payload) {
      return { ok: false, code: "invalidFormat" };
    }
    return {
      ok: true,
      file: {
        payload,
        sig: obj["sig"].trim(),
      },
    };
  } catch {
    return { ok: false, code: "invalidFormat" };
  }
}

/**
 * Verifies the schema and Ed25519 signature of a LicenseFile offline.
 */
export function verifyLicenseFile(
  file: unknown,
  publicKeyPem: string = DEFAULT_PUBLIC_KEY_PEM,
): VerifyLicenseResult {
  if (typeof file !== "object" || file === null || Array.isArray(file)) {
    return { ok: false, code: "invalidFormat" };
  }
  const obj = file as Record<string, unknown>;
  if (typeof obj["sig"] !== "string" || obj["sig"].trim() === "") {
    return { ok: false, code: "invalidFormat" };
  }
  const payload = validateLicensePayload(obj["payload"]);
  if (!payload) {
    return { ok: false, code: "invalidFormat" };
  }

  try {
    const data = Buffer.from(canonicalizePayload(payload), "utf8");
    const sigBytes = Buffer.from(obj["sig"].trim(), "base64url");
    if (sigBytes.byteLength !== 64) {
      return { ok: false, code: "invalidSignature" };
    }
    const isValid = verify(null, data, publicKeyPem, sigBytes);
    if (!isValid) {
      return { ok: false, code: "invalidSignature" };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, code: "invalidSignature" };
  }
}

/**
 * Signs a validated LicensePayload using an Ed25519 private key PEM (used by vendor CLI & unit tests).
 */
export function signLicensePayload(
  payload: LicensePayload,
  privateKeyPem: string,
): LicenseFile {
  const data = Buffer.from(canonicalizePayload(payload), "utf8");
  const sig = sign(null, data, privateKeyPem).toString("base64url");
  return { payload, sig };
}
