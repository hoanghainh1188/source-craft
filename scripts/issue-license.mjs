#!/usr/bin/env node
// 226 — Standalone offline vendor CLI tool for Ed25519 keypair generation and .sclicense signing.
// Usage:
//   node scripts/issue-license.mjs keygen --out-dir ./keys
//   node scripts/issue-license.mjs sign --private-key ./keys/license-private.pem --org "ACME" --tier enterprise --seats 50 --days 365 --out ./acme.sclicense

import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PRO_FEATURES = [
  "multimedia",
  "studioPro",
  "meetingLong",
  "sharedNotebooks",
  "crossNotebookSearch",
  "brandedExport",
];
const DEFAULT_ENTERPRISE_FEATURES = [
  "multimedia",
  "studioPro",
  "meetingLong",
  "lanAi",
  "sharedNotebooks",
  "itPolicy",
  "crossNotebookSearch",
  "brandedExport",
];

/**
 * Recursively sorts object keys in lexicographical order and serializes to a compact JSON string.
 */
export function canonicalizeJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson(value[k])}`,
  );
  return `{${entries.join(",")}}`;
}

/**
 * Generates a new Ed25519 keypair in PEM format (SPKI public key + PKCS#8 private key).
 */
export function generateVendorKeyPair() {
  return generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

/**
 * Creates and signs a .sclicense object using an Ed25519 private key PEM.
 */
export function issueLicense({
  privateKeyPem,
  orgName,
  tier = "enterprise",
  seats = 1,
  days = 365,
  features,
  issuedAt = new Date().toISOString(),
  licenseId = randomUUID(),
}) {
  if (!orgName || typeof orgName !== "string" || orgName.trim().length === 0) {
    throw new Error("--org <name> is required.");
  }
  if (tier !== "pro" && tier !== "enterprise") {
    throw new Error('--tier must be "pro" or "enterprise".');
  }
  const parsedSeats = Number(seats);
  if (!Number.isInteger(parsedSeats) || parsedSeats < 1) {
    throw new Error("--seats must be a positive integer.");
  }

  let expiresAt = null;
  if (days !== "perpetual" && days !== null && days !== undefined) {
    const numDays = Number(days);
    if (!Number.isFinite(numDays) || numDays <= 0) {
      throw new Error('--days must be a positive number or "perpetual".');
    }
    const issuedMs = Date.parse(issuedAt);
    expiresAt = new Date(issuedMs + numDays * 86_400_000).toISOString();
  }

  const resolvedFeatures = Array.isArray(features)
    ? features
    : tier === "enterprise"
      ? [...DEFAULT_ENTERPRISE_FEATURES]
      : [...DEFAULT_PRO_FEATURES];

  const payload = {
    schemaVersion: 1,
    licenseId,
    orgName: orgName.trim(),
    tier,
    seats: parsedSeats,
    issuedAt,
    expiresAt,
    features: resolvedFeatures,
  };

  const canonical = canonicalizeJson(payload);
  const sig = sign(null, Buffer.from(canonical, "utf8"), privateKeyPem).toString(
    "base64url",
  );

  return { payload, sig };
}

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = args[i + 1];
      out[key] = val;
      i++;
    }
  }
  return out;
}

export function runCli(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  const flags = parseFlags(rest);

  if (cmd === "keygen") {
    const outDir = flags["out-dir"] || "./keys";
    mkdirSync(outDir, { recursive: true });
    const { publicKey, privateKey } = generateVendorKeyPair();
    const privPath = join(outDir, "license-private.pem");
    const pubPath = join(outDir, "license-public.pem");
    writeFileSync(privPath, privateKey, { mode: 0o600 });
    writeFileSync(pubPath, publicKey, "utf8");
    return { command: "keygen", privPath, pubPath, publicKey };
  }

  if (cmd === "sign") {
    const privPath = flags["private-key"];
    const outPath = flags["out"];
    if (!privPath || !outPath) {
      throw new Error(
        "Usage: issue-license.mjs sign --private-key <pem> --org <name> --tier <pro|enterprise> --seats <n> --days <n|perpetual> --out <file.sclicense>",
      );
    }
    const privateKeyPem = readFileSync(privPath, "utf8");
    const licenseFile = issueLicense({
      privateKeyPem,
      orgName: flags["org"],
      tier: flags["tier"] || "enterprise",
      seats: flags["seats"] ? Number(flags["seats"]) : 1,
      days: flags["days"] ?? 365,
      features: flags["features"]
        ? flags["features"]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined,
    });
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(licenseFile, null, 2)}\n`, "utf8");
    return { command: "sign", outPath, licenseFile };
  }

  throw new Error(
    'Unknown command. Expected "keygen" or "sign".',
  );
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  try {
    const res = runCli();
    if (res.command === "keygen") {
      console.log(`Generated Ed25519 keypair:\n  Private: ${res.privPath}\n  Public:  ${res.pubPath}`);
    } else if (res.command === "sign") {
      console.log(`Signed license written to: ${res.outPath}`);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
