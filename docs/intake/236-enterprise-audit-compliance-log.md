# Intake — 236-enterprise-audit-compliance-log

- Issue: #236 — "[feature] enterprise-audit-compliance-log: Nhật ký kiểm toán & tuân thủ (Audit Log) chống giả mạo cho doanh nghiệp (Enterprise)"
- Slug: `enterprise-audit-compliance-log` (branch `236-enterprise-audit-compliance-log`)
- Ngày intake: 2026-10-25
- Loại: tính năng MỚI, chỉ cho bản quyền **Enterprise**, bật bằng chính sách IT (`enableAuditLogging` trong `enterprise-policy.json`). Tiếp nối Pha 2 B2B (`226-enterprise-license`, `228-lan-ai-and-policy`).
- Chạm các tầng (theo issue + khảo sát mã):
  - **MỚI** `src/main/services/audit/` (ghi/xoay vòng/ký hoặc mã hoá nhật ký, công cụ kiểm tra tính toàn vẹn nếu được chốt).
  - `src/main/services/policy/policy-service.ts` — `parseEnterprisePolicyJson` hiện **bỏ mọi khoá lạ** (chỉ giữ `forceLocalOnly`, `allowedLanHosts`, `preconfiguredLanAi`, `enforceBackupEncryption`) ⇒ phải thêm `enableAuditLogging` vào parser + interface `PolicyService` (vd. `isAuditLoggingEnabled()`); kiểu `EnterprisePolicy` ở `src/shared/ipc/types.ts`.
  - `src/main/services/license/feature-gate.ts` + `LicenseFeature` (`src/shared/ipc/types.ts`) — hiện KHÔNG có cờ nào cho audit (8 cờ: `multimedia`, `studioPro`, `meetingLong`, `lanAi`, `sharedNotebooks`, `itPolicy`, `crossNotebookSearch`, `brandedExport`).
  - Hook điểm vào: `src/main/services/rag/rag-service.ts` (`ask` / `askStream` → `compute`) và `src/main/services/studio/studio-service.ts` (`generate`), nối dây ở `src/main/index.ts` / `src/main/ipc/register.ts` (handler `rag:ask`, `rag:askStream`, `studio:generate`, `studio:export`).
  - `src/shared/` (kiểu, mã lỗi `UserFacingError`, i18n vi/en) nếu có thông báo/chỉ báo UI.
  - Tái dùng ý tưởng (không tái dùng nguyên) `src/main/services/app-log/log-file.ts` (xoay vòng theo dung lượng, fs tiêm vào) và `src/main/services/license/canonical-json.ts` (JSON chuẩn hoá) + khoá Ed25519/keytar đã có.
- Lưu ý song song: nhánh `238-domain-specific-ai-modes` (thư mục chính) đang sửa `feature-gate.ts`, `license-verifier.ts`, `scripts/issue-license.mjs`, `src/shared/ipc/types.ts`, `src/main/services/rag/prompt.ts` ⇒ rủi ro conflict khi thêm cờ bản quyền mới; tách commit nhỏ cho phần dùng chung.

## Input sources

- GitHub issue #236 (tóm tắt acceptance do người giao việc cung cấp) — **nguồn chính**. KHÔNG có `docs/01-basic-design/<audit>/basic-design.md` và KHÔNG có detail design / Figma cho tính năng này (xác nhận bằng tìm kiếm trong repo: chưa có chữ "audit"/`enableAuditLogging` ở mã nguồn hay docs). Mọi chi tiết ngoài issue bên dưới là câu hỏi mở, không phải yêu cầu.
- [`docs/01-basic-design/lan-ai-and-policy/basic-design.md`](../01-basic-design/lan-ai-and-policy/basic-design.md) — tệp `enterprise-policy.json` (vị trí hệ thống/`userData`, schema v1, nạp một lần lúc khởi động), `PrivacyState: lan`.
- [`docs/enterprise-deployment-guide.md`](../enterprise-deployment-guide.md) — cách IT phân phối `enterprise-policy.json` + `.sclicense` vào thư mục hệ thống (macOS `/Library/Application Support/SourceCraft`, Windows `%ProgramData%\SourceCraft`, Linux `/etc/sourcecraft`); mục 2 "Hiệu lực của Chính sách" là chỗ cần bổ sung `enableAuditLogging` khi tài liệu hoá.
- [`docs/01-basic-design/enterprise-license/basic-design.md`](../01-basic-design/enterprise-license/basic-design.md) — 3 tầng `free|pro|enterprise`, `features[]`, `FeatureGate`, xác thực Ed25519 offline, clock-rollback guard (`lastSeenTimestamp`), trạng thái `valid|expired|invalid|clockTampered`.
- [`docs/OVERVIEW.md`](../OVERVIEW.md), [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) — I (Local-first, không telemetry nội dung, privacy indicator đúng thực tế), III (không log nội dung tài liệu; secret qua keytar; mọi FS ở main), IV (TDD, coverage ≥ 80%).
- [`docs/00-glossary.md`](../00-glossary.md) — đã tra: "Nhật ký" hiện chỉ là nhật ký chẩn đoán của app (088, `app-log`); chưa có thuật ngữ audit (xem mục Thuật ngữ mới).
- Mã nguồn đối chiếu: `policy-service.ts`, `feature-gate.ts`, `rag-service.ts`, `studio-service.ts`, `app-log/log-file.ts`, `ipc/register.ts` (handler rag/studio), kiểu `RagAskInput`/`Citation`/`StudioGenerateInput` trong `src/shared/ipc/types.ts`.
- `docs/04-decisions/INDEX.md` — đã quét toàn bộ: **chưa có quyết định nào về audit/nhật ký tuân thủ**. Các quyết định liên quan được áp dụng, KHÔNG hỏi lại: (a) privacy badge 3 trạng thái + `lan` (103, 228) — chỉ báo phải khớp hành vi thực; (b) lượt AI cục bộ sau lỗi online (098) chạy bằng Ollama; (c) keytar cho secret (tech-stack ADR, 031); (d) lịch sử chat lưu SQLite ở main, best-effort, không log nội dung (027); (e) sao lưu = DB snapshot + vectors + config (085); (f) migration SQLite append-only (ADR 2026-07-11).
- Figma: không có.

## Prompt for /speckit-specify

Xây dựng tính năng **Nhật ký Kiểm toán & Tuân thủ cho Doanh nghiệp (`enterprise-audit-compliance-log`)** cho ứng dụng SourceCraft, dành cho đội IT / tuân thủ của các tổ chức chịu quản lý chặt (ngân hàng, y tế, pháp lý). Mục tiêu: tổ chức có thể chứng minh được ai đã hỏi AI điều gì, bằng mô hình nào, dựa trên những tài liệu nội bộ nào.

1. **Nội dung mỗi bản ghi kiểm toán (Audit Record).** Mỗi lượt tương tác AI ghi một bản ghi gồm: (a) dấu thời gian (timestamp); (b) tài khoản người dùng hệ điều hành (OS user account) đang chạy ứng dụng; (c) câu hỏi đã gửi cho AI; (d) mô hình đã dùng, phân biệt **Local** (Ollama cục bộ) và **LAN AI** (máy chủ AI mạng nội bộ — `lan-ollama` / `lan-openai`, kèm tên model); (e) danh sách các trích dẫn tài liệu nội bộ đã được truy xuất (các nguồn/đoạn trong kho tri thức dùng làm căn cứ cho câu trả lời — `Citation`: nguồn, notebook, vị trí `locator`).

2. **Phạm vi hook.** Ghi nhật ký tại main process, ở đường hỏi đáp RAG (`src/main/services/rag/` — `rag:ask` và `rag:askStream`) và đường AI Studio (`src/main/services/studio/` — `studio:generate`). Không đưa việc ghi nhật ký vào renderer (Constitution III).

3. **Chống giả mạo (tamper-resistance).** Nhật ký lưu trong tệp kiểm toán **xoay vòng (rotating audit log file)** và phải được **ký hoặc mã hoá** để phát hiện/chống chỉnh sửa, xoá, chèn bản ghi. Việc phát hiện sửa đổi phải kiểm chứng được cục bộ, không cần Internet.

4. **Bật/tắt bằng chính sách IT.** Chỉ bật khi tệp `enterprise-policy.json` có `enableAuditLogging: true`; do IT Admin phân phối như các khoá chính sách hiện có (`forceLocalOnly`, `enforceBackupEncryption`…). Người dùng cuối không tự bật/tắt được.

5. **Phân tầng bản quyền.** Tính năng chỉ khả dụng khi bản quyền là **Enterprise** hợp lệ, được kiểm tra qua `FeatureGate` tại main process. Không có bản quyền Enterprise thì cờ chính sách không có hiệu lực.

6. **Ràng buộc nền tảng.** 100% cục bộ, không gửi nhật ký ra ngoài (Constitution I); mọi truy cập tệp ở main process (Constitution III); dùng TDD, coverage ≥ 80% cho logic mới (Constitution IV); mọi chuỗi giao diện/lỗi (nếu có) qua `src/shared/i18n` Tiếng Việt + English.

(Các điểm chưa rõ — thuật toán ký/mã hoá và nơi giữ khoá, ghi nguyên văn câu hỏi hay băm, có ghi câu trả lời hay không, phạm vi hook — Studio/xuất file/tìm toàn cục, xoay vòng và lưu giữ, vị trí & quyền đọc, hành vi khi không ghi được, provider online, tương tác giữa cờ chính sách và bản quyền, chỉ báo UI — KHÔNG được tự quyết ở bước specify; xem mục Ambiguities để `/speckit-clarify` xử lý.)

## Ambiguities to raise in /speckit-clarify

Đã loại các mục có quyết định trong `docs/04-decisions/INDEX.md` (không có mục nào trùng chủ đề audit). Nhóm theo mức ưu tiên; 1–10 là phần bắt buộc người giao việc yêu cầu, 11–20 là phát hiện thêm khi đối chiếu mã.

### Nhóm A — Bảo mật & mật mã (chặn thiết kế)

1. **Ký hay mã hoá?** Issue ghi "signed or encrypted" (hoặc). Mục tiêu "chống giả mạo" (tamper-evident) khác "bảo mật nội dung" (confidentiality). Chọn: (a) chuỗi băm + HMAC từng bản ghi (hash chain, phát hiện sửa/xoá giữa chuỗi), (b) chữ ký Ed25519 từng bản ghi/từng lô, (c) mã hoá AES-GCM cả tệp, (d) kết hợp. Nên làm rõ mục tiêu chính: chỉ phát hiện sửa đổi, hay cả che nội dung với người dùng cục bộ?
2. **Khoá nằm ở đâu và ai nắm?** Mọi khoá lưu trên chính máy người dùng thì người có quyền admin cục bộ vẫn có thể tự ký lại/giả mạo. Phương án: keytar (đã dùng cho API key; người dùng đăng nhập vẫn lấy được), `safeStorage`, khoá theo thiết bị Ed25519 với public key do IT đăng ký, hoặc khoá của tổ chức nhúng trong `enterprise-policy.json`/`.sclicense`. Ai (IT) giữ khoá giải mã/kiểm tra, và có cần khoá riêng cho từng máy không? Ràng buộc: air-gapped, không máy chủ khoá.
3. **Giải quyết "chain break" khi xoay vòng:** hash chain có nối xuyên các tệp đã xoay không; xoá tệp cũ nhất khi hết hạn lưu giữ có bị coi là giả mạo không; kiểm tra toàn vẹn thế nào khi thiếu tệp đầu?
4. **Nguồn thời gian:** timestamp lấy từ đồng hồ hệ thống (người dùng có thể lùi). Có tái dùng clock-rollback guard (`lastSeenTimestamp`, ngưỡng 24 giờ) của bản quyền để đánh dấu bản ghi "đồng hồ nghi ngờ" không? Có số thứ tự đơn điệu (sequence number) độc lập đồng hồ không?
5. **Lộ khoá/chính sách do người dùng ghi đè:** `PolicyService` đọc `systemPath` rồi `userDataPath` (thư mục người dùng ghi được) và **tệp đầu tiên hợp lệ thắng**. Nếu IT không đặt tệp hệ thống, người dùng có thể tự tạo `<userData>/enterprise-policy.json` KHÔNG có `enableAuditLogging` (hoặc ngược lại tự bật). Với audit — tính năng có ý nghĩa chống người dùng — có CHỈ chấp nhận cờ từ đường dẫn hệ thống (quyền admin) không? Tệp policy hỏng/không parse được (`policy.loadFailed`) hiện làm policy = `null` ⇒ audit tắt âm thầm: chấp nhận không?

### Nhóm B — Quyền riêng tư & nội dung ghi (căng thẳng với Local-first / Constitution III)

6. **Ghi nguyên văn hay băm?** Issue yêu cầu ghi "câu hỏi gửi cho AI". Hạn chế Constitution III hiện là "MUST NOT log nội dung tài liệu" (nhật ký chẩn đoán); câu hỏi có thể chứa PII/dữ liệu khách hàng (ngân hàng, y tế). Chọn: (a) ghi nguyên văn câu hỏi (đáp ứng kiểm toán nội dung), (b) chỉ ghi băm SHA-256 (+ độ dài) — chứng minh nhưng không đọc lại được, (c) nguyên văn nhưng mã hoá, chỉ IT/tuân thủ giải mã được, (d) cấu hình theo chính sách (vd. `auditLogQuestionMode`). Ghi chú: lịch sử chat (027) đã lưu nguyên văn câu hỏi + câu trả lời ở SQLite cục bộ, nhưng đó là dữ liệu của người dùng, còn audit là dữ liệu của tổ chức — khác chủ sở hữu và khác khả năng xoá.
7. **Có ghi câu trả lời của AI không?** Issue chỉ liệt kê câu hỏi + model + trích dẫn, KHÔNG có câu trả lời. Xác nhận loại trừ (hay cần băm câu trả lời)? Có ghi `mode` (grounded/open), `notFound`, `scope`, `target` (active/local), `outputLanguage` không?
8. **"Danh sách trích dẫn đã truy xuất" nghĩa là gì?** (a) các đoạn truy xuất & đưa vào ngữ cảnh gửi LLM (kể cả không được trích dẫn `[n]`), hay (b) chỉ các trích dẫn `[n]` hợp lệ sau hậu kiểm trong câu trả lời (`Citation[]`)? Với (b), lượt `notFound` ghi danh sách rỗng dù đã truy xuất. Mỗi trích dẫn ghi những trường nào — `sourceId`, `sourceTitle` (tên tài liệu có thể nhạy cảm), `chunkId`, `locator`, `notebookId/notebookName` — hay chỉ ID?
9. **Thông báo cho nhân viên:** có cần nhân viên biết mình đang bị ghi (yêu cầu pháp lý/lao động ở một số khu vực)? Liên quan câu 18 (chỉ báo UI).

### Nhóm C — Phạm vi hook

10. **Studio:** `studio:generate` không có "câu hỏi" mà có `kind`, `customPrompt` (≤ 500 ký tự), `sourceIds`/phạm vi nguồn, và có thể nhiều lượt LLM (map-reduce). Ghi 1 bản ghi/lượt Studio hay 1/lượt gọi LLM? Trường "question" của Studio = `customPrompt` (chỉ ở kind `custom`) hay mô tả `kind`? Trích dẫn = các nguồn trong phạm vi hay các `Citation` của kết quả?
11. **Xuất tài liệu #232 (`studio:export`, docx/pdf):** đây là dữ liệu rời khỏi ứng dụng ra tệp — sự kiện quan trọng cho tuân thủ nhưng không phải truy vấn AI, và issue không nêu. Có ghi (kiểu, notebook, đường dẫn đích hay chỉ tên tệp) không? Còn "copy to clipboard"?
12. **Tìm kiếm toàn cục #231 (`scope: "all"`):** lượt này truy xuất xuyên nhiều notebook; trích dẫn kèm `notebookId/notebookName`. Ghi `scope` để IT thấy phạm vi rộng? Các tính năng khác chạm nội dung nhưng không gọi LLM — tìm toàn văn (`content-search`), xem nguồn, nạp nguồn/audio/meeting — có nằm ngoài phạm vi không (chỉ "tương tác với AI" được ghi)?
13. **Các lệnh gọi LLM phụ:** viết lại truy vấn (`rewrite.ts`, gửi câu hỏi + lịch sử cho LLM), bước map/condense của Studio, hậu xử lý Meeting — mỗi lượt hỏi có thể gồm nhiều lệnh LLM. Ghi gộp 1 bản ghi/lượt người dùng hay từng lệnh? Lượt `notFound` (có truy xuất nhưng không gọi LLM sinh câu trả lời) có ghi không? Lượt bị huỷ/dừng giữa chừng (`rag:stop`, `studio:cancel`) hoặc lỗi LLM có ghi (kèm trạng thái) không? Lượt "Trả lời bằng AI cục bộ" sau lỗi online (098) ghi thế nào?
14. **AI online (OpenAI/Anthropic/Gemini):** issue nói model `Local / LAN AI`, không nhắc Cloud. Nếu `forceLocalOnly: false` và người dùng dùng provider online thì có ghi (với nhãn `online`) hay bỏ? Nên ghi vì đó chính là egress cần kiểm toán nhất; hoặc coi `enableAuditLogging` + provider online là cấu hình không hợp lệ/cảnh báo. Mô hình ghi: `provider` (`ollama` / `lan-ollama` / `lan-openai` / online), `model`, và với LAN có ghi host không (hay chỉ nhãn)?

### Nhóm D — Vận hành: xoay vòng, lưu giữ, vị trí, quyền đọc, lỗi

15. **Xoay vòng & lưu giữ:** kích thước tối đa mỗi tệp, số tệp/thời gian giữ (vd. mặc định 10 MB × N, hay theo ngày), có cấu hình qua policy (`auditLogMaxBytes`, `auditLogRetentionDays`) hay hằng số? Quy định ngành thường yêu cầu giữ nhiều năm — cơ chế xoay vòng có được XOÁ tệp cũ không, hay chỉ nén/lưu trữ (lưu trữ ngoài máy là việc IT)? App có cần công cụ/nút "xuất nhật ký" cho IT (CSV/JSONL đã ký) hay IT tự thu thập tệp?
16. **Vị trí & quyền đọc:** thư mục mặc định (gợi ý khác thư mục `logs` chẩn đoán 088: vd. `/Library/Application Support/SourceCraft/audit/` hay `%ProgramData%\SourceCraft\audit\` chỉ-admin-ghi; hoặc `<userData>/audit/`)? Nếu nằm trong `userData` thì người dùng xoá được; nếu thư mục hệ thống thì tiến trình người dùng thường KHÔNG ghi được. Ai đọc được (người dùng thường, admin, chỉ công cụ kiểm tra)? Có nằm ngoài vault để KHÔNG bị xoá/bị thay bởi khôi phục sao lưu (085 "thay toàn bộ") và KHÔNG bị gói vào bản sao lưu không? Gỡ cài đặt giữ hay xoá? Có cần công cụ kiểm tra tính toàn vẹn (CLI `scripts/verify-audit-log.mjs` như `issue-license.mjs`, hay màn hình trong app)?
17. **Khi không ghi được nhật ký (ổ đầy, quyền, thư mục bị xoá, khoá hỏng):** fail-closed (chặn lượt AI, ném `UserFacingError` mới với mã vi/en) hay fail-open (cho chạy, ghi log chẩn đoán + cảnh báo)? Với tuân thủ ngân hàng/y tế thường là fail-closed, nhưng làm app "đơ" khi đầy đĩa. Ghi TRƯỚC khi gọi LLM (write-ahead, chặn được) hay SAU khi có kết quả (đủ trích dẫn nhưng mất bản ghi nếu crash)? Hành vi khi app crash giữa lượt; khi phát hiện tệp bị sửa lúc khởi động (cảnh báo, vẫn chạy, hay khoá tính năng AI)? Đồng thời ghi bản ghi đặc biệt cho khoảng trống (sự kiện `audit.started`, `audit.stopped`, `audit.gap`) để tắt/bật không vô hình.
18. **Chỉ báo UI (privacy indicator, Constitution I):** có hiện biểu tượng/nhãn "Đang ghi nhật ký kiểm toán — theo chính sách của tổ chức" ở header/Cài đặt khi bật không? `PrivacyState` hiện chỉ có `local|lan|online|sending` — thêm cờ phụ (vd. `audit: true`) hay chỉ hiển thị ở Cài đặt (mục "Chính sách tổ chức")? Có cần i18n vi/en cho nhãn và lỗi. Nếu không có UI, có chấp nhận audit "vô hình" với người dùng?

### Nhóm E — Chính sách × bản quyền

19. **Cờ chính sách bật nhưng bản quyền không phải Enterprise** (Free/Pro, `expired`, `invalid`, `clockTampered`): (a) bỏ qua cờ âm thầm; (b) bỏ qua + hiện cảnh báo "cần Enterprise" (và/hoặc `upsell` 237); (c) chặn dùng AI. Thứ tự đánh giá: kiểm `FeatureGate` mỗi lần ghi (động, vì license đổi/hết hạn giữa phiên qua `license:changed`) hay một lần lúc khởi động như `PolicyService` (đang cache vĩnh viễn, đổi file cần khởi động lại)? Nếu bản quyền hết hạn giữa phiên, audit dừng ngay (và ghi `audit.stopped`) hay tiếp tục tới khi thoát?
20. **Cờ bản quyền nào mở khoá?** Tái dùng `itPolicy` (đã có, Enterprise), hay thêm cờ riêng (vd. `auditLog`) vào `LicenseFeature`, `DEFAULT_ENTERPRISE_FEATURES`, `scripts/issue-license.mjs` và `src/main/services/license/license-verifier.ts`? Thêm cờ mới cần cập nhật công cụ cấp phép và tương thích ngược với tệp `.sclicense` đã phát hành (chữ ký không đổi vì `features[]` tuỳ chọn, mặc định enterprise sẽ tự có). Có thay đổi `schemaVersion` của policy không (thêm khoá tuỳ chọn thì giữ `1`?).

### Nhóm F — Chi tiết khác

21. **Định danh người dùng:** "OS user account" lấy bằng `os.userInfo().username`? Windows có `DOMAIN\user`/SID, macOS có tên ngắn; tài khoản miền/AD? Có ghi tên máy (hostname), `policyId`, `licenseId`, phiên bản app để IT truy vết không (issue không liệt kê)?
22. **Hiệu năng & đồng thời:** nhiều cửa sổ/lượt song song (stream) ghi cùng tệp — tuần tự hoá ghi, độ trễ chấp nhận (ghi đồng bộ và fsync ảnh hưởng thời gian phản hồi đầu tiên).
23. **Lược đồ bản ghi:** định dạng JSON Lines có `schemaVersion`; dung lượng tối đa mỗi bản ghi (câu hỏi ≤ 2000 ký tự theo giới hạn rag-qa; trích dẫn tối đa 6/lượt nhưng toàn cục/Studio có thể nhiều hơn) — cắt hay từ chối?
24. **Xung đột với lịch sử chat:** người dùng "Xoá lịch sử chat" (027) không được xoá audit; xác nhận tách biệt hoàn toàn khỏi SQLite.

## Thuật ngữ mới (append vào glossary)

Tra `docs/00-glossary.md`: chưa có thuật ngữ audit. Lưu ý "Nhật ký" hiện đang chỉ nhật ký chẩn đoán (088) — thuật ngữ mới phải phân biệt rõ để tránh nhầm.

| Tiếng Việt                              | English (dùng trong code)             | 日本語 | Ghi chú                                                                                                |
| --------------------------------------- | ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Nhật ký kiểm toán                       | `AuditLog` / `audit`                  | —      | Tệp ghi lại tương tác AI phục vụ tuân thủ của tổ chức; KHÁC "Nhật ký" chẩn đoán (`app-log`, 088) — 236 |
| Bản ghi kiểm toán                       | `AuditRecord`                         | —      | 1 dòng nhật ký kiểm toán: thời điểm, tài khoản OS, câu hỏi, model, trích dẫn — 236                     |
| Bật nhật ký kiểm toán (khoá chính sách) | `enableAuditLogging`                  | —      | Khoá trong `enterprise-policy.json`; chỉ có hiệu lực với bản quyền Enterprise — 236                    |
| Chống giả mạo (phát hiện chỉnh sửa)     | `tamper-evident` / `tamper-resistant` | —      | Tính chất của nhật ký kiểm toán (ký/băm chuỗi/mã hoá) — 236                                            |
| Chuỗi băm nhật ký                       | `hashChain`                           | —      | (nếu được chốt) mỗi bản ghi chứa băm của bản ghi trước — 236                                           |
| Tài khoản người dùng hệ điều hành       | `osUser`                              | —      | Tài khoản OS chạy app, ghi trong `AuditRecord` — 236                                                   |
| Dịch vụ kiểm toán                       | `AuditService`                        | —      | Service ở `src/main/services/audit/` — 236                                                             |
| Xoay vòng nhật ký kiểm toán             | `auditLogRotation`                    | —      | Giới hạn kích thước/thời gian lưu giữ của tệp kiểm toán — 236                                          |

## Suggested constitution amendments

(Chỉ là đề xuất — mọi thay đổi constitution phải qua PR riêng được steward duyệt, rule 5 `CLAUDE.md`.)

1. **Principle III — làm rõ ngoại lệ có kiểm soát cho nội dung câu hỏi.** Hiện: "MUST NOT log nội dung tài liệu người dùng". Audit log do tổ chức bật có thể ghi câu hỏi (và tên tài liệu) — nên ghi rõ: nhật ký kiểm toán là kênh DUY NHẤT được phép ghi nội dung tương tác, chỉ khi (i) chính sách IT bật tường minh, (ii) có bản quyền Enterprise, (iii) chỉ ghi cục bộ, không bao giờ egress/đính kèm vào báo lỗi (093) hay gói chẩn đoán, (iv) mặc định bảo vệ bằng ký/mã hoá; và `redact` của nhật ký chẩn đoán (088) vẫn áp dụng cho `app-log`.
2. **Principle I — chỉ báo minh bạch.** Bổ sung: khi tổ chức bật ghi nhật ký kiểm toán, ứng dụng MUST hiển thị cho người dùng (privacy indicator hoặc mục chính sách tổ chức) rằng tương tác đang được ghi, để người dùng không bị theo dõi vô hình.
3. **Quy tắc chung "tính năng B2B phải kiểm tra bản quyền ở main tại thời điểm thực thi"** (kết hợp cờ chính sách × `FeatureGate`) — hiện chỉ có trong basic design 226/228, nên đưa vào Additional Constraints nếu steward đồng ý.
