# Data Model: Enterprise Offline License & Feature Gate (`enterprise-license`)

**Feature**: `20261024-194623-enterprise-license`
**Date**: 2026-10-24

## 1. Shared Domain Types (`src/shared/ipc/types.ts`)

```ts
/** Commercial tier of the application. */
export type LicenseTier = "free" | "pro" | "enterprise";

/** B2B feature flags unlocked by a license payload. */
export type LicenseFeature =
  | "multimedia"      // Audio, video, image ingestion
  | "studioPro"       // All 9 Studio synthesis kinds + custom prompt
  | "meetingLong"     // Unlimited meeting recording (up to disk limit)
  | "lanAi"           // LAN / Private AI Server connection (Phase 2)
  | "sharedNotebooks" // Shared read-only .scnb team notebooks (Phase 3)
  | "itPolicy";       // Enterprise IT policy enforcement (Phase 2)

/** Signed payload inside a `.sclicense` file. */
export interface LicensePayload {
  schemaVersion: 1;
  /** Unique license identifier (UUID v4). */
  licenseId: string;
  /** Organization or customer display name (1..120 chars). */
  orgName: string;
  /** Target tier (`pro` or `enterprise`). */
  tier: Exclude<LicenseTier, "free">;
  /** Number of licensed seats (integer >= 1). */
  seats: number;
  /** ISO-8601 UTC timestamp when the license was issued. */
  issuedAt: string;
  /** ISO-8601 UTC timestamp when the license expires, or `null` for perpetual. */
  expiresAt: string | null;
  /** Explicit feature flags enabled for this license. */
  features: LicenseFeature[];
}

/** Structure of a `.sclicense` JSON file on disk. */
export interface LicenseFile {
  payload: LicensePayload;
  /** Base64url-encoded 64-byte Ed25519 signature over canonical JSON of `payload`. */
  sig: string;
}

/** Effective entitlements computed from the active license state. */
export interface Entitlements {
  tier: LicenseTier;
  /** Max notebooks allowed (`3` for free, `null` for unlimited). */
  maxNotebooks: number | null;
  /** Max sources per notebook (`10` for free, `null` for unlimited). */
  maxSourcesPerNotebook: number | null;
  /** Max seconds per meeting recording (`900` for free, `null` for unlimited). */
  maxMeetingSeconds: number | null;
  /** Allowed source kinds for `source:add`. */
  allowedSourceKinds: SourceKind[];
  /** Allowed Studio synthesis kinds for `studio:generate`. */
  allowedStudioKinds: StudioKind[];
  /** Enabled B2B feature flags. */
  features: LicenseFeature[];
}

/** Validation state of the stored license. */
export type LicenseState =
  | "free"          // No license activated
  | "valid"         // Signature valid and within expiration window
  | "expired"       // Signature valid but current time > expiresAt
  | "invalid"       // Corrupted file or invalid signature
  | "clockTampered";// System clock rolled back > 24h from lastSeenAtMs

/** Full license status returned to the renderer (`license:getStatus` / `license:changed`). */
export interface LicenseStatus {
  state: LicenseState;
  tier: LicenseTier;
  orgName: string | null;
  seats: number | null;
  issuedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  entitlements: Entitlements;
}

/** Error codes specific to `.sclicense` file activation. */
export type LicenseActivationErrorCode =
  | "invalidFormat"
  | "invalidSignature"
  | "expired"
  | "clockTampered"
  | "ioError";

/** Result of `license:activateFile` IPC call. */
export type ActivateLicenseResult =
  | { status: "ok"; license: LicenseStatus }
  | { status: "cancelled" }
  | { status: "error"; code: LicenseActivationErrorCode };
```

## 2. Tier Entitlement Matrix (`src/main/services/license/feature-gate.ts`)

| Property | `free` (Community / Expired / Invalid) | `pro` | `enterprise` |
|---|---|---|---|
| `maxNotebooks` | `3` | `null` (unlimited) | `null` (unlimited) |
| `maxSourcesPerNotebook` | `10` | `null` (unlimited) | `null` (unlimited) |
| `maxMeetingSeconds` | `900` (15 minutes) | `null` (unlimited) | `null` (unlimited) |
| `allowedSourceKinds` | `["pdf", "docx", "txt", "md", "url"]` | All 8 `SourceKind`s (`+ "audio", "video", "image"`) | All 8 `SourceKind`s |
| `allowedStudioKinds` | `["summary", "keyPoints"]` | All 9 `StudioKind`s | All 9 `StudioKind`s |
| Default `features` | `[]` | `["multimedia", "studioPro", "meetingLong"]` | `["multimedia", "studioPro", "meetingLong", "lanAi", "sharedNotebooks", "itPolicy"]` |

## 3. Persistence Schema (`electron-store`)

No SQLite migration is required. Two keys are stored in the application's `StoreLike` (`electron-store`):
- `"license.file"`: `LicenseFile | null` — The activated license object (payload + Ed25519 signature).
- `"license.lastSeenAtMs"`: `number` — Highest observed wall-clock timestamp (ms since epoch) used for the 24-hour clock rollback guard.
