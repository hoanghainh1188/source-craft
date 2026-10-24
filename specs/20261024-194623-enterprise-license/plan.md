# Implementation Plan: Enterprise Offline License & Feature Gate (`enterprise-license`)

**Branch**: `226-enterprise-license` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20261024-194623-enterprise-license/spec.md`

## Summary

Implement a 100% offline, cryptographically verified licensing and feature-gating system for SourceCraft B2B/Enterprise monetization:
1. **Ed25519 Offline License Verifier (`license-verifier.ts`)**: Canonical JSON serialization + `node:crypto` Ed25519 signature verification against an embedded SPKI public key, with a 24-hour clock-rollback guard.
2. **Feature Gate & Tier Matrix (`feature-gate.ts`)**: Maps `free` / `pro` / `enterprise` states to concrete `Entitlements` (Free: max 3 notebooks, max 10 sources/notebook, text/web formats only, max 15m meeting capture, 2 Studio formats `summary` + `keyPoints`; Pro/Enterprise: unlimited + multimedia + all 9 Studio formats + Enterprise B2B flags).
3. **Main-Process Enforcement & IPC (`license-service.ts`, `register.ts`)**: Enforces limits at IPC boundaries (`notebook:create`, `source:add`, `studio:generate`, and `meeting-service` duration auto-stop) and exposes `license:getStatus`, `license:activateFile` (via native file dialog), `license:deactivate`, and `license:changed`.
4. **Renderer UI & Vendor CLI (`LicenseSection.tsx`, `scripts/issue-license.mjs`)**: Adds a License card in Settings, an `Enterprise · <orgName>` badge in the app Header, localized error messages (`vi`/`en`), and an offline vendor CLI tool for keypair generation and `.sclicense` signing.

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), Node.js 20+ (`node:crypto` Ed25519)
**Primary Dependencies**: Electron 33, React 18, `electron-store` (via `StoreLike`), TailwindCSS
**Storage**: `electron-store` keys `license.file` and `license.lastSeenAtMs` (no SQLite schema migration needed)
**Testing**: Vitest (`npm test`)
**Target Platform**: Desktop (macOS, Windows, Linux) — 100% offline capable
**Project Type**: Electron desktop application (`main` / `preload` / `renderer` / `shared`)
**Performance Goals**: Ed25519 verification and entitlement lookup < 5 ms in main process
**Constraints**: Zero network egress (Constitution Principle I); no file paths passed from renderer (Constitution Principle III); no sensitive license fields (`orgName`, `licenseId`, `sig`) in logs
**Scale/Scope**: 4 new main-process modules, 1 vendor CLI script, 4 IPC channels, 4 `UserErrorCode`s, Settings UI section + Header badge

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Local-First & No Default Egress**: PASS — Ed25519 signature verification uses built-in `node:crypto` locally; zero network requests are made during activation or startup.
- **II. Grounded Answers & Citation Integrity**: PASS — Does not alter RAG or Studio citation verification pipelines.
- **III. Desktop Security Boundary**: PASS — `license:activateFile` opens `dialog.showOpenDialog` in the main process, enforces a 64 KB file size cap, validates schema at boundary, whitelists IPC channels in `channels.ts`, and never logs `orgName`, `licenseId`, or `sig`.
- **IV. Test-First & Coverage Discipline**: PASS — Unit tests in `tests/unit/license/` cover Ed25519 verification, tampering, expiry, clock rollback, `FeatureGate` tier matrix, IPC enforcement hooks, and CLI keygen/sign round-trip with ≥ 80% coverage.
- **V. Simplicity & Performance**: PASS — Zero new npm packages; pure functions for canonicalization, verification, and entitlement computation.

## Project Structure

### Documentation (this feature)

```text
specs/20261024-194623-enterprise-license/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── license-ipc.md   # Phase 1 IPC & error code contract
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
scripts/
└── issue-license.mjs                            # Vendor CLI for Ed25519 keygen & .sclicense signing

src/
├── shared/
│   ├── codes/
│   │   └── user-error.ts                        # +4 license UserErrorCodes
│   ├── ipc/
│   │   ├── channels.ts                          # +4 license IPC channels
│   │   └── types.ts                             # LicenseTier, LicensePayload, Entitlements, LicenseStatus, RendererApi
│   └── i18n/
│       ├── vi.ts                                # Vietnamese translations for license UI & errors
│       └── en.ts                                # English translations for license UI & errors
├── main/
│   ├── index.ts                                 # Wire LicenseService into registerIpc & MeetingService
│   ├── ipc/
│   │   └── register.ts                          # Register license IPC handlers + enforce FeatureGate on create/add/generate
│   └── services/
│       ├── license/
│       │   ├── canonical-json.ts                # Deterministic JSON serializer for signing/verification
│       │   ├── license-verifier.ts              # Ed25519 signature & payload validator + public key constant
│       │   ├── feature-gate.ts                  # Pure tier -> Entitlements mapper & guard helpers
│       │   └── license-service.ts               # Store persistence, clock-rollback guard, file dialog activation
│       └── meeting-capture/
│           └── meeting-service.ts               # Optional maxDurationSec hook to auto-stop at 900s on Free tier
├── preload/
│   └── index.ts                                 # Expose getLicenseStatus, activateLicenseFile, deactivateLicense, onLicenseChanged
└── renderer/
    ├── components/
    │   └── layout/
    │       └── Header.tsx                       # Display "Enterprise · <orgName>" or "Pro" badge
    └── features/
        └── settings/
            ├── SettingsModal.tsx                # Mount LicenseSection in Settings
            └── LicenseSection.tsx               # License status card, activate/deactivate buttons, tier limits summary

tests/
└── unit/
    └── license/
        ├── license-verifier.test.ts             # Ed25519 valid/tampered/corrupted/schema tests
        ├── feature-gate.test.ts                 # Free/Pro/Enterprise entitlements & guard error codes
        ├── license-service.test.ts              # Persistence, expiry, clock rollback, dialog activation/deactivation
        └── issue-license-cli.test.ts            # CLI keygen + sign -> verifier round-trip test
```

**Structure Decision**: Follows existing Electron `src/shared` + `src/main/services/<domain>` + `src/preload` + `src/renderer/features/<domain>` modular architecture with 100% dependency injection for unit testing without Electron runtime.

## Complexity Tracking

No Constitution violations. Zero third-party dependencies added.
