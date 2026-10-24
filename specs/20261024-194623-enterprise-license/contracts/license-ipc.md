# Contract: License IPC & Error Codes (`license-ipc`)

**Feature**: `20261024-194623-enterprise-license`
**Date**: 2026-10-24

## 1. Whitelisted IPC Channels (`src/shared/ipc/channels.ts`)

| Constant | Channel String | Direction | Input | Output |
|---|---|---|---|---|
| `CHANNELS.licenseGetStatus` | `"license:getStatus"` | `renderer → main` (`invoke`) | `void` | `Promise<LicenseStatus>` |
| `CHANNELS.licenseActivateFile` | `"license:activateFile"` | `renderer → main` (`invoke`) | `void` | `Promise<ActivateLicenseResult>` |
| `CHANNELS.licenseDeactivate` | `"license:deactivate"` | `renderer → main` (`invoke`) | `void` | `Promise<LicenseStatus>` |
| `CHANNELS.licenseChanged` | `"license:changed"` | `main → renderer` (`send`) | — | `LicenseStatus` |

### Preload API (`window.api` in `src/preload/index.ts` & `src/shared/ipc/types.ts`)

```ts
export interface RendererApi {
  // ... existing methods
  getLicenseStatus: () => Promise<LicenseStatus>;
  activateLicenseFile: () => Promise<ActivateLicenseResult>;
  deactivateLicense: () => Promise<LicenseStatus>;
  onLicenseChanged: (cb: (status: LicenseStatus) => void) => () => void;
}
```

## 2. Security & Privacy Rules (Constitution Principles I & III)

1. **No Path From Renderer**: `license:activateFile` takes NO arguments from the renderer. Main process opens Electron's native `dialog.showOpenDialog` filtered to `[{ name: "SourceCraft License", extensions: ["sclicense"] }]`, reads at most 64 KB from the selected file, verifies the Ed25519 signature, persists to `store`, and broadcasts `license:changed`.
2. **Zero Egress**: Verification uses `node:crypto` Ed25519 offline. No HTTP/DNS calls are ever made.
3. **Log Sanitization**: `logEvent` may log `license.activated` (`{ tier, seats }`), `license.activateFailed` (`{ code }`), and `license.deactivated` (`{}`). It MUST NEVER log `orgName`, `licenseId`, file paths, or `sig`.

## 3. User-Facing Error Codes (`src/shared/codes/user-error.ts`)

Append 4 new error codes to `USER_ERROR_CODES`:

| Code | Params | Thrown By | Trigger Condition |
|---|---|---|---|
| `"licenseLimitNotebooks"` | `{ max: number }` | `CHANNELS.notebookCreate` | `notebookRepo.list().length >= entitlements.maxNotebooks` |
| `"licenseLimitSources"` | `{ max: number }` | `CHANNELS.sourceAdd` | `sourceRepo.listByNotebook(notebookId).length >= entitlements.maxSourcesPerNotebook` |
| `"licenseRequireProFormat"` | `{ kind: string }` | `CHANNELS.sourceAdd` | `!entitlements.allowedSourceKinds.includes(kind)` |
| `"licenseRequireProStudio"` | `{ kind: string }` | `CHANNELS.studioGenerate` | `!entitlements.allowedStudioKinds.includes(kind)` |

## 4. Meeting Capture Duration Limit (`MeetingState.endReason`)

- Extend `MeetingState["endReason"]` union with `"limitReached"`:
  ```ts
  endReason?: "diskFull" | "noAudio" | "rendererGone" | "crash" | "limitReached";
  ```
- When `entitlements.maxMeetingSeconds !== null` (e.g. `900` seconds on `free` tier) and an active recording's `durationSec >= maxMeetingSeconds`:
  - Main process automatically stops the active recording with `endReason: "limitReached"` and transitions through `stopping` → `finalizing` → `done` so the user's 15-minute transcript is saved and indexed without data loss.
