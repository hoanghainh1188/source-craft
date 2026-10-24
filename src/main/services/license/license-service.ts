import type {
  ActivateLicenseResult,
  LicenseFile,
  LicensePayload,
  LicenseStatus,
  LicenseTier,
} from "@shared/ipc/types";
import type { StoreLike } from "../app-shell/onboarding";
import {
  createFeatureGate,
  entitlementsFor,
  type FeatureGate,
} from "./feature-gate";
import {
  DEFAULT_PUBLIC_KEY_PEM,
  parseLicenseJson,
  verifyLicenseFile,
} from "./license-verifier";

// 226 — Main-process LicenseService: manages .sclicense activation, persistence in electron-store,
// 24-hour clock-rollback guard, and FeatureGate binding. Zero network egress (Constitution Principle I & III).

export const STORE_KEY_LICENSE_FILE = "license.file";
export const STORE_KEY_LAST_SEEN_MS = "license.lastSeenAtMs";

/** 24 hours tolerance for timezone changes, DST, or NTP clock adjustments. */
export const CLOCK_ROLLBACK_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/** Maximum allowed size for a .sclicense file (64 KB) to prevent memory exhaustion. */
export const MAX_LICENSE_FILE_BYTES = 64 * 1024;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LicenseServiceDeps {
  store: StoreLike;
  publicKeyPem?: string;
  /** Optional fallback tier when no .sclicense file is stored (e.g. E2E test seam on unpackaged builds). */
  defaultTier?: LicenseTier;
  now?: () => number;
  /** Opens native file picker in main process and returns selected path or null if cancelled. */
  pickFile?: () => Promise<string | null>;
  /** Reads file bytes from disk (used after pickFile). */
  readFileBytes?: (filePath: string) => Promise<Uint8Array>;
  /** Broadcasts updated LicenseStatus to all open BrowserWindows on license:changed. */
  broadcast?: (status: LicenseStatus) => void;
  /** Diagnostic event logger (never logs orgName, licenseId, filePath, or sig). */
  logEvent?: (
    event: string,
    meta?: Record<string, string | number | boolean>,
  ) => void;
}

export interface LicenseService {
  getStatus(): LicenseStatus;
  activateFromDialog(): Promise<ActivateLicenseResult>;
  activateRawJson(rawText: string): ActivateLicenseResult;
  deactivate(): LicenseStatus;
  gate: FeatureGate;
}

function buildDefaultStatus(tier: LicenseTier = "free"): LicenseStatus {
  if (tier === "pro" || tier === "enterprise") {
    return {
      state: "valid",
      tier,
      orgName: tier === "enterprise" ? "E2E Enterprise" : null,
      seats: tier === "enterprise" ? 100 : 1,
      issuedAt: null,
      expiresAt: null,
      daysRemaining: null,
      entitlements: entitlementsFor(tier),
    };
  }
  return {
    state: "free",
    tier: "free",
    orgName: null,
    seats: null,
    issuedAt: null,
    expiresAt: null,
    daysRemaining: null,
    entitlements: entitlementsFor("free"),
  };
}

function computeStatusFromPayload(
  payload: LicensePayload,
  nowMs: number,
  lastSeenMs: number,
): {
  status: LicenseStatus;
  nextLastSeenMs: number;
} {
  // Check clock rollback (> 24 hours behind highest recorded timestamp)
  if (lastSeenMs > 0 && nowMs < lastSeenMs - CLOCK_ROLLBACK_TOLERANCE_MS) {
    return {
      status: {
        state: "clockTampered",
        tier: "free",
        orgName: payload.orgName,
        seats: payload.seats,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        daysRemaining: null,
        entitlements: entitlementsFor("free"),
      },
      nextLastSeenMs: lastSeenMs,
    };
  }

  const nextLastSeenMs = Math.max(lastSeenMs, nowMs);

  // Check expiration if expiresAt is non-null
  if (payload.expiresAt !== null) {
    const expMs = Date.parse(payload.expiresAt);
    if (nowMs > expMs) {
      return {
        status: {
          state: "expired",
          tier: "free",
          orgName: payload.orgName,
          seats: payload.seats,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
          daysRemaining: 0,
          entitlements: entitlementsFor("free"),
        },
        nextLastSeenMs,
      };
    }
    const daysRemaining = Math.max(0, Math.ceil((expMs - nowMs) / MS_PER_DAY));
    return {
      status: {
        state: "valid",
        tier: payload.tier,
        orgName: payload.orgName,
        seats: payload.seats,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        daysRemaining,
        entitlements: entitlementsFor(payload.tier, payload.features),
      },
      nextLastSeenMs,
    };
  }

  // Perpetual license
  return {
    status: {
      state: "valid",
      tier: payload.tier,
      orgName: payload.orgName,
      seats: payload.seats,
      issuedAt: payload.issuedAt,
      expiresAt: null,
      daysRemaining: null,
      entitlements: entitlementsFor(payload.tier, payload.features),
    },
    nextLastSeenMs,
  };
}

export function createLicenseService(deps: LicenseServiceDeps): LicenseService {
  const {
    store,
    publicKeyPem = DEFAULT_PUBLIC_KEY_PEM,
    defaultTier = "free",
    now = () => Date.now(),
    pickFile,
    readFileBytes,
    broadcast,
    logEvent,
  } = deps;

  const readLastSeenMs = (): number => {
    const raw = store.get(STORE_KEY_LAST_SEEN_MS);
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
  };

  const writeLastSeenMs = (ms: number): void => {
    if (ms > readLastSeenMs()) {
      store.set(STORE_KEY_LAST_SEEN_MS, ms);
    }
  };

  const getStatus = (): LicenseStatus => {
    const stored = store.get(STORE_KEY_LICENSE_FILE);
    if (!stored) {
      return buildDefaultStatus(defaultTier);
    }
    const verified = verifyLicenseFile(stored, publicKeyPem);
    if (!verified.ok) {
      return {
        state: "invalid",
        tier: "free",
        orgName: null,
        seats: null,
        issuedAt: null,
        expiresAt: null,
        daysRemaining: null,
        entitlements: entitlementsFor("free"),
      };
    }

    const nowMs = now();
    const lastSeenMs = readLastSeenMs();
    const { status, nextLastSeenMs } = computeStatusFromPayload(
      verified.payload,
      nowMs,
      lastSeenMs,
    );
    writeLastSeenMs(nextLastSeenMs);
    return status;
  };

  const activateRawJson = (rawText: string): ActivateLicenseResult => {
    const parsed = parseLicenseJson(rawText);
    if (!parsed.ok) {
      logEvent?.("license.activateFailed", { code: parsed.code });
      return { status: "error", code: parsed.code };
    }
    const verified = verifyLicenseFile(parsed.file, publicKeyPem);
    if (!verified.ok) {
      logEvent?.("license.activateFailed", { code: verified.code });
      return { status: "error", code: verified.code };
    }

    const nowMs = now();
    const lastSeenMs = readLastSeenMs();
    const { status, nextLastSeenMs } = computeStatusFromPayload(
      verified.payload,
      nowMs,
      lastSeenMs,
    );

    if (status.state === "clockTampered") {
      logEvent?.("license.activateFailed", { code: "clockTampered" });
      return { status: "error", code: "clockTampered" };
    }
    if (status.state === "expired") {
      logEvent?.("license.activateFailed", { code: "expired" });
      return { status: "error", code: "expired" };
    }

    store.set(STORE_KEY_LICENSE_FILE, parsed.file satisfies LicenseFile);
    writeLastSeenMs(nextLastSeenMs);
    logEvent?.("license.activated", {
      tier: verified.payload.tier,
      seats: verified.payload.seats,
    });
    broadcast?.(status);
    return { status: "ok", license: status };
  };

  const activateFromDialog = async (): Promise<ActivateLicenseResult> => {
    if (!pickFile) {
      return { status: "error", code: "ioError" };
    }
    let filePath: string | null = null;
    try {
      filePath = await pickFile();
    } catch {
      return { status: "error", code: "ioError" };
    }
    if (!filePath) {
      return { status: "cancelled" };
    }
    if (!readFileBytes) {
      return { status: "error", code: "ioError" };
    }

    try {
      const bytes = await readFileBytes(filePath);
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_LICENSE_FILE_BYTES) {
        logEvent?.("license.activateFailed", { code: "ioError" });
        return { status: "error", code: "ioError" };
      }
      const rawText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return activateRawJson(rawText);
    } catch {
      logEvent?.("license.activateFailed", { code: "ioError" });
      return { status: "error", code: "ioError" };
    }
  };

  const deactivate = (): LicenseStatus => {
    store.set(STORE_KEY_LICENSE_FILE, null);
    const status = buildDefaultStatus("free");
    logEvent?.("license.deactivated", {});
    broadcast?.(status);
    return status;
  };

  const gate = createFeatureGate(() => getStatus().entitlements);

  return {
    getStatus,
    activateFromDialog,
    activateRawJson,
    deactivate,
    gate,
  };
}
