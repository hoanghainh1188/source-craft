import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LicenseFile, LicensePayload } from "@shared/ipc/types";
import { canonicalizePayload } from "../../../src/main/services/license/canonical-json";
import {
  DEFAULT_PUBLIC_KEY_PEM,
  parseLicenseJson,
  signLicensePayload,
  verifyLicenseFile,
} from "../../../src/main/services/license/license-verifier";

function makeKeyPair() {
  return generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function samplePayload(
  overrides: Partial<LicensePayload> = {},
): LicensePayload {
  return {
    schemaVersion: 1,
    licenseId: "550e8400-e29b-41d4-a716-446655440000",
    orgName: "ACME Enterprise Corp",
    tier: "enterprise",
    seats: 50,
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
    features: [
      "multimedia",
      "studioPro",
      "meetingLong",
      "lanAi",
      "sharedNotebooks",
      "itPolicy",
    ],
    ...overrides,
  };
}

describe("canonical-json & license-verifier", () => {
  it("serializes payload keys in deterministic alphabetical order regardless of key insertion order", () => {
    const p1 = samplePayload();
    const p2 = {
      tier: p1.tier,
      seats: p1.seats,
      orgName: p1.orgName,
      schemaVersion: p1.schemaVersion,
      features: [...p1.features],
      expiresAt: p1.expiresAt,
      issuedAt: p1.issuedAt,
      licenseId: p1.licenseId,
    } as LicensePayload;

    expect(canonicalizePayload(p1)).toBe(canonicalizePayload(p2));
  });

  it("verifies a valid Ed25519 signed enterprise license", () => {
    const { publicKey, privateKey } = makeKeyPair();
    const payload = samplePayload();
    const file = signLicensePayload(payload, privateKey);

    const res = verifyLicenseFile(file, publicKey);
    expect(res).toEqual({ ok: true, payload });
  });

  it("verifies a valid perpetual Pro license (expiresAt = null)", () => {
    const { publicKey, privateKey } = makeKeyPair();
    const payload = samplePayload({
      tier: "pro",
      seats: 1,
      expiresAt: null,
      features: ["multimedia", "studioPro", "meetingLong"],
    });
    const file = signLicensePayload(payload, privateKey);

    const res = verifyLicenseFile(file, publicKey);
    expect(res).toEqual({ ok: true, payload });
  });

  it("rejects when seats, tier, orgName, or expiresAt is tampered after signing", () => {
    const { publicKey, privateKey } = makeKeyPair();
    const file = signLicensePayload(
      samplePayload({ tier: "pro", seats: 5 }),
      privateKey,
    );

    expect(
      verifyLicenseFile(
        { ...file, payload: { ...file.payload, seats: 999 } },
        publicKey,
      ),
    ).toEqual({ ok: false, code: "invalidSignature" });

    expect(
      verifyLicenseFile(
        { ...file, payload: { ...file.payload, tier: "enterprise" } },
        publicKey,
      ),
    ).toEqual({ ok: false, code: "invalidSignature" });

    expect(
      verifyLicenseFile(
        { ...file, payload: { ...file.payload, orgName: "Hacked Org" } },
        publicKey,
      ),
    ).toEqual({ ok: false, code: "invalidSignature" });

    expect(
      verifyLicenseFile(
        { ...file, payload: { ...file.payload, expiresAt: null } },
        publicKey,
      ),
    ).toEqual({ ok: false, code: "invalidSignature" });
  });

  it("rejects signature signed by a different private key", () => {
    const kp1 = makeKeyPair();
    const kp2 = makeKeyPair();
    const file = signLicensePayload(samplePayload(), kp1.privateKey);

    expect(verifyLicenseFile(file, kp2.publicKey)).toEqual({
      ok: false,
      code: "invalidSignature",
    });
  });

  it("rejects malformed JSON and invalid payload schemas with invalidFormat", () => {
    const { publicKey, privateKey } = makeKeyPair();
    expect(parseLicenseJson("not json")).toEqual({
      ok: false,
      code: "invalidFormat",
    });
    expect(parseLicenseJson(JSON.stringify({ foo: "bar" }))).toEqual({
      ok: false,
      code: "invalidFormat",
    });

    // Invalid seats (0) or empty orgName
    const badSeats = {
      payload: { ...samplePayload(), seats: 0 },
      sig: "dummysig",
    } as unknown as LicenseFile;
    expect(verifyLicenseFile(badSeats, publicKey)).toEqual({
      ok: false,
      code: "invalidFormat",
    });

    const badOrg = signLicensePayload(
      samplePayload({ orgName: "   " }),
      privateKey,
    );
    expect(verifyLicenseFile(badOrg, publicKey)).toEqual({
      ok: false,
      code: "invalidFormat",
    });
  });

  it("embeds a valid SPKI Ed25519 DEFAULT_PUBLIC_KEY_PEM", () => {
    expect(DEFAULT_PUBLIC_KEY_PEM).toContain("-----BEGIN PUBLIC KEY-----");
    // Signing with a random key against DEFAULT_PUBLIC_KEY_PEM should cleanly return invalidSignature
    const { privateKey } = makeKeyPair();
    const signed = sign(
      null,
      Buffer.from(canonicalizePayload(samplePayload()), "utf8"),
      privateKey,
    ).toString("base64url");
    expect(
      verifyLicenseFile({ payload: samplePayload(), sig: signed }),
    ).toEqual({ ok: false, code: "invalidSignature" });
  });
});
