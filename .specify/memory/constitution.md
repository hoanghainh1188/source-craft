<!--
SYNC IMPACT REPORT (1.1.0 — 2026-10-25, #236 T080)
- Version change: 1.0.0 → 1.1.0 (MINOR — mở rộng 2 nguyên tắc, không định nghĩa lại)
- Modified principles:
    I.   Local-first & No Default Egress — thêm: tổ chức bật nhật ký kiểm toán ⇒ MUST hiển thị thường trực
         cho người dùng; nhật ký không tự gửi qua mạng
    III. Desktop Security Boundary — thêm: ngoại lệ có kiểm soát cho nhật ký kiểm toán do tổ chức bật
         (câu hỏi mã hoá, không câu trả lời/nội dung tài liệu, tách khỏi log chẩn đoán/báo lỗi/sao lưu)
- Added / removed sections: none
- Templates reviewed for alignment:
    ✅ .specify/templates/plan-template.md  (Constitution Check chỉ trỏ tới file này — không cần đổi)
    ✅ .specify/templates/spec-template.md  (không đổi)
    ✅ .specify/templates/tasks-template.md (không đổi)
- Đã tuân thủ sẵn: #236 (PR A–C) — xem specs/20261025-081207-enterprise-audit-log/plan.md › Complexity Tracking
- Deferred TODOs: none

SYNC IMPACT REPORT (1.0.0)
- Version change: (template/unversioned) → 1.0.0
- Ratification: initial adoption 2026-07-10
- Modified principles: N/A (initial creation)
- Added principles:
    I.   Local-first & No Default Egress (NON-NEGOTIABLE)
    II.  Verifiable Citations (NON-NEGOTIABLE)
    III. Desktop Security Boundary (NON-NEGOTIABLE)
    IV.  Test-First & Coverage (NON-NEGOTIABLE)
    V.   Phased Delivery
- Added sections:
    Additional Constraints (Source-of-truth, Terminology, Intake, ADR-governed stack)
    Development Workflow & Quality Gates
    Governance
- Templates reviewed for alignment:
    ✅ .specify/templates/plan-template.md  (Constitution Check gate — principles map cleanly)
    ✅ .specify/templates/spec-template.md  (no mandatory-section change required)
    ✅ .specify/templates/tasks-template.md (TDD/test-first task ordering already supported)
    ✅ .claude/commands/design-to-code.md   (runbook already encodes the workflow herein)
- Deferred TODOs: none
-->

# InsightVault Constitution

InsightVault là ứng dụng desktop tổng hợp tri thức bằng AI **chạy cục bộ** (kiểu NotebookLM offline).
Hiến pháp này định nghĩa các nguyên tắc bất di bất dịch của dự án. Nó **thắng** mọi thực hành khác
trong workflow Spec Kit. Nguồn gốc: `docs/OVERVIEW.md` (ràng buộc bất biến) và
`docs/04-decisions/2026-07-10-tech-stack.md` (ADR stack/kiến trúc).

## Core Principles

### I. Local-first & No Default Egress (NON-NEGOTIABLE)

Dữ liệu người dùng **KHÔNG rời máy ở chế độ mặc định** — đây là lý do sản phẩm tồn tại.

- App MUST chạy đầy đủ chức năng lõi (nạp nguồn, lập chỉ mục, hỏi đáp có trích dẫn) **offline**,
  không phụ thuộc bất kỳ dịch vụ mạng nào.
- MUST NOT gửi telemetry/analytics chứa nội dung tài liệu, câu hỏi, hay đoạn nguồn ra ngoài,
  trừ khi người dùng yêu cầu tường minh.
- AI online là **opt-in**, dùng API key của chính người dùng; khi bật, chỉ dữ liệu cần thiết cho
  request (câu hỏi + đoạn nguồn liên quan) mới được gửi tới provider người dùng đã chọn.
- **Privacy indicator** MUST luôn phản ánh đúng trạng thái hiện tại (đang chạy cục bộ ↔ đang gửi
  dữ liệu ra ngoài). Không được để trạng thái hiển thị lệch với hành vi thực.
- Khi **tổ chức** bật ghi lại hoạt động của người dùng (VD nhật ký kiểm toán), app MUST hiển thị điều đó
  **thường trực** cho người dùng (chỉ báo trên giao diện chính + mục Cài đặt chỉ đọc), nêu rõ gì được ghi
  và gì không. Bản ghi chỉ nằm ở máy trạm hoặc thư mục do tổ chức chỉ định; app MUST NOT tự gửi chúng qua
  mạng — việc thu thập thuộc về bộ phận IT.

*Rationale:* người dùng mục tiêu (luật sư, nhà báo, nhà nghiên cứu) xử lý dữ liệu nhạy cảm; đánh mất
tính local-first là đánh mất sản phẩm.

### II. Verifiable Citations (NON-NEGOTIABLE)

Mọi câu trả lời phải **kiểm chứng được** về đúng nguồn gốc.

- Mỗi `chunk` MUST giữ **locator** ngay tại thời điểm tạo (`{page,char_start,char_end}` cho PDF/text,
  `{timestamp}` cho audio/video, `{bbox}` cho ảnh). **Cấm** tái tạo/ước lượng locator sau khi chunk.
- Chip trích dẫn `[n]` MUST map xác định `n → chunk_id → source + locator`; màn Xem nguồn MUST cuộn tới
  và highlight đúng đoạn đó.
- Chế độ **theo nguồn** (mặc định): chỉ trả lời từ tài liệu, luôn kèm trích dẫn; không có căn cứ trong
  nguồn thì MUST báo "không tìm thấy trong nguồn" — **không được bịa**.
- Chế độ **mở rộng**: được dùng kiến thức chung, nhưng phần không lấy từ tài liệu MUST gắn nhãn
  "không dựa trên nguồn".

*Rationale:* "kiểm chứng được" là cam kết lõi; một trích dẫn sai vị trí phá vỡ niềm tin toàn bộ sản phẩm.

### III. Desktop Security Boundary (NON-NEGOTIABLE)

Cách ly tiến trình đúng chuẩn Electron.

- Renderer MUST chạy `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`.
- Mọi truy cập filesystem / DB / model / mạng MUST nằm ở **main process**, expose ra renderer qua
  `preload` contextBridge với danh sách IPC channel **whitelisted**. Tài liệu & vector thô MUST NOT
  đi qua renderer dưới dạng nội dung đầy đủ.
- API key online MUST lưu bằng OS keychain (keytar) — **không plaintext**, không nằm trong SQLite/JSON.
- MUST NOT log nội dung tài liệu người dùng.
- **Ngoại lệ có kiểm soát — nhật ký kiểm toán do tổ chức bật:** chỉ khi chính sách **cấp hệ thống** bật và
  bản quyền cho phép, app được ghi câu hỏi người dùng gửi AI, tên nguồn được trích dẫn và siêu dữ liệu của
  lượt (thời điểm, tài khoản OS, mô hình). Điều kiện bắt buộc: câu hỏi MUST được mã hoá bằng khoá công khai
  của tổ chức (máy trạm không đọc lại được); MUST NOT ghi câu trả lời hay nội dung tài liệu; nhật ký MUST
  tách khỏi log chẩn đoán, báo lỗi và bản sao lưu; khoá ký nằm trong OS keychain; renderer chỉ đọc
  **trạng thái**, không đọc/ghi/bật/tắt nhật ký. Ngoài ngoại lệ này, cấm log nội dung vẫn áp dụng nguyên vẹn.

*Rationale:* app xử lý dữ liệu nhạy cảm cục bộ; một renderer bị XSS không được phép chạm tới ổ đĩa/khoá.

### IV. Test-First & Coverage (NON-NEGOTIABLE)

- Business logic mới MUST đi theo TDD: viết test trước (RED) → implement (GREEN) → refactor.
- Coverage tối thiểu **80%** trên phần business logic (không tính scaffolding / code generated /
  file cấu hình).
- **Test gate** MUST đòi `lint` + `test` + `build` xanh **VÀ** đạt ngưỡng coverage trước khi merge/deploy.
  Cách đo coverage tuỳ stack (điền lệnh cụ thể vào script test/CI) nhưng ngưỡng 80% là bất biến.

*Rationale:* pipeline sinh code theo spec cần lưới an toàn tự động để bắt hồi quy khi nhiều feature chạy song song.

### V. Phased Delivery

- Xây theo pha, **không nhảy cóc**. MUST NOT làm Pha 2 (audio/video, hình ảnh) trước khi lõi Pha 1
  (notebook → ingestion → RAG hỏi đáp + trích dẫn) chạy ổn.
- Thứ tự build bám theo dependency đã chốt ở ADR `2026-07-10-tech-stack.md` (D8):
  `app-shell → ai-runtime → notebooks → ingestion → rag-qa → source-viewer → studio → online-provider`.

*Rationale:* giá trị cốt lõi nằm ở vòng hỏi-đáp-trích-dẫn; phân tán sức sang Pha 2 sớm làm loãng chất lượng lõi.

## Additional Constraints

- **Source-of-truth precedence:** khi mâu thuẫn giữa `docs/OVERVIEW.md`, prototype UI
  (`docs/03-ui/prototype.html`), và detail design → **KHÔNG tự chọn 1 bên**. MUST nêu vào
  `/speckit-clarify`, và câu trả lời MUST được ghi vào `docs/04-decisions/` (+ append `INDEX.md`).
- **Terminology fidelity:** MUST tra `docs/00-glossary.md` trước khi đặt tên biến/field/type/IPC channel
  liên quan nghiệp vụ. Gặp thuật ngữ mới → append vào glossary trước khi đặt tên. Cấm tự dịch generic
  không đối chiếu glossary.
- **Intake artifact requirement:** feature có tài liệu/prototype MUST đi qua subagent `design-intake`
  (sinh `docs/intake/<NNN>-<slug>.md`) trước `/speckit-specify`, để mọi spec có traceability ngược
  về tài liệu gốc.
- **ADR-governed stack:** tech stack và kiến trúc nền do ADR `docs/04-decisions/2026-07-10-tech-stack.md`
  quy định (Electron+React+TS, SQLite metadata, LanceDB vectors, Ollama local qua ProviderRegistry,
  pdf.js cho trích dẫn, keytar cho secret). Đổi stack MUST cập nhật ADR đó — không sửa lén trong code/CLAUDE.md.

## Development Workflow & Quality Gates

- Chạy theo runbook `/design-to-code`:
  `design-intake → specify → clarify → plan → tasks → analyze → implement → code-reviewer →
  glossary-steward → security-reviewer → test gate → deploy`. Dừng xin xác nhận ở mọi checkpoint.
- **Feature ID = số issue GitHub**; branch `NNN-<slug>` (zero-pad ≥ 3 chữ số). Cô lập code theo feature:
  `src/main/services/<slug>/` + `src/renderer/features/<slug>/`; chỉ chạm `src/shared/` khi thật cần.
- **Security review** MUST chạy cho mọi feature đụng dữ liệu người dùng / khoá API / IPC / mạng
  (Principle I & III). Mọi **Blocking** phải xử lý trước test gate.
- Đồng bộ `main` trước khi bắt đầu feature; khi constitution/glossary đổi trên `main` → rebase và
  chạy lại `/speckit-analyze` để bắt drift.

## Governance

- Hiến pháp này **thắng** mọi thực hành khác trong workflow Spec Kit. Khi có xung đột, các nguyên tắc
  NON-NEGOTIABLE (I–IV) không được nhân nhượng vì tiến độ.
- **Sửa đổi** constitution phải qua **PR riêng được steward (code-owner) duyệt** (rule 5 `CLAUDE.md`),
  kèm mô tả tác động và cập nhật version.
- **Versioning (semver):** MAJOR = xoá/định nghĩa lại nguyên tắc theo hướng phá vỡ tương thích;
  MINOR = thêm nguyên tắc/mục hoặc mở rộng đáng kể; PATCH = làm rõ câu chữ, sửa lỗi không đổi ngữ nghĩa.
- **Compliance:** mọi PR MUST verify tuân thủ các nguyên tắc trên; `/speckit-analyze` và `code-reviewer`
  dùng file này làm chuẩn đối chiếu. Vi phạm NON-NEGOTIABLE là điều kiện **Block** merge.

**Version**: 1.1.0 | **Ratified**: 2026-07-10 | **Last Amended**: 2026-10-25
