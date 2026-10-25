# Research — Nhật ký kiểm toán (236)

Đầu vào: [spec.md](./spec.md), quyết định `docs/04-decisions/2026-10-25-audit-log-specify.md` (Q1–Q3) và `docs/04-decisions/2026-10-25-audit-log-clarify.md` (C1–C5). Khảo sát mã trên `main` @ c641036.

Mọi mục dưới đây theo mẫu **Decision / Rationale / Alternatives**. Không còn `NEEDS CLARIFICATION`.

## Phát hiện khi khảo sát mã (ảnh hưởng thiết kế)

- **F1 — Viết lại truy vấn gửi câu hỏi tới model TRƯỚC truy xuất.** `retrieve()` gọi `deps.rewrite` (LLM) khi có lịch sử (`rag/retrieval.ts:96`), trước `chatFn`. ⇒ bản ghi _bắt đầu_ phải được ghi **trước khi gọi `ragServices[target].ask/askStream`**, không phải trước lệnh chat cuối (R1).
- **F2 — LAN AI chưa được nối vào đường chat.** `lan-ollama-client` / `lan-openai-client` chỉ được dùng cho `lanAi:testConnection` (`ipc/register.ts:685–689`); `ProviderRegistry` chỉ có `ollama` + 3 provider online. `setLanProviderActive(true)` làm chỉ báo hiện `lan` trong khi câu trả lời thực sự do provider đang active (thường là Ollama cục bộ) sinh. ⇒ audit ghi **provider thực sự được `pickProvider` chọn** (R2), không ghi theo cờ LAN; nhóm `lan` được hỗ trợ sẵn trong lược đồ để có hiệu lực ngay khi LAN AI được nối vào registry. Lỗ hổng chỉ báo là của #228, tách ra issue riêng (ngoài phạm vi #236).
- **F3 — `PolicyService` rơi xuống `userData` khi tệp hệ thống hỏng** (`policy-service.ts:121–147`, "tệp hợp lệ đầu tiên thắng"). C1 yêu cầu phần audit KHÔNG rơi xuống ⇒ cần nhánh đọc riêng cho tệp hệ thống (R9).
- **F4 — `entitlementsFor` gộp `DEFAULT_ENTERPRISE_FEATURES` vào `features` của license** (`feature-gate.ts:82–84`) ⇒ cơ sở cho C2 (dùng `itPolicy`).
- **F5 — Sao lưu/khôi phục chỉ đụng danh sách thư mục cố định** (`vectors`, `meetings`, DB, `config.json` — `vault-backup/snapshot.ts`, `restore-swap.ts:22–24`) ⇒ thư mục `audit/` trong `userData` tự nhiên nằm ngoài sao lưu/khôi phục; chỉ cần test hồi quy khoá điều này (FR-021).
- **F6 — `StudioExportInput` không có `notebookId` / `kind`** (`types.ts:548`) ⇒ bản ghi xuất (FR-015) cần thêm 2 trường tuỳ chọn (R15).
- **F7 — Single-instance lock** giành khoá ngay khi khởi động (`index.ts:329`); chế độ dòng lệnh phải rẽ nhánh **trước** lock và trước mọi ghi `userData` (R13).

## R1 — Điểm móc (hook) và phạm vi tương tác

- **Decision**: Móc ở tầng handler IPC (`src/main/ipc/register.ts`), bọc quanh lời gọi `ragServices[target].ask/askStream` và `studioServices[target].generate` bằng một hàm điều phối thuần `runAudited(interaction, run)` của `AuditService`: (1) ghi bản ghi `interaction.start` (fsync) — lỗi ⇒ ném `UserFacingError("auditWriteFailed")`, **không** gọi `run`; (2) chạy `run`; (3) ghi `interaction.end` với trạng thái `completed` / `notFound` / `cancelled` / `error` và trích dẫn. `rag-service.ts`, `studio-service.ts` **không sửa**.
- **Rationale**: F1 ⇒ phải ghi trước toàn bộ `compute`. Handler là nơi duy nhất biết `target`, scope đã qua gate, `streamId`/`generationId` và kết quả cuối; giữ `rag-service.ts` nguyên vẹn tránh đụng tệp nhánh #238 đang sửa (`rag-service.ts`, `prompt.ts`). Một tương tác = một lượt người dùng, bất kể bao nhiêu lệnh LLM nội bộ (FR-007/008).
- **Alternatives**: (a) móc trong `rag-service` qua dep mới — phải sửa tệp #238 đang sửa, và vẫn cần tầng handler cho Studio; (b) móc ở `pickProvider().chat` — ghi theo **từng lệnh LLM** (rewrite, map, reduce…), trái FR-007; không biết citations.

## R2 — Xác định mô hình đã dùng

- **Decision**: hàm thuần `categorizeProvider(providerId)` trong `src/main/services/audit/describe-model.ts` (test được, gồm `lan-ollama`/`lan-openai`) + `describeModel(target)` mỏng ở `index.ts` (tiêm vào audit) trả `{ category, providerId, model }`: `category` = `local` khi `providerId === "ollama"`, `lan` khi `lan-ollama`/`lan-openai`, `online` khi `anthropic`/`openai`/`gemini`; `model` = model chat đang chọn (Ollama: `model-selection`; online: cấu hình provider; không rõ ⇒ `null`). Gọi cùng `pickProvider(target)` mà lượt dùng ⇒ ghi đúng provider thực tế. Lượt "Trả lời bằng AI cục bộ" (098) là một lời gọi IPC mới với `target: "local"` ⇒ một tương tác mới, nhóm `local`.
- **Rationale**: F2 — chỉ provider được chọn lúc gọi mới là sự thật; online được ghi (Assumption trong spec) vì đó là egress cần kiểm toán nhất. Không ghi URL/host LAN (chỉ nhóm + model).
- **Alternatives**: suy từ `PrivacyState` — sai khi LAN bật (F2); ghi từ cấu hình `lanAi.config` — sai cùng lý do.

## R3 — Định dạng và chuỗi bản ghi

- **Decision**: JSON Lines, UTF-8, mỗi bản ghi một dòng. Mỗi bản ghi có `v` (lược đồ = 1), `seq` (tăng đơn điệu từ 0, xuyên các tệp), `ts` (ISO-8601 UTC, ms), `type`, `prevHash`, `hash`, `sig`. `hash` = SHA-256 (hex) của **JSON chuẩn hoá** (tái dùng `license/canonical-json.ts`) của bản ghi bỏ `hash` + `sig`; `prevHash` = `hash` bản ghi trước (bản ghi đầu tiên của chuỗi: 64 số `0`). `sig` = Ed25519 (base64) trên chuỗi byte `hash`. Chi tiết trường: [data-model.md](./data-model.md), lược đồ: [contracts/audit-record.md](./contracts/audit-record.md).
- **Rationale**: Chuỗi băm phát hiện xoá/chèn/đổi thứ tự; chữ ký phát hiện sửa/chèn bởi người không nắm khoá; JSON Lines dễ cho IT `grep`/SIEM; JSON chuẩn hoá đã có sẵn và được test cho license. `node:crypto` có sẵn Ed25519 (`license-verifier.ts` đã dùng `sign/verify`) ⇒ **không thêm dependency**.
- **Alternatives**: HMAC (Q2 đã loại); Merkle tree theo lô — phức tạp hơn, lợi ích chỉ khi tệp rất lớn; SQLite — trộn với vault, bị sao lưu/khôi phục, trái FR-021.

## R4 — Mã hoá câu hỏi bằng khoá công khai của tổ chức (Q1)

- **Decision**: Lai (hybrid) **X25519 + HKDF-SHA256 + AES-256-GCM**, mỗi bản ghi một khoá tạm (ephemeral): sinh cặp X25519 tạm → `diffieHellman` với khoá công khai X25519 của tổ chức → HKDF-SHA256 (`info = "sourcecraft-audit-v1"`, `salt` = khoá công khai tạm) → khoá AES 256 bit; nonce 12 byte ngẫu nhiên; AAD = `seq` + `interactionId`. Lưu `{ alg: "x25519-hkdf-sha256-aes256gcm", epk, nonce, ct, tag }` (base64) và `orgKeyId` (SHA-256 16 byte đầu của SPKI khoá công khai tổ chức). Khoá công khai tổ chức là PEM SPKI trong policy hệ thống (`auditPublicKey`). Khoá bí mật không bao giờ có trên máy nhân viên.
- **Rationale**: Chỉ bên giữ khoá bí mật giải mã được (Q1). AAD gắn bản mã vào đúng bản ghi (chống bê bản mã sang bản ghi khác). Tất cả có trong `node:crypto` (`generateKeyPairSync("x25519")`, `diffieHellman`, `hkdfSync`, `createCipheriv("aes-256-gcm")`). Khoá X25519 ngắn (PEM ~110 ký tự) — dễ dán vào policy.
- **Alternatives**: RSA-OAEP-4096 bọc khoá AES — khoá dài, chậm hơn, không lợi gì; mã hoá đối xứng bằng khoá trong policy — ai đọc policy cũng giải mã được (vô hiệu Q1); không mã hoá — Q1 đã loại.

## R5 — Khoá ký của máy (Q2)

- **Decision**: Ed25519 sinh bằng `generateKeyPairSync("ed25519")` ở lần đầu audit có hiệu lực; khoá bí mật (PKCS8 PEM) lưu qua keytar với service **`SourceCraft Audit`**, account `device-signing-key` (bọc giao diện `KeytarLike` sẵn có ⇒ test bằng fake). Khoá công khai (SPKI PEM) + `deviceKeyId` (SHA-256 16 byte đầu) ghi vào bản ghi `audit.chainStarted` / `audit.keyRotated`. Keychain lỗi/không đọc được khi audit có hiệu lực ⇒ coi như không ghi được ⇒ fail-closed (Q3).
- **Rationale**: Khớp Q2 + Constitution III (secret qua keytar). Service tách khỏi `InsightVault` (API key online) để không lẫn khoá. Giới hạn đã biết (admin cục bộ lấy được khoá) ghi trong ADR Q2; giảm thiểu bằng đối chiếu `deviceKeyId` IT đã đăng ký (R13 `--expect-device-key`).
- **Alternatives**: Electron `safeStorage` + tệp — mã hoá theo người dùng đăng nhập, mạnh tương đương keytar nhưng thêm tệp phải bảo vệ; khoá trong tệp plaintext — trái Constitution III.

## R6 — Ghi bền, tuần tự và khôi phục sau crash

- **Decision**: Một `AuditWriter` duy nhất trong main (single-instance lock đảm bảo một tiến trình), hàng đợi tuần tự trong bộ nhớ (Promise chain) ⇒ lượt song song không xen lẫn (FR-017). Mỗi bản ghi = một lần `appendFileSync` cả dòng + `fsyncSync` (bản ghi `interaction.start` bắt buộc fsync trước khi trả; bản ghi khác cũng fsync — tần suất thấp). Đầu chuỗi (`seq`, `hash` cuối, `ts` cuối, `deviceKeyId`) được **suy từ dòng hợp lệ cuối cùng của tệp hiện hành** lúc khởi động, không có tệp trạng thái riêng. Dòng cuối dở dang (crash giữa lúc ghi) ⇒ giữ nguyên byte, xuống dòng, ghi `audit.tailRepaired` (độ dài byte dở) ⇒ trình kiểm tra coi dòng dở ngay trước `tailRepaired` là "đã giải thích", không phải can thiệp. Các `interaction.start` không có `end` từ phiên trước ⇒ bản ghi `audit.sessionAborted` liệt kê `interactionId` (FR-014, FR-009).
- **Rationale**: Không có tệp trạng thái ⇒ không có trạng thái lệch với nhật ký. Ghi đồng bộ ~1 KB + fsync là vài ms trên SSD (SC-005 ≤ 50 ms). Không cắt bỏ byte nào — xoá byte cũng là một dạng sửa nhật ký.
- **Alternatives**: ghi bất đồng bộ có đệm — mất bản ghi khi crash, trái write-ahead; worker riêng — thừa với tần suất vài bản ghi/phút.

## R7 — Xoay vòng

- **Decision**: Tệp hiện hành `audit-<seqĐầu 12 chữ số>.jsonl`; vượt **5 MB** (hằng số `AUDIT_MAX_FILE_BYTES`) ⇒ tệp mới, bản ghi đầu là `audit.fileStarted` mang `prevHash` = hash cuối của tệp cũ và `prevFile` = tên tệp cũ ⇒ chuỗi liền mạch qua tệp. **Không bao giờ xoá** tệp cũ (FR-018). Trình kiểm tra sắp tệp theo `seqĐầu`; thiếu tệp giữa ⇒ "bị can thiệp: thiếu tệp"; thiếu tệp đầu (IT đã lưu trữ đi) ⇒ chấp nhận khi được gọi với `--from-seq`/tệp đầu là `audit.fileStarted` và báo "bắt đầu từ seq N" (cảnh báo, không lỗi).
- **Rationale**: 5 MB ≈ 4–5 nghìn bản ghi — mở được bằng trình soạn thảo, đủ ít tệp. Tên chứa `seq` ⇒ thứ tự xác định không phụ thuộc mtime.
- **Alternatives**: xoay theo ngày — tệp rỗng/ngày nhiều, không cần; xoá tệp cũ theo hạn — trái FR-018.

## R8 — Vị trí thư mục (C3)

- **Decision**: Mặc định `<userData>/audit/` (`dataDir.path`), tách `logs/` và khỏi danh sách thư mục của sao lưu/khôi phục (F5 — thêm test hồi quy). Policy hệ thống `auditLogDirectory` (đường dẫn tuyệt đối) thay thế mặc định; không tồn tại ⇒ thử `mkdir -p`; không ghi được ⇒ fail-closed, **không** rơi về mặc định. Gỡ cài đặt không xoá (thư mục ngoài bundle app; `userData` vốn được giữ).
- **Rationale**: C3. Đường dẫn chỉ đọc từ tệp hệ thống (C1).
- **Alternatives**: thư mục hệ thống bắt buộc — người dùng thường không ghi được (B ở câu clarify 3, đã loại).

## R9 — Chính sách: đọc phần audit chỉ từ tệp hệ thống (C1)

- **Decision**: Thêm hàm thuần `parseAuditPolicy(obj)` và phương thức `PolicyService.getAuditPolicy(): AuditPolicyState` đọc **riêng** tệp hệ thống (`systemPath`), độc lập với `loadPolicy()` hiện có: không có tệp ⇒ `{ status: "notConfigured" }`; có tệp nhưng JSON/lược đồ hỏng ⇒ `{ status: "policyError", reason }`; `enableAuditLogging !== true` ⇒ `notConfigured`; bật nhưng `auditPublicKey` thiếu/không phải X25519 SPKI hợp lệ ⇒ `policyError("invalidAuditPublicKey")`; `auditLogDirectory` có nhưng không tuyệt đối ⇒ `policyError("invalidAuditLogDirectory")`; hợp lệ ⇒ `{ status: "configured", publicKeyPem, orgKeyId, directory? }`. Ba khoá mới là **tuỳ chọn**, giữ `schemaVersion: 1`; `parseEnterprisePolicyJson` bỏ qua chúng như cũ ⇒ hành vi các khoá khác không đổi (C1). Nạp một lần lúc khởi động như `loadPolicy` (Assumption).
- **Rationale**: Tách nhánh đọc là cách duy nhất để vừa không rơi xuống `userData` cho audit (F3) vừa không đổi hành vi #228.
- **Alternatives**: sửa `loadPolicy` thành "chỉ hệ thống" cho mọi khoá — C đã loại ở clarify.

## R10 — Trạng thái hiệu lực và bản quyền theo lượt

- **Decision**: `AuditService.effectiveState()` thuần = f(`auditPolicy`, `license.getStatus().state === "valid"`, `gate.hasFeature("itPolicy")`, `writerHealth`) ∈ `off` (không cấu hình) · `licenseInactive` (policy bật, bản quyền không đủ — FR-004, không chặn AI) · `policyError` (FR-006/FR-010a — **chặn AI**, vì policy đã yêu cầu audit; CHỈ khi bản quyền đủ điều kiện — không có bản quyền thì `licenseInactive`, sửa sau code review) · `active` · `blocked` (active nhưng ghi lỗi — chặn AI). Đánh giá ở mỗi lượt (FR-002), lúc khởi động, khi `license:changed` (móc tại `index.ts` nơi đang phát sự kiện) và `before-quit`. Chuyển `active → không active` ⇒ ghi `audit.stopped` kèm lý do (`licenseInactive` / `appQuit`) nếu còn ghi được; `→ active` ⇒ `audit.started`.
- **Rationale**: `policyError` chặn AI là hệ quả của Q3 + FR-010a: tổ chức đã yêu cầu audit mà cấu hình sai ⇒ không được âm thầm chạy không audit. `licenseInactive` không chặn (FR-004) vì không có bản quyền thì cờ "không có hiệu lực".
- **Alternatives**: cache trạng thái bản quyền lúc khởi động — trái FR-002.

## R11 — Lỗi hướng người dùng (fail-closed)

- **Decision**: 3 mã `UserFacingError` mới (vi/en trong `i18n/domains/core.ts`): `auditWriteFailed` (đĩa đầy / mất quyền / thư mục mất — kèm gợi ý "liên hệ IT"), `auditPolicyInvalid` (thiếu/hỏng khoá công khai, thư mục không hợp lệ, tệp policy hệ thống hỏng), `auditKeyUnavailable` (không đọc/ghi được khoá ký trong keychain). Chi tiết kỹ thuật vào `app-log` chỉ gồm mã + `errorType` (`ENOSPC`, `EACCES`…), **không** nội dung câu hỏi. Khi ghi lại được sau trạng thái `blocked` ⇒ `audit.recovered { since }` (FR-016a). Lỗi ghi `interaction.end` ⇒ trả kết quả bình thường, chuyển `blocked` cho lượt sau.
- **Rationale**: Q3. Ba mã ⇒ thông báo đủ cụ thể để người dùng biết gọi ai.
- **Alternatives**: một mã chung — người dùng không phân biệt "đĩa đầy" với "IT cấu hình sai".

## R12 — Chỉ báo "đang ghi nhật ký kiểm toán" (FR-023)

- **Decision**: Kênh IPC mới `audit:getStatus` (invoke) + `audit:statusChanged` (push) trả `AuditStatus { state, reason?, organization?, directoryKind?, blockedSince? }`. Renderer chỉ nhận **nhãn** vị trí (`default` / `custom`), không nhận đường dẫn — giữ quy ước 085 (renderer không nhận/gửi đường dẫn tệp); IT xem đường dẫn trong chính tệp policy. Renderer feature mới `src/renderer/features/audit-status/`: chip nhỏ cạnh huy hiệu riêng tư ở header (chỉ khi `active`/`blocked`), mục "Nhật ký kiểm toán" trong Cài đặt › Chính sách tổ chức hiển thị trạng thái + lý do (chỉ đọc, FR-003). **Không** sửa kiểu `PrivacyState`.
- **Rationale**: `PrivacyState` mô tả đường dữ liệu đi ra; audit là việc ghi cục bộ — tách khái niệm, không đụng `privacy-state.ts`/`types.ts` nhiều. Push giúp chỉ báo đổi ngay khi bản quyền đổi.
- **Alternatives**: thêm `audit?: boolean` vào `PrivacyState` — trộn hai khái niệm, đụng thêm test 103.

## R13 — Chế độ dòng lệnh cho IT (C4)

- **Decision**: Hàm thuần `parseAuditCliArgs(argv)` chạy ở đầu `main/index.ts`, **trước** `resolveLegacyUserDataPath`/`requestSingleInstanceLock`. Có lệnh ⇒ `app.whenReady` không tạo cửa sổ, chạy `runAuditCli` (thuần, fs tiêm vào), in báo cáo ra stdout, và `app.exit(code)`; **không** đọc/ghi `userData`, không giành lock (IT có thể chạy khi app đang mở). Lệnh: `--audit-verify <dir> [--expect-device-key <pem|keyId>] [--json] [--out <file>] [--lang vi|en]`; `--audit-decrypt <dir> --org-key <privatePem> --out <file>` (ghi JSONL kèm câu hỏi đã giải mã — **chỉ ra tệp**, không ra stdout); `--audit-keygen --out-dir <dir>` (sinh cặp X25519 tổ chức, in đoạn JSON dán vào policy). Mã thoát: `0` nguyên vẹn (có thể kèm cảnh báo: tương tác chưa kết thúc, đổi khoá, thiếu tệp đầu đã lưu trữ), `1` bị can thiệp, `2` lỗi sử dụng, `3` lỗi I/O / khoá. Windows: ứng dụng GUI không gắn console ⇒ tài liệu hướng dẫn dùng `--out` + `start /wait` để lấy mã thoát; stdout vẫn hoạt động khi chuyển hướng (`> report.txt`).
- **Rationale**: C4; tách khỏi lock vì chỉ đọc. Không có lệnh ghi/sửa/xoá (FR-020b). Đặt logic trong `services/audit/cli/*.ts` thuần ⇒ unit test đủ, e2e chỉ smoke một lần chạy binary.
- **Alternatives**: `ELECTRON_RUN_AS_NODE` + script — bị fuse vô hiệu ở bản ký sau này, khó cho IT; script Node trong repo — A ở câu clarify 4, đã loại.

## R14 — Định danh người dùng và máy

- **Decision**: `osUser` = `os.userInfo().username`; trên Windows thêm miền khi `process.env.USERDOMAIN` khác `COMPUTERNAME` ⇒ `DOMAIN\user`. `host` = `os.hostname()`. `osUser` và `host` ghi ở **mỗi** `interaction.start` (FR-009 — mỗi bản ghi tự đứng được khi thanh tra trích riêng); `appVersion`, `policyId`, `licenseId` (nếu có) chỉ ghi ở `audit.started`.
- **Rationale**: Đủ cho IT nối với AD; không cần quyền đặc biệt. `os.userInfo()` ném trên một số môi trường lạ ⇒ bọc, rơi về `process.env.USER/USERNAME`, cuối cùng `"unknown"` (không chặn AI vì lý do này).
- **Alternatives**: SID Windows — cần native module; không đáng ở v1.

## R15 — Bản ghi xuất báo cáo (FR-015)

- **Decision**: Thêm 2 trường **tuỳ chọn** `notebookId?: string`, `studioKind?: StudioKind` vào `StudioExportInput` (renderer `StudioPanel` đã có cả hai lúc bấm xuất). Handler `studio:export` ghi `export.saved { format, notebookId, notebookName, studioKind, fileName }` **chỉ khi** `saved === true` (huỷ hộp thoại ⇒ không ghi). `fileName` = basename (không thư mục). Ghi **sau** khi tệp đã lưu; lỗi ghi ⇒ chuyển `blocked` cho các lượt AI sau (không chặn được việc đã xuất). Trường từ renderer là không tin cậy ⇒ kiểm kiểu, `notebookName` tra từ DB theo `notebookId`.
- **Ghi chú**: nút xuất câu trả lời chat (`rag-qa/MessageBubble.tsx`) dùng **cùng kênh** `studio:export` ⇒ cũng được ghi `export.saved`, không có `studioKind` (là đầu ra AI rời ứng dụng — đúng tinh thần FR-015).
- **Rationale**: Xuất không phải lượt AI nên không thể write-ahead có ý nghĩa (nội dung đã có ở renderer). Thêm trường tuỳ chọn ở cuối interface ⇒ xung đột tối thiểu với #238.
- **Alternatives**: ghi trước khi mở hộp thoại — ghi cả lần huỷ; không ghi notebook — thanh tra không biết dữ liệu ra từ đâu.

## R16 — Nội dung bản ghi Studio

- **Decision**: `interaction.start` cho Studio: `kind = "studio"`, `studioKind`, `notebookId/notebookName`, `sourceScope` = `{ all: true }` hoặc `{ sourceIds: [...] }` (tối đa 50, theo giới hạn hiện có), `question` = **bản mã** của `customPrompt` khi `studioKind === "custom"`, vắng mặt với loại khác. `interaction.end`: `citations` = `StudioResult.citations`, `parts`, `truncated`.
- **Rationale**: Assumption của spec ("yêu cầu" Studio = loại + phạm vi + yêu cầu tuỳ chỉnh).

## R17 — Thời gian

- **Decision**: `ts` từ `Date.now()`; nếu `ts` < `ts` bản ghi trước ⇒ thêm `clockBackwards: true` (FR-013). Không tái dùng `lastSeenTimestamp` của license (khác mục đích, ngưỡng 24 giờ).

## R18 — Hiệu năng

- **Decision**: Đo chi phí ghi bằng unit test trên fs thật trong thư mục tạm (append + fsync 100 bản ghi `interaction.start`, p95 ≤ 20 ms); e2e dùng **máy chủ Ollama giả bằng `http.createServer`** như các bộ `studio-*.spec.ts` hiện có (không có seam LLM giả cho RAG), chạy 20 lượt hỏi với audit bật/tắt và so thời gian tới token đầu (SC-005 ≤ 50 ms). Kiểm tra 10.000 bản ghi (SC-004) là unit test với fs trong bộ nhớ + một lần chạy CLI trên fixture sinh sẵn.

## R18a — Seam kiểm thử (chỉ bản chưa đóng gói)

- **Decision**: Hai biến môi trường, đọc **chỉ khi `!app.isPackaged`** (cùng mẫu `IV_E2E_LICENSE_TIER`): `IV_E2E_POLICY_SYSTEM_PATH` (đường dẫn tệp policy "hệ thống" thay `getDefaultSystemPolicyPath()` — CI không ghi được `/Library/…`/`%ProgramData%`) và `IV_E2E_AUDIT_KEYSTORE=memory` (khoá ký trong bộ nhớ thay keytar — runner CI không có keychain mở khoá). Bản đóng gói bỏ qua cả hai; có unit test khoá điều đó.
- **Rationale**: Không có seam thì không e2e được FR-005 lẫn luồng ghi; giới hạn vào bản dev giữ nguyên ranh giới bảo mật của bản phát hành.
- **Alternatives**: chạy e2e với quyền admin — không khả thi trên CI.

## R6a — Đóng tương tác còn mở khi dừng

- **Decision**: `stop(reason)` và chuyển `active → licenseInactive` trước hết ghi `interaction.end{status:"cancelled"}` cho mọi `interactionId` còn mở trong bộ nhớ, **rồi** mới ghi `audit.stopped`; lượt `run()` kết thúc muộn sau đó KHÔNG ghi thêm `end` (đã đóng).
- **Rationale**: thoát khi đang stream (`window-all-closed` huỷ lượt bất đồng bộ) không được để `end` rơi sau `audit.stopped` hoặc mất — phiên thoát sạch không để lại cảnh báo `openInteraction`.

## R19 — Đổi khoá ký (FR-019b)

- **Decision**: Lúc khởi động khi audit `active`: đọc khoá từ keychain; không có khoá **và** nhật ký đã có chuỗi ⇒ sinh khoá mới, ghi `audit.keyRotated { previousDeviceKeyId, devicePublicKey, deviceKeyId, reason: "keyMissing" }` — bản ghi này nối chuỗi (`prevHash`) nhưng ký bằng khoá **mới**; trình kiểm tra chấp nhận và **cảnh báo**. Có khoá nhưng `deviceKeyId` khác bản ghi cuối ⇒ tương tự với `reason: "keyMismatch"`.
- **Rationale**: Không âm thầm bắt đầu chuỗi mới; việc đổi khoá hiển hiện cho IT.

## R20 — Ràng buộc song song với #238

- **Decision**: Không sửa `feature-gate.ts`, `license-verifier.ts`, `scripts/issue-license.mjs`, `rag-service.ts`, `rag/prompt.ts`, `ai-runtime/*`. Các tệp dùng chung phải sửa (`shared/ipc/types.ts`, `shared/ipc/channels.ts`, `shared/codes/user-error.ts`, `i18n/domains/core.ts`, `preload/index.ts`, `ipc/register.ts`, `main/index.ts`) chỉ **append** hoặc bọc cục bộ, tách commit "shared" riêng để rebase dễ.

## R21 — Constitution

- **Decision**: Không vi phạm câu chữ Principle III ("MUST NOT log nội dung tài liệu người dùng"): nhật ký kiểm toán **không** chứa nội dung tài liệu (chỉ tên nguồn/sổ tay + locator) và câu hỏi được mã hoá. Vẫn đề xuất PR constitution riêng (steward) để ghi rõ ngoại lệ có kiểm soát cho kênh kiểm toán và yêu cầu chỉ báo (Principle I) — xem Complexity Tracking trong [plan.md](./plan.md). #236 không chờ PR đó.
