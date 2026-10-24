# Tasks: Enterprise Offline License & Feature Gate (`enterprise-license`)

**Input**: Design documents from `/specs/20261024-194623-enterprise-license/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/license-ipc.md](./contracts/license-ipc.md)

**Tests**: Required per Constitution Principle IV (Test-First & Coverage Discipline ≥ 80% on business logic).

**Organization**: Tasks are grouped by user story (`US1`, `US2`, `US3`) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]`, `[US2]`, `[US3]`
- Exact file paths are included in every task description.

---

## Phase 1: Setup (Shared Types, Channels & Error Codes)

**Purpose**: Define shared contracts across `main`, `preload`, and `renderer`.

- [x] T001 [P] Add `LicenseTier`, `LicenseFeature`, `LicensePayload`, `LicenseFile`, `Entitlements`, `LicenseState`, `LicenseStatus`, `ActivateLicenseResult`, `"limitReached"` in `MeetingState["endReason"]`, and `RendererApi` methods (`getLicenseStatus`, `activateLicenseFile`, `deactivateLicense`, `onLicenseChanged`) in `src/shared/ipc/types.ts`
- [x] T002 [P] Add `licenseGetStatus`, `licenseActivateFile`, `licenseDeactivate`, and `licenseChanged` to `CHANNELS` and `WHITELISTED_CHANNELS` in `src/shared/ipc/channels.ts`
- [x] T003 [P] Add `licenseLimitNotebooks`, `licenseLimitSources`, `licenseRequireProFormat`, and `licenseRequireProStudio` to `USER_ERROR_CODES` in `src/shared/codes/user-error.ts`
- [x] T004 [P] Add bilingual (`vi` / `en`) translations for license UI labels, badges, and the 4 new `UserErrorCode` messages in `src/shared/i18n/vi.ts` and `src/shared/i18n/en.ts`

---

## Phase 2: Foundational (Core Cryptographic & Entitlement Primitives)

**Purpose**: Pure, zero-Electron-dependency modules for canonical JSON, Ed25519 verification, and tier entitlement calculation that back all User Stories.

- [x] T005 [P] Write unit tests for canonical JSON serialization and Ed25519 signature verification (valid Pro/Enterprise, tampered `seats`/`tier`/`orgName`, invalid schema, corrupted JSON) in `tests/unit/license/license-verifier.test.ts`
- [x] T006 [P] Write unit tests for `FeatureGate` tier matrix (`free`, `pro`, `enterprise`, expired/invalid fallback to `free`, and guard helpers `assertCanCreateNotebook`, `assertCanAddSource`, `assertCanGenerateStudio`) in `tests/unit/license/feature-gate.test.ts`
- [x] T007 Implement `canonicalizePayload` in `src/main/services/license/canonical-json.ts`
- [x] T008 Implement `verifyLicenseFile`, `parseLicenseJson`, and `DEFAULT_PUBLIC_KEY_PEM` in `src/main/services/license/license-verifier.ts` (depends on T007)
- [x] T009 Implement `entitlementsFor`, `createFeatureGate`, and enforcement guard helpers in `src/main/services/license/feature-gate.ts` (depends on T001, T003)

**Checkpoint**: `npm test -- tests/unit/license/license-verifier.test.ts tests/unit/license/feature-gate.test.ts` passes 100%.

---

## Phase 3: User Story 1 - Kích hoạt và xác thực tệp bản quyền `.sclicense` offline (Priority: P1) 🎯 MVP

**Goal**: Allow users and IT admins to activate/deactivate a `.sclicense` file completely offline, persist license state in `electron-store` with a 24h clock-rollback guard, and view tier/organization/seats/expiry in Header and Settings.

**Independent Test**: Run `tests/unit/license/license-service.test.ts` and verify offline activation, deactivation, expiration handling, clock-rollback detection (> 24h), and UI rendering in `SettingsModal` and `Header`.

### Tests for User Story 1 ⚠️

- [x] T010 [P] [US1] Write unit tests for `LicenseService` (`getStatus`, `activateFromDialog`, `activateRawJson`, `deactivate`, expiration transitions, 24h clock-rollback guard, and 64 KB file size cap) in `tests/unit/license/license-service.test.ts`

### Implementation for User Story 1

- [x] T011 [US1] Implement `createLicenseService` in `src/main/services/license/license-service.ts` with `StoreLike` persistence (`license.file`, `license.lastSeenAtMs`), `dialog.showOpenDialog` picker, and `license:changed` broadcaster (depends on T008, T009, T010)
- [x] T012 [P] [US1] Expose `getLicenseStatus`, `activateLicenseFile`, `deactivateLicense`, and `onLicenseChanged` in `src/preload/index.ts` (depends on T001, T002)
- [x] T013 [P] [US1] Implement `SettingsLicenseSection.tsx` component (tier badge, organization name, seats, expiry countdown, free tier limits overview, Activate `.sclicense` button, Deactivate button, error banner) in `src/renderer/features/app-shell/SettingsLicenseSection.tsx` and mount it in `src/renderer/app/SettingsPage.tsx` (depends on T001, T004)
- [x] T014 [P] [US1] Update `src/renderer/features/app-shell/AppHeader.tsx` to subscribe to `getLicenseStatus` / `onLicenseChanged` and render the `Enterprise · <orgName>` or `Pro` badge (depends on T001, T004)

**Checkpoint**: User Story 1 is independently testable via unit tests and UI.

---

## Phase 4: User Story 2 - Phân tầng tính năng Free / Pro / Enterprise (`FeatureGate`) (Priority: P1)

**Goal**: Enforce Free tier limits (max 3 notebooks, max 10 sources/notebook, text/web formats only, 2 Studio formats `summary` + `keyPoints`, max 15m meeting recording with safe auto-stop) in the main process while preserving full read/search/delete access to existing data.

**Independent Test**: Verify `register.ts` and `meeting-service.ts` block restricted actions on Free tier with exact `UserFacingError` codes (`licenseLimitNotebooks`, `licenseLimitSources`, `licenseRequireProFormat`, `licenseRequireProStudio`), auto-stop recordings at `maxMeetingSeconds` (`900`s), and unlock immediately upon activating a Pro/Enterprise license.

### Tests for User Story 2 ⚠️

- [x] T015 [P] [US2] Add main-process IPC enforcement and meeting duration auto-stop tests in `tests/unit/license/feature-gate.test.ts`

### Implementation for User Story 2

- [x] T016 [US2] Add optional `maxDurationSec?: () => number | null` dependency to `MeetingServiceDeps` in `src/main/services/meeting-capture/meeting-service.ts` to auto-stop active recording with `endReason: "limitReached"` when `durationSec(a) >= maxSec`
- [x] T017 [US2] Wire `licenseService` into `src/main/ipc/register.ts` (register `license:getStatus`, `license:activateFile`, `license:deactivate` handlers and enforce `FeatureGate` in `notebookCreate`, `sourceAdd`, and `studioGenerate`) and instantiate `licenseService` in `src/main/index.ts` (depends on T011, T016)

**Checkpoint**: User Stories 1 and 2 work end-to-end with main-process security enforcement.

---

## Phase 5: User Story 3 - Công cụ CLI cấp phát bản quyền cho nhà phát hành (`issue-license.mjs`) (Priority: P2)

**Goal**: Provide a standalone Node.js CLI tool (`scripts/issue-license.mjs`) for Harry (vendor) to generate Ed25519 keypairs (`keygen`) and sign `.sclicense` files (`sign`) for B2B customers.

**Independent Test**: Run `tests/unit/license/issue-license-cli.test.ts` to execute `keygen` and `sign` and verify that `verifyLicenseFile` accepts the generated `.sclicense` file.

### Tests for User Story 3 ⚠️

- [x] T018 [P] [US3] Write round-trip unit test for `scripts/issue-license.mjs` (`keygen` + `sign` → `verifyLicenseFile`) in `tests/unit/license/issue-license-cli.test.ts`

### Implementation for User Story 3

- [x] T019 [US3] Implement `scripts/issue-license.mjs` supporting `keygen --out-dir <dir>` and `sign --private-key <path> --org <name> --tier <pro|enterprise> --seats <n> --days <n|perpetual> --out <file.sclicense>` (depends on T007, T008, T018)

**Checkpoint**: All 3 user stories are complete and tested.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, glossary update, and full verification gate.

- [x] T020 [P] Append `Giấy phép ngoại tuyến` (`Offline License` / `.sclicense`) and `Cổng tính năng` (`Feature Gate`) terms to `docs/00-glossary.md` (per `CLAUDE.md` Rule 5)
- [x] T021 Run `npm run lint`, `npm test`, and `npm run build` to verify zero errors and ≥ 80% coverage across `src/main/services/license/`

---

## Dependencies & Execution Order

- **Phase 1 (T001–T004)**: Parallel setup of shared types, channels, error codes, and i18n strings.
- **Phase 2 (T005–T009)**: Foundational pure crypto/entitlement logic (`canonical-json.ts`, `license-verifier.ts`, `feature-gate.ts`) + unit tests.
- **Phase 3 (T010–T014)**: US1 (`license-service.ts`, preload bridge, `LicenseSection.tsx`, `Header.tsx`).
- **Phase 4 (T015–T017)**: US2 (`meeting-service.ts` duration cap, `register.ts` IPC enforcement, `src/main/index.ts` wiring).
- **Phase 5 (T018–T019)**: US3 (`scripts/issue-license.mjs` CLI + round-trip test).
- **Phase 6 (T020–T021)**: Glossary update and full CI gate (`lint`, `test`, `build`).
