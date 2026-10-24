# Research: Enterprise Offline License & Feature Gate (`enterprise-license`)

**Feature**: `20261024-194623-enterprise-license`
**Date**: 2026-10-24

## 1. Ed25519 Offline Signature Scheme (`node:crypto`)

- **Decision**: Use Node.js built-in `node:crypto` (`generateKeyPairSync("ed25519")`, `sign(null, data, privateKey)`, `verify(null, data, publicKey)`) with PEM-encoded SPKI public keys and PKCS#8 private keys.
- **Rationale**:
  - Zero third-party npm dependencies (aligns with Security & Supply-Chain rules in `CLAUDE.md`).
  - Ed25519 is fast (< 1 ms per verification), immune to malleable nonce bugs, and produces compact 64-byte signatures (86 chars in `base64url`).
  - `crypto.verify(null, Buffer.from(canonicalPayload, "utf8"), publicKeyPem, Buffer.from(sig, "base64url"))` runs synchronously in the main process without network I/O (Constitution Principle I).
- **Alternatives Considered**:
  - RSA-2048: Larger keys and signatures (~342 base64 chars), slower verification.
  - WebCrypto `subtle`: Asynchronous API adds unnecessary complexity for synchronous startup/gate checks in main process.
  - Online JWT verification server: Violates Constitution Principle I (No Default Egress) and breaks air-gapped B2B deployments.

## 2. Canonical JSON Serialization (`canonicalizePayload`)

- **Decision**: Serialize `LicensePayload` by recursively sorting object keys lexicographically (`Object.keys(obj).sort()`) and formatting with `JSON.stringify` (no whitespace). Specifically for `LicensePayload`, `features` array is preserved in its exact array order as signed, while top-level keys (`expiresAt`, `features`, `issuedAt`, `licenseId`, `orgName`, `schemaVersion`, `seats`, `tier`) are sorted alphabetically.
- **Rationale**:
  - Guarantees byte-for-byte identical UTF-8 buffers between `scripts/issue-license.mjs` and `src/main/services/license/license-verifier.ts` regardless of key insertion order when parsing/formatting JSON files.
- **Alternatives Considered**:
  - Signing a pre-encoded base64 payload string (JWS style): Less human-readable when enterprise IT admins inspect `.sclicense` in a text editor. Signing canonical JSON keeps `.sclicense` as a clean, readable JSON document `{ payload, sig }`.

## 3. Public Key Embedding & Test Key Injection

- **Decision**: Embed a default production Ed25519 public key constant `DEFAULT_PUBLIC_KEY_PEM` in `src/main/services/license/license-verifier.ts`, and allow overriding `publicKeyPem` via dependency injection (`LicenseServiceDeps.publicKeyPem` or environment variable `SC_LICENSE_PUBKEY_PEM` in dev/test builds when `!app.isPackaged`).
- **Rationale**:
  - Unit tests and E2E tests can generate ephemeral Ed25519 keypairs in memory or use test fixtures without holding the vendor's production private key.
  - CLI `scripts/issue-license.mjs` can output the matching public key (`keygen` command) and sign `.sclicense` files with any private key PEM file.

## 4. Clock Rollback Guard (`licenseLastSeenAtMs`)

- **Decision**: Persist `licenseLastSeenAtMs` (number, epoch ms) alongside `licenseFile` (`LicenseFile | null`) in `electron-store`. Whenever `getStatus()` or `activateData()` evaluates a license with `expiresAt !== null`:
  1. Check `nowMs < lastSeenAtMs - 86_400_000` (24 hours tolerance for timezone travel / DST / NTP adjustment). If true, return `state: "clockTampered"` and downgrade effective entitlements to `free`.
  2. Otherwise, if `nowMs > lastSeenAtMs`, update `licenseLastSeenAtMs = nowMs`.
  3. Check `nowMs > Date.parse(payload.expiresAt)`. If true, return `state: "expired"` and downgrade effective entitlements to `free`.
- **Rationale**:
  - Prevents trivial bypass of annual/trial B2B licenses by setting the OS clock backward, while avoiding false positives when traveling across timezones (up to 24h tolerance).

## 5. Main-Process Enforcement & Meeting Auto-Stop Hook

- **Decision**:
  - Enforce tier limits in `src/main/ipc/register.ts` before delegating to services:
    - `notebookCreate`: check `notebookRepo.list().length >= gate.getEntitlements().maxNotebooks` → throw `new UserFacingError("licenseLimitNotebooks", { max: entitlements.maxNotebooks })`.
    - `sourceAdd`: check `sourceRepo.listByNotebook(notebookId).length >= entitlements.maxSourcesPerNotebook` → throw `new UserFacingError("licenseLimitSources", { max: entitlements.maxSourcesPerNotebook })`; also detect `kind` from `input` (`url` or `detectKindFromPath(input.filePath)`) and check `!entitlements.allowedSourceKinds.includes(kind)` → throw `new UserFacingError("licenseRequireProFormat", { kind })`.
    - `studioGenerate`: check `!entitlements.allowedStudioKinds.includes(studioInput.kind)` → throw `new UserFacingError("licenseRequireProStudio", { kind: studioInput.kind })`.
  - For Meeting Capture duration limit (`maxMeetingSeconds`):
    - Add an optional `maxDurationSec?: () => number | null` callback to `MeetingServiceDeps` in `src/main/services/meeting-capture/meeting-service.ts`.
    - Inside `ingest()` (and `acceptAudio`/`pumpTestAudio`), after updating segment samples, if `maxDurationSec?.()` returns a finite limit `maxSec` and `durationSec(a) >= maxSec`, automatically call `void stopActive(a, "user")` (or `"limitReached"` mapped to `endReason: "limitReached"` in `MeetingState` so the session transitions cleanly to `stopping` → `finalizing` and saves the full 15-minute transcript).
- **Rationale**:
  - Centralizing request gates in `register.ts` keeps `NotebookRepo`, `IngestionPipeline`, and `StudioService` decoupled from licensing, while adding `maxDurationSec` DI to `MeetingService` reuses the battle-tested `stopActive` finalization pipeline so users never lose recorded audio when hitting the 15-minute Free cap.
