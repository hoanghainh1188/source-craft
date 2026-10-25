# Implementation Plan: Nhật ký Kiểm toán & Tuân thủ cho Doanh nghiệp — truy vết truy vấn AI chống giả mạo

**Branch**: `236-enterprise-audit-compliance-log` | **Date**: 2026-10-25 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/20261025-081207-enterprise-audit-log/spec.md`; quyết định `docs/04-decisions/2026-10-25-audit-log-specify.md` (Q1–Q3) và `docs/04-decisions/2026-10-25-audit-log-clarify.md` (C1–C5); intake `docs/intake/236-enterprise-audit-compliance-log.md`; kế thừa 226 (bản quyền, `FeatureGate`), 228 (policy, LAN AI), 231 (tìm toàn cục), 232 (xuất), 027 (lịch sử chat), 085 (sao lưu), 088 (nhật ký chẩn đoán), 098 (AI cục bộ sau lỗi online), 103 (chỉ báo riêng tư), 123 (i18n).

## Summary

Thêm `src/main/services/audit/`: một **`AuditService`** ghi chuỗi bản ghi JSON Lines tại thư mục nhật ký (mặc định `<userData>/audit/`, policy hệ thống chỉ định được), mỗi bản ghi nối **chuỗi băm SHA-256** và được **ký Ed25519** bằng khoá riêng của máy trong keychain; câu hỏi được **mã hoá lai X25519 + AES-256-GCM** bằng khoá công khai của tổ chức. Móc ở **tầng handler IPC** (`rag:ask`, `rag:askStream`, `studio:generate`, `studio:export`) theo kiểu **write-ahead, fail-closed**: bản ghi `interaction.start` phải fsync xong mới được gọi model (kể cả bước viết lại truy vấn). Hiệu lực = policy **hệ thống** bật + bản quyền hợp lệ có `itPolicy`, đánh giá mỗi lượt. Renderer chỉ đọc trạng thái (chip ở header + mục Cài đặt). IT dùng **chế độ dòng lệnh của chính app** để kiểm tra toàn vẹn, giải mã câu hỏi, sinh khoá tổ chức.

Giao **3 PR tuần tự**, mỗi PR ship được:

1. **PR A — Lõi ghi + móc + fail-closed** (US1, US3, FR-001–FR-019b, FR-021–FR-022): `audit-policy`, chuỗi/ký/mã hoá, writer + xoay vòng + sửa đuôi, máy trạng thái, móc RAG/Studio/xuất, mã lỗi, seam e2e, ADR thực thi. **security-reviewer bắt buộc.**
2. **PR B — Công cụ IT (CLI)** (US2, FR-020, FR-020b, FR-010b): `--audit-verify`, `--audit-decrypt`, `--audit-keygen`, rẽ nhánh trước single-instance lock, tài liệu triển khai. **security-reviewer bắt buộc** (xử lý khoá bí mật).
3. **PR C — Minh bạch** (US4, FR-004, FR-006, FR-023–FR-025): kênh `audit:getStatus`/`audit:statusChanged`, chip header, mục Cài đặt, i18n, cập nhật `docs/enterprise-deployment-guide.md`. **security-reviewer bắt buộc** (constitution: mọi feature đụng IPC) — phạm vi: 2 kênh chỉ đọc.

Không đổi: `rag-service.ts`, `studio-service.ts`, `rag/prompt.ts`, `ai-runtime/*`, `feature-gate.ts`, `license-verifier.ts`, `scripts/issue-license.mjs` (nhánh #238 đang sửa — R20), thuật toán RAG/Studio, `PrivacyState`, migration SQLite (không có).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Electron 43 (Node 24 — `node:crypto` có Ed25519, X25519, HKDF, AES-GCM), React 18.

**Primary Dependencies**: có sẵn — `node:crypto`, `keytar` ^7.9 (qua `KeytarLike`), `electron-store`. **Không thêm dependency.** Tái dùng `license/canonical-json.ts`.

**Storage**: tệp JSON Lines `audit-<seq>.jsonl` trong thư mục nhật ký (xoay 5 MB, không xoá); khoá ký máy trong keychain (service `SourceCraft Audit`). Không SQLite, không electron-store. Chi tiết [data-model.md](./data-model.md).

**Testing**: vitest TDD cho mọi hàm thuần (bảng ở Constitution Check); fs/keytar/crypto tiêm vào; Playwright e2e với máy chủ Ollama giả (`http.createServer`, như `studio-*.spec.ts`) + seam `IV_E2E_POLICY_SYSTEM_PATH`, `IV_E2E_AUDIT_KEYSTORE=memory` (chỉ bản chưa đóng gói — R18a); smoke một lần chạy CLI; checklist tay [quickstart.md](./quickstart.md).

**Target Platform**: macOS arm64 + Windows x64.

**Project Type**: desktop-app (Electron main / preload / renderer) + chế độ dòng lệnh headless của cùng binary.

**Performance Goals**: ghi `interaction.start` (append + fsync, ~1 KB) p95 ≤ 20 ms trên SSD; thời gian tới token đầu tăng ≤ 50 ms (SC-005); kiểm tra 10 000 bản ghi < 10 s (SC-004).

**Constraints**: 0 egress mới (SC-006); không log nội dung câu hỏi/câu trả lời vào `app-log`; câu trả lời không bao giờ vào nhật ký (FR-012); khoá bí mật tổ chức không bao giờ trên máy nhân viên; renderer không có kênh ghi/xoá; seam test vô hiệu ở bản đóng gói; Windows GUI không có console (CLI hỗ trợ `--out`).

**Scale/Scope**: vài–vài chục tương tác/giờ/người; ~1–2 KB/bản ghi ⇒ 5 MB ≈ 3–5 nghìn bản ghi/tệp; một tiến trình ghi (single-instance lock).

Không còn NEEDS CLARIFICATION ([research.md](./research.md) R1–R21).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Nguyên tắc                     | Đánh giá                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sau Phase 1 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| I. Local-first                 | Nhật ký chỉ ghi cục bộ (thư mục mặc định hoặc thư mục IT chỉ định — có thể là ổ mạng nội bộ do chính tổ chức quản lý; app không mở kết nối mạng, chỉ ghi tệp qua OS); không đính vào báo lỗi (093) / gói chẩn đoán; CLI không mạng. Chỉ báo đúng thực tế: chip audit tách khỏi `PrivacyState` (R12). Ghi provider online như "online" (R2).                                                                                                                                                                        | ✅          |
| II. Verifiable Citations       | Trích dẫn trong nhật ký là **bản sao nguyên** `Citation` đã hậu kiểm (cùng `chunkId`/`locator`) — không tái tạo locator; Studio dùng `StudioResult.citations`.                                                                                                                                                                                                                                                                                                                                                     | ✅          |
| III. Desktop Security Boundary | FS, keychain, crypto chỉ ở main; renderer chỉ có `audit:getStatus` + push (whitelist, không payload nhạy cảm, không ghi/xoá). Khoá ký trong keytar (không plaintext). Nhật ký **không chứa nội dung tài liệu** (chỉ tên nguồn/sổ tay + locator) và câu hỏi được mã hoá ⇒ không vi phạm "MUST NOT log nội dung tài liệu" (R21); `app-log` chỉ nhận mã lỗi. CLI headless không mở cửa sổ, không đọc vault. **security-reviewer PR A, B.**                                                                            | ✅ contract |
| IV. Test-First & Coverage      | TDD cho: `canonical`/`record-chain` (hash, sign, verify), `question-cipher` (encrypt/decrypt, AAD sai ⇒ lỗi), `audit-policy` (chỉ hệ thống, mọi lý do lỗi), `effective-state` (bảng §2 data-model), `tail-repair`, `rotation`, `interaction-outcome` (ánh xạ status), `identity`, `cli-args`, `verify` (mọi `AuditVerifyFailureKind` + cảnh báo), `decrypt`, `keygen`, `seams` (bị bỏ qua khi packaged). I/O mỏng (`node-audit-fs`, `keytar-key-store`) loại khỏi coverage như `log-fs.ts`. Ngưỡng 80% giữ nguyên. | ✅          |
| V. Phased Delivery             | Lõi Pha 1–2 và nền B2B (226/228) đã ship; 3 PR tuần tự, PR A tự đứng được (fail-closed có ngay từ PR A).                                                                                                                                                                                                                                                                                                                                                                                                           | ✅          |
| Terminology                    | Append 8 thuật ngữ intake + `interaction.start/end`, `deviceKeyId`, `orgKeyId` vào glossary trong PR A (rule 5 — chỉ THÊM).                                                                                                                                                                                                                                                                                                                                                                                        | ✅          |
| Source-of-truth                | Không có basic design riêng; mọi lựa chọn ngoài issue đã qua specify/clarify và ghi ADR. Lỗ hổng LAN AI (F2) ghi nhận, không tự sửa trong #236.                                                                                                                                                                                                                                                                                                                                                                    | ✅          |

## Project Structure

### Documentation (this feature)

```text
specs/20261025-081207-enterprise-audit-log/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/audit-record.md · contracts/audit-ipc.md · contracts/audit-cli.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (theo PR)

Cô lập theo feature: `src/main/services/audit/`, `src/renderer/features/audit-status/`. Tệp dùng chung chỉ append, commit "shared" tách riêng (R20).

```text
# PR A — lõi ghi + móc + fail-closed
src/main/services/audit/
  audit-constants.ts            # MỚI — AUDIT_MAX_FILE_BYTES, tên keytar, alg, info HKDF
  audit-types.ts                # MỚI — AuditRecord*, InteractionMeta/Outcome (main-only)
  audit-policy.ts               # MỚI (thuần) — parseAuditPolicy, orgKeyId, validate X25519 SPKI / đường dẫn tuyệt đối
  record-chain.ts               # MỚI (thuần) — hashRecord, signRecord, sealRecord(prev, body, key)
  question-cipher.ts            # MỚI (thuần) — encryptQuestion / decryptQuestion (X25519+HKDF+AES-GCM, AAD)
  device-key.ts                 # MỚI (thuần + KeytarLike) — load/generate, deviceKeyId, phát hiện mất/đổi
  effective-state.ts            # MỚI (thuần) — computeAuditState (data-model §2)
  tail.ts                       # MỚI (thuần) — parseTail (dòng hợp lệ cuối, byte dở), openInteractions
  rotation.ts                   # MỚI (thuần) — fileNameFor(seq), shouldRotate
  identity.ts                   # MỚI (thuần, os tiêm) — osUser (DOMAIN\user), host
  interaction-outcome.ts        # MỚI (thuần) — ánh xạ RagAnswer/StudioResult/lỗi ⇒ status + citations
  describe-model.ts             # MỚI (thuần) — categorizeProvider(id) ⇒ local | lan | online (gồm lan-ollama / lan-openai)
  audit-writer.ts               # MỚI — hàng đợi tuần tự, append+fsync qua AuditFs, xoay vòng
  audit-service.ts              # MỚI — start/runInteraction/recordExport/reevaluate/stop
  node-audit-fs.ts              # MỚI (I/O mỏng) — appendFileSync+fsyncSync, đọc đuôi, list, mkdir
  test-seams.ts                 # MỚI (thuần) — đọc IV_E2E_POLICY_SYSTEM_PATH / IV_E2E_AUDIT_KEYSTORE khi !isPackaged
src/main/services/policy/policy-service.ts   # SỬA — getAuditPolicy() đọc riêng tệp hệ thống (R9); systemPath tiêm được
src/main/ipc/register.ts                     # SỬA — bọc rag:ask, rag:askStream, studio:generate; export.saved ở studio:export
src/main/index.ts                            # SỬA — dựng AuditService (describeModel, identity, keyStore), start() sau license, reevaluate ở license:changed, stop ở before-quit
src/shared/ipc/types.ts                      # SỬA (append) — AuditState, AuditStatus; StudioExportInput.notebookId?, studioKind?
src/shared/codes/user-error.ts               # SỬA (append) — auditWriteFailed, auditPolicyInvalid, auditKeyUnavailable
src/shared/i18n/domains/core.ts              # SỬA (append) — vi/en 3 mã lỗi
src/renderer/features/studio/StudioResultCard.tsx   # SỬA — gửi notebookId + studioKind khi xuất
src/renderer/features/rag-qa/MessageBubble.tsx      # SỬA — gửi notebookId khi xuất câu trả lời (cùng kênh studio:export, không có studioKind)
docs/00-glossary.md                          # SỬA (append) — thuật ngữ audit
docs/04-decisions/2026-10-25-audit-log.md (+INDEX)   # MỚI — ADR thực thi: định dạng, thuật toán, giới hạn đã biết, F2
tests/unit/audit/{audit-policy,record-chain,question-cipher,device-key,effective-state,tail,rotation,identity,
                  interaction-outcome,describe-model,audit-writer,audit-writer-perf,audit-service,test-seams}.test.ts
tests/unit/crash-report-build.test.ts       # SỬA — báo lỗi không chứa nội dung audit, không đọc thư mục audit (FR-022)
tests/e2e/no-egress.spec.ts                 # SỬA — chạy thêm với audit bật (SC-006)
tests/unit/policy/policy-service.test.ts     # SỬA — case audit: chỉ hệ thống, không rơi xuống userData
tests/unit/vault-backup-snapshot.test.ts · vault-backup-swap.test.ts   # SỬA — hồi quy: audit/ không vào snapshot/restore
tests/e2e/audit-log.spec.ts · tests/fixtures/audit/

# PR B — công cụ IT (CLI)
src/main/services/audit/cli/
  cli-args.ts                   # MỚI (thuần) — parseAuditCliArgs(argv) ⇒ lệnh | null | usageError
  verify.ts                     # MỚI (thuần, fs tiêm) — verifyAuditDir ⇒ AuditVerifyReport
  decrypt.ts                    # MỚI (thuần) — decryptAuditDir ⇒ dòng JSONL có questionText
  keygen.ts                     # MỚI (thuần) — generateOrgKeyPair ⇒ PEM + orgKeyId + đoạn policy
  report-text.ts                # MỚI (thuần) — báo cáo chữ vi/en
  run-cli.ts                    # MỚI — điều phối, mã thoát, ghi --out
src/main/index.ts                            # SỬA — rẽ nhánh CLI TRƯỚC resolveLegacyUserDataPath / requestSingleInstanceLock
tests/unit/audit/cli/{cli-args,verify,decrypt,keygen,report-text,run-cli}.test.ts
tests/fixtures/audit/tampered-*/             # MỚI — sửa ký tự, xoá dòng, chèn dòng, đảo dòng, thiếu tệp, đổi khoá
tests/e2e/audit-cli.spec.ts                  # MỚI — smoke: chạy binary --audit-verify, kiểm mã thoát

# PR C — minh bạch
src/shared/ipc/channels.ts                   # SỬA (append) — audit:getStatus, audit:statusChanged
src/preload/index.ts                         # SỬA — audit.getStatus, audit.onStatusChanged
src/main/ipc/register.ts                     # SỬA — handler audit:getStatus + push
src/renderer/features/audit-status/
  AuditStatusChip.tsx · AuditSettingsSection.tsx · useAuditStatus.ts · audit-status.css
  audit-status-label.ts         # MỚI (thuần) — state/reason ⇒ khoá i18n
src/renderer/features/app-shell/AppHeader.tsx       # SỬA — gắn AuditStatusChip cạnh PrivacyBadge
src/renderer/app/SettingsPage.tsx                   # SỬA — thêm AuditSettingsSection (cạnh SettingsLicenseSection / SettingsLanAiSection)
src/shared/i18n/domains/audit.ts             # MỚI — vi + en; đăng ký vào vi.ts/en.ts
docs/enterprise-deployment-guide.md          # SỬA — khoá policy mới, vị trí nhật ký, keygen/verify/decrypt, Windows start /wait
tests/unit/audit/audit-status-label.test.ts · tests/e2e/audit-log.spec.ts (mở rộng chip + Cài đặt)
```

**Structure Decision**: theo mẫu cô lập feature của dự án (`src/main/services/<slug>/` + `src/renderer/features/<slug>/`). Lõi thuần tách khỏi I/O mỏng để đạt coverage và để CLI dùng chung `record-chain` / `question-cipher` với app (một nguồn sự thật cho định dạng).

## Rủi ro & giảm thiểu

| Rủi ro                                                                          | Giảm thiểu                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Xung đột merge với #238 ở `register.ts`, `types.ts`, `user-error.ts`, `core.ts` | Chỉ append; bọc tại chỗ gọi service (vài dòng mỗi handler); commit "shared" riêng; rebase trước PR (rule 6)                |
| keytar không khả dụng (Linux CI, keychain khoá)                                 | Seam `memory` chỉ dev; bản phát hành fail-closed `auditKeyUnavailable` (đúng Q3)                                           |
| Fsync chậm trên ổ mạng (`auditLogDirectory` là share)                           | Đo trong e2e với thư mục tạm; tài liệu khuyến nghị thư mục cục bộ khoá quyền + IT thu thập định kỳ; giới hạn ghi trong ADR |
| Windows CLI không thấy output                                                   | `--out`, chuyển hướng, `start /wait` (contract CLI)                                                                        |
| LAN AI chưa được nối vào chat (F2) ⇒ nhãn `lan` chưa bao giờ xuất hiện          | Ghi provider thực tế; lược đồ đã hỗ trợ `lan`; issue riêng cho #228                                                        |
| Admin cục bộ lấy khoá ký trong keychain để ký lại                               | Giới hạn đã biết (ADR Q2); `--expect-device-key` + đăng ký `deviceKeyId` khi triển khai                                    |

## Complexity Tracking

Không có vi phạm. Hai đề xuất làm rõ constitution (không chặn #236), đi **PR riêng qua steward** (rule 5):

| Đề xuất                                                                                                                                   | Vì sao cần                                                                  | Vì sao không làm trong #236                           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Principle III: ghi rõ nhật ký kiểm toán do tổ chức bật là ngoại lệ có kiểm soát (mã hoá câu hỏi, chỉ cục bộ, không vào báo lỗi/chẩn đoán) | Câu "MUST NOT log nội dung tài liệu" dễ bị đọc rộng ra câu hỏi/tên tài liệu | Sửa constitution phải qua PR riêng được steward duyệt |
| Principle I: khi tổ chức bật ghi nhật ký kiểm toán, app MUST hiển thị cho người dùng                                                      | Đưa FR-023 thành nguyên tắc cho mọi tính năng B2B sau                       | Như trên                                              |
