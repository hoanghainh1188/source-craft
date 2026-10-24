import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { LicensePayload, LicenseStatus } from "@shared/ipc/types";
import { signLicensePayload } from "../../../src/main/services/license/license-verifier";
import {
  CLOCK_ROLLBACK_TOLERANCE_MS,
  createLicenseService,
  MAX_LICENSE_FILE_BYTES,
} from "../../../src/main/services/license/license-service";

function makeKeyPair() {
  return generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function makeMemoryStore() {
  const data = new Map<string, unknown>();
  return {
    get: (key: string) => data.get(key),
    set: (key: string, value: unknown) => {
      data.set(key, value);
    },
  };
}

function makePayload(overrides: Partial<LicensePayload> = {}): LicensePayload {
  return {
    schemaVersion: 1,
    licenseId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    orgName: "Tập đoàn ACME Việt Nam",
    tier: "enterprise",
    seats: 100,
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

describe("LicenseService", () => {
  it("defaults to free tier when store is empty", () => {
    const { publicKey } = makeKeyPair();
    const store = makeMemoryStore();
    const service = createLicenseService({
      store,
      publicKeyPem: publicKey,
      now: () => Date.parse("2026-06-01T00:00:00.000Z"),
    });

    const st = service.getStatus();
    expect(st.state).toBe("free");
    expect(st.tier).toBe("free");
    expect(st.orgName).toBeNull();
    expect(st.seats).toBeNull();
    expect(st.entitlements.maxNotebooks).toBe(3);
  });

  it("activates a valid Enterprise .sclicense via dialog, persists to store, and broadcasts change", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    const store = makeMemoryStore();
    const file = signLicensePayload(makePayload(), privateKey);
    const rawJson = JSON.stringify(file, null, 2);
    const broadcasted: LicenseStatus[] = [];

    const service = createLicenseService({
      store,
      publicKeyPem: publicKey,
      now: () => Date.parse("2026-06-01T00:00:00.000Z"),
      pickFile: async () => "/tmp/acme.sclicense",
      readFileBytes: async () => new TextEncoder().encode(rawJson),
      broadcast: (st) => broadcasted.push(st),
    });

    const res = await service.activateFromDialog();
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.license.state).toBe("valid");
      expect(res.license.tier).toBe("enterprise");
      expect(res.license.orgName).toBe("Tập đoàn ACME Việt Nam");
      expect(res.license.seats).toBe(100);
      expect(res.license.daysRemaining).toBe(214);
      expect(res.license.entitlements.maxNotebooks).toBeNull();
    }
    expect(broadcasted).toHaveLength(1);
    expect(broadcasted[0]?.tier).toBe("enterprise");
  });

  it("returns cancelled when user cancels the file picker dialog", async () => {
    const { publicKey } = makeKeyPair();
    const service = createLicenseService({
      store: makeMemoryStore(),
      publicKeyPem: publicKey,
      pickFile: async () => null,
    });

    const res = await service.activateFromDialog();
    expect(res).toEqual({ status: "cancelled" });
  });

  it("rejects files larger than MAX_LICENSE_FILE_BYTES (64 KB) with ioError", async () => {
    const { publicKey } = makeKeyPair();
    const service = createLicenseService({
      store: makeMemoryStore(),
      publicKeyPem: publicKey,
      pickFile: async () => "/tmp/huge.sclicense",
      readFileBytes: async () => new Uint8Array(MAX_LICENSE_FILE_BYTES + 1),
    });

    const res = await service.activateFromDialog();
    expect(res).toEqual({ status: "error", code: "ioError" });
  });

  it("rejects expired license during activation and downgrades stored license on expiry", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    const store = makeMemoryStore();
    let currentNow = Date.parse("2026-06-01T00:00:00.000Z");

    const file = signLicensePayload(
      makePayload({ expiresAt: "2026-07-01T00:00:00.000Z" }),
      privateKey,
    );

    const service = createLicenseService({
      store,
      publicKeyPem: publicKey,
      now: () => currentNow,
      pickFile: async () => "/tmp/acme.sclicense",
      readFileBytes: async () => new TextEncoder().encode(JSON.stringify(file)),
    });

    // Valid on June 1
    const okRes = await service.activateFromDialog();
    expect(okRes.status).toBe("ok");

    // Advance clock to July 2 (expired)
    currentNow = Date.parse("2026-07-02T00:00:00.000Z");
    const statusAfterExpiry = service.getStatus();
    expect(statusAfterExpiry.state).toBe("expired");
    expect(statusAfterExpiry.tier).toBe("free");
    expect(statusAfterExpiry.orgName).toBe("Tập đoàn ACME Việt Nam");
    expect(statusAfterExpiry.entitlements.maxNotebooks).toBe(3);

    // Trying to activate an already-expired file fails with code: "expired"
    const expiredRes = await service.activateFromDialog();
    expect(expiredRes).toEqual({ status: "error", code: "expired" });
  });

  it("detects system clock rollback > 24h and downgrades entitlements to free", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    const store = makeMemoryStore();
    let currentNow = Date.parse("2026-06-15T12:00:00.000Z");

    const file = signLicensePayload(makePayload(), privateKey);
    const service = createLicenseService({
      store,
      publicKeyPem: publicKey,
      now: () => currentNow,
      pickFile: async () => "/tmp/acme.sclicense",
      readFileBytes: async () => new TextEncoder().encode(JSON.stringify(file)),
    });

    await service.activateFromDialog();
    expect(service.getStatus().state).toBe("valid");

    // Roll back 12 hours (within 24h timezone tolerance) -> still valid
    currentNow -= 12 * 3600 * 1000;
    expect(service.getStatus().state).toBe("valid");

    // Roll back 25 hours from initial timestamp -> clockTampered!
    currentNow =
      Date.parse("2026-06-15T12:00:00.000Z") -
      CLOCK_ROLLBACK_TOLERANCE_MS -
      3600_000;
    const tampered = service.getStatus();
    expect(tampered.state).toBe("clockTampered");
    expect(tampered.tier).toBe("free");
    expect(tampered.entitlements.maxNotebooks).toBe(3);
  });

  it("deactivates an active license and returns to free state", async () => {
    const { publicKey, privateKey } = makeKeyPair();
    const store = makeMemoryStore();
    const file = signLicensePayload(makePayload(), privateKey);

    const service = createLicenseService({
      store,
      publicKeyPem: publicKey,
      now: () => Date.parse("2026-06-01T00:00:00.000Z"),
      pickFile: async () => "/tmp/acme.sclicense",
      readFileBytes: async () => new TextEncoder().encode(JSON.stringify(file)),
    });

    await service.activateFromDialog();
    expect(service.getStatus().tier).toBe("enterprise");

    const afterDeactivate = service.deactivate();
    expect(afterDeactivate.state).toBe("free");
    expect(afterDeactivate.tier).toBe("free");
    expect(afterDeactivate.orgName).toBeNull();
  });
});
