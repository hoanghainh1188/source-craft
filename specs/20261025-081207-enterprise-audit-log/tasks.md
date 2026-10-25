---
description: "Tasks — Nhật ký Kiểm toán & Tuân thủ cho Doanh nghiệp (236)"
---

# Tasks: Nhật ký Kiểm toán & Tuân thủ cho Doanh nghiệp — truy vết truy vấn AI chống giả mạo (236)

**Input**: `specs/20261025-081207-enterprise-audit-log/` (plan, spec, research R1–R21 + R18a, data-model, contracts/audit-record.md · audit-ipc.md · audit-cli.md, quickstart); quyết định `docs/04-decisions/2026-10-25-audit-log-specify.md` (Q1–Q3), `docs/04-decisions/2026-10-25-audit-log-clarify.md` (C1–C5).

**Tests**: BẮT BUỘC (Constitution IV — TDD). Mọi module thuần: viết test TRƯỚC, chạy thấy FAIL, rồi mới code. Coverage ≥ 80% (ngưỡng chung `vitest.config.ts`). Tệp I/O mỏng (`node-audit-fs.ts`, phần keytar thật của `device-key.ts` nếu tách) đưa vào `exclude` của coverage như `app-log/log-fs.ts`.

**Tổ chức**: 3 phase = **3 PR tuần tự**, mỗi PR ship độc lập. **PR A dùng chính branch `236-enterprise-audit-compliance-log`** (mang theo intake / spec / plan / tasks / ADR — rule 3); PR B, C mỗi PR một branch `236-enterprise-audit-compliance-log-prb|prc` cắt từ `main` sau khi PR trước merge (rule 6: sync main; constitution/glossary đổi ⇒ chạy lại `/speckit-analyze`). Mỗi phase kết thúc bằng **cổng review**: code-reviewer → glossary-steward → security-reviewer (BẮT BUỘC ở cả 3 PR — constitution: feature đụng IPC/dữ liệu người dùng) → test gate (`npm run lint && npm run test && npm run build && npx playwright test <e2e của PR>`).

**Quy ước**:

- **Không sửa** (nhánh #238 đang sửa — R20): `src/main/services/rag/rag-service.ts`, `rag/prompt.ts`, `src/main/services/studio/studio-service.ts`, `src/main/services/ai-runtime/**`, `src/main/services/license/feature-gate.ts`, `license-verifier.ts`, `scripts/issue-license.mjs`. Tệp dùng chung (`src/shared/ipc/types.ts`, `channels.ts`, `src/shared/codes/user-error.ts`, `src/shared/i18n/domains/core.ts`, `src/preload/index.ts`) chỉ **append**; gom vào một commit `chore(236): shared types/codes` riêng.
- Không chạy prettier lên `docs/00-glossary.md`, `docs/04-decisions/INDEX.md` (chỉ THÊM dòng bằng script).
- `app-log` chỉ nhận mã/loại lỗi (`ENOSPC`, `EACCES`…) — **không** câu hỏi, câu trả lời, tên tài liệu, đường dẫn.
- Seam `IV_E2E_POLICY_SYSTEM_PATH`, `IV_E2E_AUDIT_KEYSTORE` chỉ có hiệu lực khi `!app.isPackaged` (R18a).
- `[P]` = khác tệp, không phụ thuộc task chưa xong.

---

## Phase 1: PR A — Lõi ghi + móc + fail-closed (User Story 1 P1, User Story 3 P2, User Story 5 P3) 🎯 MVP · 🔒 security-reviewer BẮT BUỘC

**Goal**: policy hệ thống bật + bản quyền `itPolicy` hợp lệ ⇒ mỗi lượt hỏi đáp / Studio có cặp `interaction.start` (ghi + fsync TRƯỚC khi gọi model) / `interaction.end`, mỗi lần xuất có `export.saved`; câu hỏi mã hoá bằng khoá tổ chức; chuỗi băm + chữ ký máy; xoay vòng 5 MB; sự kiện vòng đời; không ghi được ⇒ chặn AI (fail-closed).

**Independent Test**: e2e với policy "hệ thống" (seam) + tier enterprise + máy chủ Ollama giả: 3 câu hỏi + 1 Studio ⇒ 4 cặp bản ghi, giải mã (bằng hàm `decryptQuestion` trong test) ra đúng câu hỏi; thư mục chỉ-đọc ⇒ `auditWriteFailed` và máy chủ giả không nhận request; policy chỉ ở `userData` ⇒ không có tệp audit.

### Setup

- [x] T001 [US1] (TRƯỚC mọi task đặt tên — Constitution "Terminology fidelity") Append thuật ngữ vào `docs/00-glossary.md` (8 dòng ở mục "Thuật ngữ mới" của intake + `interaction.start/end` = "Bản ghi bắt đầu/kết thúc tương tác", `deviceKeyId` = "Định danh khoá ký của máy", `orgKeyId` = "Định danh khoá công khai của tổ chức") bằng script, không prettier.
- [x] T002 [US1] Tạo khung `src/main/services/audit/audit-constants.ts` (`AUDIT_RECORD_VERSION = 1`, `AUDIT_MAX_FILE_BYTES = 5_242_880`, `AUDIT_KEYTAR_SERVICE = "SourceCraft Audit"`, `AUDIT_KEYTAR_ACCOUNT = "device-signing-key"`, `AUDIT_CIPHER_ALG = "x25519-hkdf-sha256-aes256gcm"`, `AUDIT_HKDF_INFO = "sourcecraft-audit-v1"`, `GENESIS_PREV_HASH = "0".repeat(64)`) và `src/main/services/audit/audit-types.ts` (kiểu bản ghi theo data-model §3–§5: `AuditRecordBase`, union `AuditRecordBody` 11 loại, `AuditModel`, `AuditScope`, `EncryptedText`, `AuditCitation`, `InteractionStatus`, `InteractionMeta`, `InteractionOutcome`, `ExportMeta`, `AuditPolicyState`, `AuditPolicyErrorReason`).
- [x] T003 [US1] Thêm fixture khoá cố định cho test `tests/fixtures/audit/keys/` (cặp Ed25519 thiết bị + cặp X25519 tổ chức, PEM, sinh một lần bằng `node:crypto`, kèm `README.md` ghi rõ "chỉ dùng cho test") và helper `tests/unit/audit/helpers.ts` (fs trong bộ nhớ thoả `AuditFs`, keystore trong bộ nhớ thoả `KeytarLike`, clock giả, `randomId` tất định).

### Tests trước (FAIL rồi mới code)

- [x] T004 [P] [US1] Test TRƯỚC `tests/unit/audit/audit-policy.test.ts` cho `parseAuditPolicy(rawText | null)` (`audit-policy.ts`): `null` (không có tệp) ⇒ `notConfigured`; JSON hỏng / `schemaVersion ≠ 1` / thiếu `policyId`/`organization` ⇒ `policyError("unreadableSystemPolicy")`; `enableAuditLogging` thiếu/`false`/không phải boolean ⇒ `notConfigured`; bật + thiếu `auditPublicKey` / PEM hỏng / khoá Ed25519 thay vì X25519 ⇒ `policyError("invalidAuditPublicKey")`; `auditLogDirectory` tương đối / rỗng / không phải chuỗi ⇒ `policyError("invalidAuditLogDirectory")`; hợp lệ ⇒ `configured` với `orgKeyId` = 32 hex đầu SHA-256 SPKI DER, `directory` null khi thiếu.
- [x] T005 [P] [US1] Test TRƯỚC `tests/unit/policy/policy-service.test.ts` (bổ sung case): `getAuditPolicy()` chỉ đọc `systemPath`; tệp `userData` có `enableAuditLogging: true` mà không có tệp hệ thống ⇒ `notConfigured`; tệp hệ thống hỏng + tệp `userData` hợp lệ ⇒ `getAuditPolicy()` = `policyError` **trong khi** `getPolicy()` vẫn trả policy `userData` như cũ (C1 — không đổi hành vi khoá khác); đọc tệp đúng 1 lần (cache).
- [x] T006 [P] [US1] Test TRƯỚC `tests/unit/audit/record-chain.test.ts` cho `hashRecord`, `sealRecord(prev, body, signingKey)`, `verifySealed(record, publicKey)`: hash = SHA-256 hex của JSON chuẩn hoá (tái dùng `license/canonical-json.ts`) bỏ `hash`/`sig`, không phụ thuộc thứ tự khoá đầu vào; `seq` = prev.seq + 1, `prevHash` = prev.hash, bản ghi đầu `seq 0` + `GENESIS_PREV_HASH`; `sig` Ed25519 base64 trên byte UTF-8 của `hash` kiểm được bằng fixture khoá; sửa 1 trường ⇒ `badHash`; đổi `sig` ⇒ `badSignature`; `clockBackwards: true` chỉ khi `ts` < `prev.ts`.
- [x] T007 [P] [US1] Test TRƯỚC `tests/unit/audit/question-cipher.test.ts` cho `encryptQuestion(text, orgPublicKeyPem, aad)` / `decryptQuestion(enc, orgPrivateKeyPem, aad)`: khứ hồi đúng với tiếng Việt có dấu + emoji; `len` = số code point; mỗi lần mã hoá ra `epk`/`nonce` khác nhau; AAD khác (`seq`/`interactionId` khác) ⇒ ném; sửa `ct`/`tag` ⇒ ném; khoá tổ chức khác ⇒ ném + `orgKeyId` không khớp phát hiện được trước khi giải mã; không ghi bản rõ ra đâu.
- [x] T008 [P] [US1] Test TRƯỚC `tests/unit/audit/device-key.test.ts` cho `loadOrCreateDeviceKey(keyStore, lastKnownDeviceKeyId | null)`: keystore rỗng + chưa có chuỗi ⇒ sinh khoá, lưu PKCS8 PEM, `rotation: null`; keystore rỗng + đã có chuỗi ⇒ sinh khoá mới, `rotation: { reason: "keyMissing", previousDeviceKeyId }`; có khoá nhưng `deviceKeyId` ≠ bản ghi cuối ⇒ `rotation: { reason: "keyMismatch" }`; `getPassword`/`setPassword` ném ⇒ trả lỗi `keyUnavailable` (không ném xuyên); `deviceKeyId` = 32 hex đầu SHA-256 SPKI DER.
- [x] T009 [P] [US1] Test TRƯỚC `tests/unit/audit/effective-state.test.ts` cho `computeAuditState({ policy, license, writer })` đủ mọi ô bảng data-model §2: `notConfigured` ⇒ `off`; `policyError` ⇒ `policyError` (bất kể bản quyền); `configured` + (`state ≠ valid` hoặc thiếu `itPolicy`) ⇒ `licenseInactive`; `configured` + bản quyền đủ + writer OK ⇒ `active`; writer lỗi ⇒ `blocked` + `reason`; và `blocksAi(state)` đúng cho `policyError`/`blocked`.
- [x] T010 [P] [US1] Test TRƯỚC `tests/unit/audit/tail.test.ts` cho `parseTail(bytes)` (`tail.ts`): tệp rỗng ⇒ không có đầu chuỗi; dòng hợp lệ cuối ⇒ `{ seq, hash, ts, deviceKeyId }` (deviceKeyId lấy từ `audit.chainStarted`/`audit.keyRotated`/`audit.started` gần nhất); dòng cuối không kết thúc `\n` hoặc không parse được ⇒ `danglingBytes` = độ dài byte UTF-8; `openInteractions(records)` = các `interactionId` có `start` không có `end`; `sawStoppedLast` = bản ghi vòng đời cuối là `audit.stopped`.
- [x] T011 [P] [US1] Test TRƯỚC `tests/unit/audit/rotation.test.ts`: `fileNameFor(seq)` = `audit-000000000000.jsonl` (12 chữ số); `shouldRotate(currentBytes, nextLineBytes)` khi vượt `AUDIT_MAX_FILE_BYTES`; `sortAuditFiles(names)` theo seq trong tên, bỏ tệp không khớp mẫu.
- [x] T012 [P] [US1] Test TRƯỚC `tests/unit/audit/identity.test.ts` cho `resolveIdentity({ userInfo, hostname, env, platform })`: macOS ⇒ username; Windows có `USERDOMAIN ≠ COMPUTERNAME` ⇒ `DOMAIN\user`; `USERDOMAIN = COMPUTERNAME` ⇒ chỉ user; `userInfo` ném ⇒ `env.USER`/`USERNAME` ⇒ `"unknown"`; không ném.
- [x] T013 [P] [US1] Test TRƯỚC `tests/unit/audit/interaction-outcome.test.ts` cho `ragOutcome(result | error, aborted)` và `studioOutcome(result | error)` theo bảng contracts/audit-ipc.md: `reindexing` / `notFound` / `cancelled` (abort hoặc `studioCancelled`) / `error` + `errorCode` (mã `UserFacingError` hoặc tên lớp lỗi, không message) / `completed`; `toAuditCitations(citations, scope, notebookName)` giữ nguyên `chunkId`/`locator`/`sourceTitle`, điền `notebookId`/`notebookName` theo scope (C5).
- [x] T014 [P] [US1] Test TRƯỚC `tests/unit/audit/describe-model.test.ts` cho `categorizeProvider(providerId)` (`describe-model.ts`): `ollama` ⇒ `local`; `lan-ollama`, `lan-openai` ⇒ `lan`; `anthropic`, `openai`, `gemini` ⇒ `online`; id lạ ⇒ `online` (an toàn: coi là rời máy) — kiểm US1 kịch bản 2 ở mức unit cho tới khi LAN AI được nối vào chat (research F2).
- [x] T015 [P] [US1] Test TRƯỚC `tests/unit/audit/audit-writer.test.ts` (fs trong bộ nhớ): append tuần tự — 20 lời gọi song song ⇒ 20 dòng nguyên vẹn, `seq` liên tục; mỗi append gọi fsync; vượt 5 MB ⇒ tệp mới bắt đầu bằng `audit.fileStarted` có `prevFile`, chuỗi nối liền; `append` lỗi (`ENOSPC`) ⇒ promise reject với `errorType`, đầu chuỗi trong bộ nhớ KHÔNG tiến; lần sau thành công nối đúng sau bản ghi cuối đã ghi.
- [x] T016 [P] [US1] Test `tests/unit/audit/audit-writer-perf.test.ts` trên fs thật trong thư mục tạm (`node-audit-fs.ts`): 100 lần ghi `interaction.start` ~1 KB kèm fsync ⇒ p95 ≤ 20 ms (plan › Performance Goals); bỏ qua có điều kiện trên runner CI chậm bằng `IV_PERF_SKIP` và ghi lý do.
- [x] T017 [P] [US1] Test TRƯỚC `tests/unit/audit/audit-service.test.ts` — khởi động `start()`: chưa có tệp ⇒ `audit.chainStarted` + `audit.started` (đủ trường R14); có đuôi dở ⇒ `audit.tailRepaired` trước mọi bản ghi khác; phiên trước không có `audit.stopped` ⇒ `audit.sessionAborted{openInteractions}`; khoá mất ⇒ `audit.keyRotated`; `state` `off`/`licenseInactive` ⇒ không tạo tệp; `start()` không ném (lỗi ⇒ `blocked`).
- [x] T018 [P] [US1] Test TRƯỚC `tests/unit/audit/audit-service-interaction.test.ts` — `runInteraction(meta, run, summarize)`: `active` ⇒ `start` ghi xong TRƯỚC khi `run` được gọi (kiểm thứ tự bằng spy), `end` sau với outcome; ghi `start` lỗi ⇒ ném `UserFacingError("auditWriteFailed")`, `run` KHÔNG được gọi, state `blocked`; `policyError` ⇒ ném `auditPolicyInvalid`, `run` không gọi; khoá không truy cập được ⇒ `auditKeyUnavailable`; `off`/`licenseInactive` ⇒ chỉ gọi `run`, không ghi; `run` ném ⇒ `end{status:"error"}` rồi ném lại đúng lỗi gốc; ghi `end` lỗi ⇒ trả kết quả bình thường, state `blocked`; từ `blocked` ghi lại được ⇒ `audit.recovered{since}` trước `start` mới; `question` là `EncryptedText` với AAD `"<seq>|<interactionId>"`; `interaction.start` có `osUser` + `host` (FR-009); chuỗi câu trả lời giả KHÔNG xuất hiện trong bất kỳ bản ghi nào (FR-012); bản quyền đổi giữa hai lượt (không qua `license:changed`) ⇒ lượt sau theo trạng thái mới (FR-002); Studio không phải `custom` ⇒ không có `question`.
- [x] T019 [P] [US1] Test TRƯỚC `tests/unit/audit/audit-service-lifecycle.test.ts` — `reevaluate()` khi bản quyền mất hiệu lực ⇒ `audit.stopped{licenseInactive}` rồi state `licenseInactive`; có lại ⇒ `audit.started`; `stop("appQuit")` khi còn tương tác mở ⇒ ghi `interaction.end{cancelled}` cho từng tương tác TRƯỚC `audit.stopped{appQuit}`, và `run()` kết thúc muộn sau đó không ghi thêm `end` (R6a); gọi 2 lần không ghi 2 lần; `onStatusChange` chỉ phát khi `state`/`reason` đổi.
- [x] T020 [P] [US5] Test TRƯỚC `tests/unit/audit/audit-service-export.test.ts` — `recordExport({ format, notebookId, studioKind?, fileName })`: `active` ⇒ `export.saved` với `notebookName` tra từ dep (không tin tên từ renderer), `fileName` chỉ basename (đường dẫn đầy đủ bị cắt), kiểu `studioKind` lạ ⇒ bỏ trường; `off` ⇒ không ghi; ghi lỗi ⇒ không ném, state `blocked`.
- [x] T021 [P] [US1] Test TRƯỚC `tests/unit/audit/test-seams.test.ts` cho `readAuditTestSeams({ isPackaged, env })`: packaged ⇒ luôn `{}` dù có biến; dev ⇒ `systemPolicyPath` từ `IV_E2E_POLICY_SYSTEM_PATH`, `memoryKeystore: true` khi `IV_E2E_AUDIT_KEYSTORE === "memory"`, giá trị lạ ⇒ bỏ qua.
- [x] T022 [P] [US1] Test hồi quy `tests/unit/vault-backup-snapshot.test.ts` và `tests/unit/vault-backup-swap.test.ts` (bổ sung case): thư mục `audit/` trong `dataDir` KHÔNG được sao chép vào snapshot và KHÔNG bị rename/thay khi khôi phục (FR-021, research F5).
- [x] T023 [P] [US1] Test hồi quy `tests/unit/crash-report-build.test.ts` (bổ sung case, FR-022): báo lỗi chỉ đọc thư mục `logs/` (không bao giờ đọc thư mục audit, kể cả khi `auditLogDirectory` nằm trong `userData`); dòng `audit.writeFailed` trong `main.log` chỉ có `errorType`, không có câu hỏi/tên tài liệu/đường dẫn.

### Module thuần (sau test tương ứng)

- [x] T024 [P] [US1] Cài `parseAuditPolicy` trong `src/main/services/audit/audit-policy.ts` (dùng `createPublicKey` + `asymmetricKeyType === "x25519"`, `path.isAbsolute`) cho T004 xanh.
- [x] T025 [US1] Thêm `getAuditPolicy()` vào `src/main/services/policy/policy-service.ts`: đọc riêng `systemPath` một lần (tách khỏi `loadPolicy`), gọi `parseAuditPolicy`, log `policy.auditLoaded` / `policy.auditError` chỉ kèm `reason`; `systemPath` tiếp tục tiêm được qua `PolicyServiceDeps` (T005 xanh; không đổi `parseEnterprisePolicyJson`).
- [x] T026 [P] [US1] Cài `src/main/services/audit/record-chain.ts` (T006).
- [x] T027 [P] [US1] Cài `src/main/services/audit/question-cipher.ts` (`generateKeyPairSync("x25519")`, `diffieHellman`, `hkdfSync("sha256", shared, epkDer, AUDIT_HKDF_INFO, 32)`, `aes-256-gcm` + `setAAD`) (T007).
- [x] T028 [P] [US1] Cài `src/main/services/audit/device-key.ts` trên `KeytarLike` (tái dùng interface trong `ai-runtime/online/secret-store.ts` — chỉ import kiểu, không sửa tệp đó) (T008).
- [x] T029 [P] [US1] Cài `src/main/services/audit/effective-state.ts` (T009).
- [x] T030 [P] [US1] Cài `src/main/services/audit/tail.ts` (T010).
- [x] T031 [P] [US1] Cài `src/main/services/audit/rotation.ts` (T011).
- [x] T032 [P] [US1] Cài `src/main/services/audit/identity.ts` (T012).
- [x] T033 [P] [US1] Cài `src/main/services/audit/interaction-outcome.ts` (T013).
- [x] T034 [P] [US1] Cài `src/main/services/audit/describe-model.ts` (T014).
- [x] T035 [P] [US1] Cài `src/main/services/audit/test-seams.ts` (T021).

### Writer + service

- [x] T036 [US1] Định nghĩa `AuditFs` và cài `src/main/services/audit/audit-writer.ts` (hàng đợi Promise tuần tự, `sealRecord` + append + fsync, xoay vòng qua `rotation.ts`, đầu chuỗi chỉ tiến sau khi ghi thành công) cho T015 xanh.
- [x] T037 [US1] Cài `src/main/services/audit/node-audit-fs.ts` (I/O mỏng: `mkdirSync({recursive})`, `openSync("a")` + `writeSync` + `fsyncSync` + `closeSync`, đọc 64 KB cuối tệp hiện hành, `readdirSync`, `statSync`); thêm vào `exclude` coverage trong `vitest.config.ts`.
- [x] T038 [US1] Cài `src/main/services/audit/audit-service.ts` — `createAuditService(deps)` với `status`, `onStatusChange`, `start`, `runInteraction`, `reevaluate`, `stop` theo contracts/audit-ipc.md; mọi lỗi I/O ⇒ `logEvent("audit.writeFailed", { errorType })` (không nội dung) (T017, T018, T019 xanh).
- [x] T039 [US5] Thêm `recordExport` vào `src/main/services/audit/audit-service.ts` (T020 xanh).

### Dùng chung (commit `chore(236): shared types/codes` riêng)

- [x] T040 [US1] Append vào `src/shared/codes/user-error.ts` 3 mã `auditWriteFailed`, `auditPolicyInvalid`, `auditKeyUnavailable`; append vi/en vào `src/shared/i18n/domains/core.ts` theo thông điệp nháp trong contracts/audit-ipc.md (vi là nguồn, en tương đương).
- [x] T041 [US1] Append vào `src/shared/ipc/types.ts`: `AuditState`, `AuditStatus` (data-model §2); thêm `notebookId?: string` và `studioKind?: StudioKind` vào cuối `StudioExportInput`.

### Nối dây main

- [x] T042 [US1] `src/main/index.ts`: dựng `AuditService` sau `licenseService` + `policyService` — deps: `policy: () => policyService.getAuditPolicy()` (policy service nhận `systemPath` từ seam T035 khi dev), `license: () => ({ valid: licenseService.getStatus().state === "valid", itPolicy: licenseService.gate.hasFeature("itPolicy"), licenseId })`, `keyStore` (keytar thật qua `keytar-loader` sẵn có, hoặc keystore bộ nhớ khi seam `memory`), `identity` (T032), `appVersion`, `notebookName(id)` qua `notebookRepo`, `defaultDirectory: join(dataDir.path, "audit")`, `describeModel(target)` (research R2: `categorizeProvider(pickProvider(target).id)` từ `describe-model.ts`; model từ model-selection / cấu hình online; không sửa `ai-runtime/*`); gọi `await audit.start()` trước khi tạo cửa sổ; `audit.reevaluate()` ngay sau chỗ phát `CHANNELS.licenseChanged`; `audit.stop("appQuit")` trong `before-quit` (đồng bộ ngắn, không chặn thoát quá 1 s).
- [x] T043 [US1] `src/main/ipc/register.ts`: nhận `audit` qua deps; bọc `CHANNELS.ragAsk` — sau `assertRagScopeAllowed`, gọi `audit.runInteraction({ channel: "rag", scope, question, model: describeModel(target) }, () => ragServices[target].ask(askInput), ragOutcome)`; bọc `CHANNELS.ragAskStream` tương tự, outcome dùng `controller.signal.aborted`; giữ nguyên `rethrowForIpc` cho lỗi provider (lỗi audit là `UserFacingError`, đi qua nguyên vẹn).
- [x] T044 [US1] `src/main/ipc/register.ts`: bọc `CHANNELS.studioGenerate` sau `assertCanGenerateStudio` với `{ channel: "studio", studioKind, sourceScope, question: customPrompt (chỉ khi kind custom), model }`, outcome `studioOutcome`; không đổi registry huỷ/stream hiện có.
- [x] T045 [US5] `src/main/ipc/register.ts`: trong `CHANNELS.studioExport`, sau `exportFormattedDocument` trả `saved: true` ⇒ `await audit.recordExport({ format, notebookId, studioKind, fileName: basename(path) })` (kiểm kiểu `notebookId`/`studioKind` từ input không tin cậy).
- [x] T046 [P] [US5] Renderer gửi `notebookId` + `studioKind` khi xuất: `src/renderer/features/studio/StudioResultCard.tsx`; gửi `notebookId` (không `studioKind`) ở `src/renderer/features/rag-qa/MessageBubble.tsx`.

### E2E + tài liệu PR A

- [x] T047 [US1] Fixture e2e `tests/fixtures/audit/policy/` (tệp policy hợp lệ với khoá X25519 test, tệp hỏng, tệp chỉ đặt ở `userData`) và helper `launchAudit(opts)` trong `tests/e2e/helper.ts` (đặt `IV_E2E_POLICY_SYSTEM_PATH`, `IV_E2E_AUDIT_KEYSTORE=memory`, tier, `auditLogDirectory` tạm; máy chủ Ollama giả `http.createServer` theo mẫu `tests/e2e/studio-*.spec.ts`, đếm số request).
- [x] T048 [US1] `tests/e2e/audit-log.spec.ts`: (a) 3 câu hỏi (một ở scope toàn cục) + 1 Studio `custom` + 1 lần dừng stream ⇒ đúng các cặp `start/end`, trạng thái `cancelled` ở lượt dừng, `question` giải mã được bằng `decryptQuestion` + khoá test; (b) policy chỉ ở `userData` ⇒ không có tệp audit (FR-005); (c) policy hệ thống hỏng ⇒ hỏi bị chặn `auditPolicyInvalid`, máy chủ giả 0 request; (d) `auditLogDirectory` chỉ-đọc ⇒ `auditWriteFailed`, máy chủ giả 0 request (FR-016); trả quyền ⇒ hỏi chạy, có `audit.recovered`; (e) tier `free` ⇒ AI chạy, không có tệp; (e2) chuỗi câu trả lời của máy chủ giả không có trong tệp audit (FR-012); "Xoá lịch sử chat" ⇒ tệp audit không đổi (FR-021); (f) xuất Studio ⇒ `export.saved`; (g) so thời gian tới token đầu bật/tắt audit trên 20 lượt ⇒ chênh trung vị ≤ 50 ms (SC-005).
- [x] T049 [US3] Bổ sung `tests/e2e/audit-log.spec.ts`: khởi động ⇒ `audit.started`; thoát bình thường ⇒ `audit.stopped{appQuit}`; giết tiến trình giữa một lượt (máy chủ giả treo) rồi mở lại ⇒ `audit.sessionAborted` chứa đúng `interactionId`.
- [x] T050 [US1] Mở rộng `tests/e2e/no-egress.spec.ts`: chạy lại kịch bản không-egress với audit bật (policy seam + tier enterprise) ⇒ không có kết nối mạng mới nào ngoài máy chủ Ollama giả cục bộ (SC-006).
- [x] T051 [US1] ADR thực thi `docs/04-decisions/2026-10-25-audit-log.md` (+1 dòng `INDEX.md`): định dạng v1, thuật toán (R3–R5), write-ahead/fail-closed, vị trí, seam test, giới hạn đã biết (admin cục bộ + keychain; ổ mạng chậm), phát hiện F2 (LAN AI chưa nối chat — theo dõi ở phiên/issue riêng).
- [X] T052 [US1] Cổng review PR A: code-reviewer → glossary-steward → **security-reviewer** (khoá, crypto, fail-closed, không log nội dung, seam bị vô hiệu ở packaged) → `npm run lint && npm run test && npm run build && npx playwright test tests/e2e/audit-log.spec.ts`; coverage `src/main/services/audit/**` ≥ 80%.

**Checkpoint**: PR A merge được độc lập — tổ chức đã có nhật ký chống giả mạo, đọc được bằng chính test helper; chưa có CLI và chỉ báo (spec chấp nhận vì US2/US4 là các lát cắt riêng).

---

## Phase 2: PR B — Công cụ IT bằng dòng lệnh (User Story 2 P1) · 🔒 security-reviewer BẮT BUỘC

**Goal**: IT chạy `SourceCraft --audit-verify | --audit-decrypt | --audit-keygen` trên máy không mạng, nhận kết quả nguyên vẹn/bị can thiệp có vị trí, giải mã câu hỏi bằng khoá bí mật tổ chức, sinh cặp khoá tổ chức.

**Independent Test**: thư mục do PR A sinh ⇒ `--audit-verify` mã thoát 0; 6 fixture can thiệp ⇒ mã 1 và đúng `firstFailure`; `--audit-decrypt` ra đúng câu hỏi; `--audit-keygen` ra khoá dùng được ngay trong policy.

### Fixture + tests trước

- [ ] T053 [US2] Script dev `tests/fixtures/audit/build-fixtures.ts` (chạy qua vitest helper, không vào app) dùng `audit-writer` + fs bộ nhớ sinh thư mục chuẩn 50 bản ghi qua 2 tệp xoay vòng, rồi các biến thể `tampered-edit-char/`, `tampered-delete-line/`, `tampered-insert-line/`, `tampered-swap-lines/`, `tampered-missing-file/`, `rotated-key/`, `tail-repaired/`, `open-interaction/` dưới `tests/fixtures/audit/`.
- [ ] T054 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/cli-args.test.ts` cho `parseAuditCliArgs(argv)`: không có cờ `--audit-*`/`--help-audit` ⇒ `null` (app chạy bình thường, kể cả argv của Electron/Playwright); mỗi lệnh với tham số bắt buộc/tuỳ chọn ở contracts/audit-cli.md; thiếu `--out` ở decrypt, thiếu `--org-key`, hai lệnh cùng lúc, `--lang` lạ ⇒ `usageError`.
- [ ] T055 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/verify.test.ts` cho `verifyAuditDir(fs, dir, opts)` trên fixture T053: chuẩn ⇒ `intact` + đủ trường `AuditVerifyReport`; mỗi biến thể can thiệp ⇒ `tampered` với `kind` đúng (`badHash`, `seqGap`, `badSignature`/`brokenChain`, `seqOrder`, `missingFile`) và `file`/`line`/`seq`; `rotated-key` ⇒ `intact` + cảnh báo `keyRotated`; `tail-repaired` ⇒ `intact` + cảnh báo; `open-interaction` ⇒ `intact` + cảnh báo `openInteraction`; `--expect-device-key` khác ⇒ `unexpectedDeviceKey`; tệp đầu là `audit.fileStarted` ⇒ cảnh báo `startsAfterZero`.
- [ ] T056 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/verify-perf.test.ts`: 10 000 bản ghi sinh trong bộ nhớ ⇒ `verifyAuditDir` < 10 s (SC-004).
- [ ] T057 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/decrypt.test.ts` cho `decryptAuditDir`: mỗi `interaction.start` có `question` ⇒ dòng ra có thêm `questionText` đúng; `orgKeyId` khác ⇒ lỗi I/O-khoá (mã 3); nhật ký bị can thiệp ⇒ vẫn giải mã + dòng cảnh báo đầu; không hàm nào ghi vào thư mục nhật ký.
- [ ] T058 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/keygen.test.ts` cho `generateOrgKeyPair()`: khoá X25519 PEM hợp lệ với `parseAuditPolicy` (T024); `orgKeyId` khớp; đoạn JSON `"auditPublicKey"` thoát `\n` đúng; `writeKeyFiles` từ chối ghi đè tệp đã có (mã 2).
- [ ] T059 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/report-text.test.ts`: báo cáo chữ vi + en cho `intact` có cảnh báo và `tampered`, đúng mẫu ở contracts/audit-cli.md; không in nội dung câu hỏi.
- [ ] T060 [P] [US2] Test TRƯỚC `tests/unit/audit/cli/run-cli.test.ts` cho `runAuditCli(cmd, deps)`: mã thoát 0/1/2/3 theo contract; `--json` in `AuditVerifyReport`; `--out` ghi tệp; decrypt không bao giờ ghi `questionText` ra stdout; khoá bí mật không được ghi lại ở đâu (spy fs).

### Cài đặt

- [ ] T061 [P] [US2] Cài `src/main/services/audit/cli/cli-args.ts` (T054).
- [ ] T062 [US2] Cài `src/main/services/audit/cli/verify.ts` tái dùng `record-chain.ts`, `rotation.ts`, `tail.ts` (T055, T056).
- [ ] T063 [P] [US2] Cài `src/main/services/audit/cli/decrypt.ts` tái dùng `question-cipher.ts` (T057).
- [ ] T064 [P] [US2] Cài `src/main/services/audit/cli/keygen.ts` (quyền 0600 cho khoá bí mật trên POSIX) (T058).
- [ ] T065 [P] [US2] Cài `src/main/services/audit/cli/report-text.ts` (chuỗi vi/en cục bộ của CLI — không dùng i18n renderer) (T059).
- [ ] T066 [US2] Cài `src/main/services/audit/cli/run-cli.ts` (T060).
- [ ] T067 [US2] `src/main/index.ts`: ngay đầu tệp (trước `resolveLegacyUserDataPath` và `requestSingleInstanceLock`) gọi `parseAuditCliArgs(process.argv)`; có lệnh ⇒ không giành lock, không `setPath`, không tạo cửa sổ/DB/log sink; `app.whenReady().then(() => runAuditCli(...)).then(code => app.exit(code))`; `usageError` ⇒ in hướng dẫn + `app.exit(2)`. Kiểm tay: app mở bình thường khi không có cờ.
- [ ] T068 [US2] `tests/e2e/audit-cli.spec.ts`: chạy binary Electron dev với `--audit-verify <fixture chuẩn> --json --out <tmp>` ⇒ mã 0 + JSON hợp lệ; với `tampered-edit-char` ⇒ mã 1; không tạo `userData` mới (kiểm thư mục `--user-data-dir` tạm vẫn rỗng).
- [ ] T069 [US2] Cổng review PR B: code-reviewer → glossary-steward → **security-reviewer** (khoá bí mật chỉ trong bộ nhớ, không ghi/sửa nhật ký, rẽ nhánh trước lock không mở bề mặt mới) → test gate + `npx playwright test tests/e2e/audit-cli.spec.ts`.

**Checkpoint**: IT tự kiểm tra và giải mã được nhật ký PR A sinh ra.

---

## Phase 3: PR C — Minh bạch với người dùng (User Story 4 P2) + tài liệu triển khai · 🔒 security-reviewer BẮT BUỘC (phạm vi 2 kênh chỉ đọc)

**Goal**: chip "Đang ghi nhật ký kiểm toán" cạnh huy hiệu riêng tư khi `active`/`blocked`; Cài đặt › Chính sách tổ chức hiển thị trạng thái, lý do, tổ chức, thư mục (chỉ đọc); cập nhật ngay khi bản quyền đổi; vi/en; tài liệu triển khai cho IT.

**Independent Test**: bật audit ⇒ chip hiện; tier free ⇒ không chip, Cài đặt báo cần Enterprise; policy hỏng ⇒ Cài đặt báo lỗi chính sách; đổi ngôn ngữ ⇒ nhãn đổi; không có điều khiển tắt.

- [ ] T070 [P] [US4] Test TRƯỚC `tests/unit/audit/audit-status-label.test.ts` cho `auditStatusLabel(status)` (`src/renderer/features/audit-status/audit-status-label.ts`): mỗi `state` × `reason` ⇒ khoá i18n đúng; `showChip` chỉ `active`/`blocked`; `off` ⇒ không hiện mục trong Cài đặt trừ khi có `organization`.
- [ ] T071 [US4] Append `audit:getStatus`, `audit:statusChanged` vào `src/shared/ipc/channels.ts`; preload `window.api.auditGetStatus()` / `window.api.onAuditStatusChanged(cb)` trong `src/preload/index.ts` (whitelist, trả hàm huỷ); handler `audit:getStatus` (map `AuditPolicyState.directory` ⇒ `directoryKind`, KHÔNG gửi đường dẫn) + push `audit:statusChanged` tới mọi cửa sổ khi `audit.onStatusChange` phát, trong `src/main/ipc/register.ts`; cập nhật test whitelist IPC hiện có nếu có danh sách kênh.
- [ ] T072 [US4] Tạo domain i18n `src/shared/i18n/domains/audit.ts` (`auditVi` as const, `auditEn: Widen<typeof auditVi>`): nhãn chip, tooltip ("Tổ chức của bạn bật ghi nhật ký kiểm toán: câu hỏi gửi AI, mô hình và tài liệu được trích dẫn được ghi lại trên máy này. Câu trả lời không được ghi."), các trạng thái/lý do Cài đặt; đăng ký vào `src/shared/i18n/vi.ts`, `en.ts`.
- [ ] T073 [US4] Cài `audit-status-label.ts` (T070) và `src/renderer/features/audit-status/useAuditStatus.ts` (theo mẫu `PrivacyBadge.tsx`: `useState` + `useEffect` gọi `window.api.auditGetStatus()` một lần rồi đăng ký `window.api.onAuditStatusChanged`, huỷ khi unmount — renderer hiện không dùng TanStack Query).
- [ ] T074 [US4] `src/renderer/features/audit-status/AuditStatusChip.tsx` + `audit-status.css` (token màu có sẵn, focus-visible, tooltip truy cập được bằng bàn phím, `prefers-reduced-motion`); gắn cạnh `PrivacyBadge` trong `src/renderer/features/app-shell/AppHeader.tsx`; trạng thái `blocked` dùng màu cảnh báo + nhãn "Nhật ký kiểm toán lỗi — AI tạm khoá".
- [ ] T075 [US4] `src/renderer/features/audit-status/AuditSettingsSection.tsx` (chỉ đọc: trạng thái, lý do, tổ chức, nhãn vị trí "Mặc định" / "Do bộ phận IT chỉ định" theo `directoryKind` — không hiển thị đường dẫn, "Do bộ phận IT quản lý" — không nút) gắn vào `src/renderer/app/SettingsPage.tsx` cạnh `SettingsLicenseSection` / `SettingsLanAiSection`.
- [ ] T076 [US4] Mở rộng `tests/e2e/audit-log.spec.ts`: chip hiện/ẩn theo `active`/`free`/`policyError`; Cài đặt hiển thị đúng lý do; đổi ngôn ngữ vi↔en ⇒ nhãn đổi; không có control nào (`button`/`input`) trong `AuditSettingsSection`; kiểm `axe` cho header + mục Cài đặt nếu bộ e2e a11y hiện có hỗ trợ.
- [ ] T077 [US4] Cập nhật `docs/enterprise-deployment-guide.md`: mục mới "Nhật ký kiểm toán" — 3 khoá policy + ví dụ (contracts/audit-ipc.md), vị trí mặc định/chỉ định, khuyến nghị thư mục khoá quyền chỉ-ghi-thêm, quy trình `--audit-keygen` (giữ khoá bí mật ngoài máy nhân viên), đăng ký `deviceKeyId` lúc triển khai, `--audit-verify`/`--audit-decrypt`, Windows `start /wait` + `--out`, hành vi fail-closed và cách xử lý từng mã lỗi.
- [ ] T078 [US4] Cổng review PR C: code-reviewer → glossary-steward → **security-reviewer** (bắt buộc — constitution: feature đụng IPC; phạm vi 2 kênh chỉ đọc, không lộ đường dẫn) → test gate + `npx playwright test tests/e2e/audit-log.spec.ts`; ảnh chụp header + Cài đặt ở 1024/1440, sáng/tối (rule web testing).

**Checkpoint**: đủ US1–US5; feature hoàn chỉnh.

---

## Phase 4: Polish & phát hành (sau khi PR C merge)

- [ ] T079 Chạy toàn bộ checklist tay [quickstart.md](./quickstart.md) trên bản đóng gói macOS + Windows (`npm run build` → electron-builder), ghi kết quả vào ADR T051 (mục "Kiểm tay").
- [ ] T080 [P] Đề xuất PR constitution riêng (steward, rule 5): Principle III ngoại lệ có kiểm soát cho nhật ký kiểm toán; Principle I yêu cầu chỉ báo khi tổ chức bật ghi (plan › Complexity Tracking) — chỉ mở PR, không chờ merge.
- [ ] T081 [P] Đóng các mục trong `specs/20261025-081207-enterprise-audit-log/checklists/requirements.md` nếu analyze/review phát sinh thay đổi; cập nhật tick trong tasks.md.

---

## Dependencies & Execution Order

- **Giữa phase (tuần tự)**: PR A → PR B → PR C → Polish. PR B cần `record-chain`, `question-cipher`, `rotation`, `tail`, `audit-writer` (sinh fixture) của A. PR C cần `AuditService.onStatusChange` của A; độc lập với B (có thể đổi thứ tự B ↔ C nếu cần chỉ báo sớm).
- **Trong PR A**: T001 (glossary — TRƯỚC mọi task đặt tên) → T002–T003 → test (T004–T023, trừ T016) → module thuần (T024–T035) → T036 → T037 → T016 (perf, cần fs thật) → T038 → T039 → shared (T040–T041) → T042 → T043–T045 → T046 → T047 → T048–T050 → T051 → T052. T025 sau T024; T038 sau T026–T036; T042 sau T025 + T034 + T038 + T040 + T041.
- **Trong PR B**: T053 → T054–T060 → T061–T066 → T067 → T068 → T069.
- **Trong PR C**: T070 → T071 → T072 → T073 → T074–T075 → T076 → T077 → T078.
- US5 (T020, T039, T045, T046) chỉ cần T038 — làm song song được với T043–T044.
- US3 (T017, T019, T049) nằm trong service lõi, không tách PR.
- US1 kịch bản 2 (LAN AI): kiểm ở mức unit bằng T014; e2e chỉ thêm được sau khi phiên "Nối LAN AI vào registry chat" merge (research F2).

## Parallel Opportunities

- **PR A**: T004–T023 song song (khác tệp test; T016 chờ T037); T024, T026–T035 song song (khác tệp module); T046 ‖ T043–T045; T050 ‖ T051.
- **PR B**: T054–T060 song song; T061, T063–T065 song song.
- **PR C**: T070 ‖ T071 ‖ T072; T074 ‖ T075.

Ví dụ PR A: chạy cùng lúc "test cipher" (T007), "test tail" (T010), "test identity" (T012), "test describe-model" (T014) — khác tệp, không phụ thuộc.

## Implementation Strategy

- **MVP = PR A (US1 + US3 + US5)**: bản ghi chống giả mạo, write-ahead, fail-closed, vòng đời, xuất — đã giao giá trị tuân thủ cốt lõi; IT tạm kiểm bằng test helper cho tới PR B.
- Mỗi PR: TDD → cổng review → test gate → merge → cắt branch PR kế từ `main` mới (sync, kiểm drift #238 ở `register.ts` / `types.ts`).
- Phát hành MỘT lần sau PR C (T079), sau checklist tay trên cả hai nền tảng.
