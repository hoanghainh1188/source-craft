# Quy ước dự án cho AI agent

## Tổng quan

**SourceCraft** — ứng dụng desktop tổng hợp tri thức bằng AI **chạy cục bộ** (kiểu NotebookLM nhưng
offline/local-first). Người dùng nạp tài liệu vào các "notebook", app xử lý & lập chỉ mục ngay trên máy,
rồi hỏi đáp / tóm tắt bằng LLM local với **trích dẫn nguồn kiểm chứng được** (chip `[n]` → mở nguồn,
cuộn tới đúng đoạn highlight). Có tùy chọn dùng AI online bằng API key của chính người dùng.

- **Khách hàng / người dùng mục tiêu:** người xử lý nhiều tài liệu và coi trọng quyền riêng tư —
  nhà nghiên cứu, luật sư, nhà báo, sinh viên, kỹ sư (dữ liệu nhạy cảm, không muốn tải lên server bên thứ ba).
- **Ngôn ngữ tài liệu thiết kế gốc:** tiếng Việt. **UI:** Tiếng Việt + English (i18n #123 — khung `src/shared/i18n`,
  mọi chuỗi giao diện qua tệp dịch; tiếng Việt là ngôn ngữ nguồn).
- **Nền tảng (đã chốt):** desktop **Electron**, chạy **macOS + Windows**. Cộng đồng trước (miễn phí),
  freemium sau → kiến trúc "sẵn sàng thu phí" (tách tầng license/đồng bộ) nhưng **chưa xây** phần trả phí ở v1.
- **3 điểm khác biệt bất biến (không được đánh mất):** Local-first (dữ liệu không rời máy ở chế độ mặc định) ·
  Kiểm chứng được (mọi câu trả lời trích dẫn về đúng đoạn nguồn) · Offline & tự chủ (chạy không cần Internet).

**Nguồn sự thật GỐC (không sửa tay):**

- `docs/OVERVIEW.md` — brief sản phẩm cấp dự án (CÁI GÌ cần xây + ràng buộc bất biến).
- `docs/03-ui/prototype.html` — wireframe định hướng: 5 màn (Notebooks · Workspace 3 cột · Thêm nguồn ·
  Xem nguồn có highlight · Cài đặt). Chuẩn cho bố cục, luồng, văn phong UI.

**Hệ thống Repository & Quản trị Task:**

- **Repo Public (Core / App):** https://github.com/hoanghainh1188/source-craft (app chính, UI, cổng bản quyền, build/release, stub Pro)
- **Repo Private (Pro Modules):** https://github.com/hoanghainh1188/source-craft-pro (chỉ chứa phần cài đặt các module Pro)
- **GitHub Project Board (quản lý chung cả 2 repo):** https://github.com/users/hoanghainh1188/projects/8
- Kế hoạch chi tiết & quy tắc ranh giới: [`docs/pro-repo-split-plan.md`](docs/pro-repo-split-plan.md) và ADR [`docs/04-decisions/2026-10-25-pro-repo-split.md`](docs/04-decisions/2026-10-25-pro-repo-split.md).

## Tech stack

> Chốt qua ADR `docs/04-decisions/2026-07-10-tech-stack.md`. Sửa stack → cập nhật ADR đó, không sửa lén ở đây.

- **Shell:** Electron + electron-vite · **UI:** React 18 + TypeScript + Vite
- **State:** Zustand (client) + TanStack Query (bọc IPC như async source)
- **Metadata:** SQLite (better-sqlite3, chạy ở main process)
- **Vector store:** **LanceDB** (embedded, thư mục riêng trong data dir)
- **LLM/embedding local:** **Ollama** (HTTP local) qua `ProviderRegistry` (online provider hoán đổi sau cùng interface)
- **Trích dẫn/viewer:** pdf.js (text layer + toạ độ) để map chip `[n]` → trang/đoạn chính xác
- **Parsing:** pdf.js/pdf-parse · mammoth (.docx) · Readability + turndown (URL)
- **Secret (API key online):** keytar (OS keychain / Credential Manager) — không lưu plaintext
- **Packaging:** electron-builder (dmg + nsis); code-sign/notarize + auto-update để pha sau

**Ranh giới bảo mật (bất biến):** renderer `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`;
mọi truy cập FS/DB/model/mạng nằm ở **main process**, expose qua `preload` contextBridge whitelisted.
Mặc định **không có network egress**; chỉ khi bật provider online mới gọi ra ngoài + luôn hiện chỉ báo riêng tư.

**Cô lập theo feature:** `src/renderer/features/<slug>/` + `src/main/services/<slug>/`; dùng chung ở
`src/shared/` (types + IPC channel contract) và `src/renderer/shared/` (UI kit từ prototype).

> Khi đã chốt stack: điền lệnh formatter vào `.claude/hooks/format.sh` để bật format-on-save
> (PostToolUse hook chạy sau mỗi Edit/Write). Thứ tự chuẩn: format → lint → type check → build
> (lint/test/build chạy ở Test gate của `/design-to-code`).

## Cấu trúc và ý nghĩa từng phần

- **`docs/01-basic-design/`, `docs/02-detail-design/`, `docs/03-ui/`** — nguồn sự thật GỐC từ khách hàng.
  Đây là source of truth duy nhất. Agent KHÔNG BAO GIỜ sửa nội dung ở đây. Khi có bản mới, thêm file mới +
  CHANGELOG.md, không ghi đè.

- **`docs/00-glossary.md`** — thuật ngữ nghiệp vụ (Việt–Anh; cột 日本語 để `—` vì dự án không có nguồn Nhật). Mọi agent PHẢI tra file này trước khi đặt tên biến/field
  liên quan nghiệp vụ. Gặp thuật ngữ mới → **append** vào đây trước khi đặt tên (được làm ngay trong branch
  feature, xem rule 5), không tự dịch rồi bỏ qua.

- **`docs/04-decisions/`** — nơi lưu câu trả lời cho mọi ambiguity mà `/speckit-clarify` từng giải quyết.
  Trước khi hỏi lại 1 câu đã có trong đây, agent phải tra cứu trước.

- **`docs/intake/`** — output của subagent `design-intake`. Đây là cầu nối giữa tài liệu thiết kế (OVERVIEW / detail design / prototype / Figma) và Spec Kit.

- **`specs/<feature>/`** — do Spec Kit sinh (spec.md, plan.md, tasks.md). CÓ THỂ tái sinh, không chỉnh tay.
  Nếu sai, sửa docs/ gốc hoặc bổ sung docs/04-decisions/ rồi chạy lại pipeline.

- **`.specify/memory/constitution.md`** — nguyên tắc bất di bất dịch của dự án. Thắng mọi thứ khác trong workflow Spec Kit.

- **`src/`** — code thật. Agent bám theo pattern đã có, không tự đổi kiến trúc. **Cô lập theo feature:**
  code riêng của 1 feature nằm trong `src/features/<slug>/` (`<slug>` = phần slug của branch `NNN-<slug>`)
  → 2 feature chạy song song hiếm khi đụng cùng file. Chỉ chạm vùng dùng chung (`src/shared/`, config,
  router, DI container…) khi thật cần, và tách commit nhỏ để giảm merge conflict.
  Xem `docs/TEAM-WORKFLOW.md`.

## Cách chạy pipeline sinh code từ design

Gõ `/design-to-code` trong Claude Code, cung cấp đường dẫn tài liệu và prototype/link Figma khi được hỏi.

**Mô hình chạy:** `/design-to-code` là một _runbook điều phối_, KHÔNG tự gọi được các slash command
`/speckit-*` (Claude Code không cho command gọi command). Vì vậy:

- Bước dùng **subagent** (`design-intake`, `code-reviewer`) → command tự gọi qua Task tool.
- Bước dùng **Spec Kit** (`/speckit-specify|clarify|plan|tasks|analyze|implement`) → command in ra
  lệnh chính xác để **bạn tự dán và chạy**, rồi dừng chờ bạn báo xong.

Trình tự: design-intake → [handoff] specify → clarify → plan → tasks → analyze → implement
→ code-reviewer → glossary-steward → security-reviewer → **test gate** → **deploy**.
Dừng xin xác nhận ở mọi checkpoint.

## Deploy

Đây là **app desktop Electron** — "deploy" = đóng gói bản cài, không phải push server.

- **Build:** `npm run build` → `electron-builder` sinh `.dmg` (macOS) + `.exe`/NSIS (Windows).
- **v1:** phát hành thủ công (đưa artifact lên GitHub Releases). Chưa bật code-sign/notarize và auto-update
  (để pha sau — cần Apple Developer ID + Windows cert). Bước "deploy" v1 của `/design-to-code` = tạo bản
  đóng gói local để kiểm thử, không đẩy đi đâu.

## Quy tắc bắt buộc

1. Mọi mâu thuẫn giữa basic design / detail design / prototype UI (Figma nếu có) phải được nêu vào `/speckit-clarify`,
   không được tự chọn 1 bên và im lặng.
2. Mọi câu trả lời cho clarify phải được ghi vào `docs/04-decisions/`, không chỉ trả lời miệng trong chat.
3. `docs/intake/` và `specs/` được commit vào Git — bằng chứng agent đã hiểu đúng design tại thời điểm code được viết.
4. **Feature ID = số issue GitHub.** Branch đặt tên `NNN-<slug>` với `NNN` = số issue zero-pad tối thiểu
   3 chữ số (VD issue #42 → `042-user-reservation`). Không tự chọn số → tránh trùng khi nhiều người làm.
   (Thư mục `specs/` do Spec Kit sinh dùng tiền tố **timestamp** — bootstrap cấu hình sẵn; 2 lớp số
   không cần khớp, xem `docs/TEAM-WORKFLOW.md` mục 2.)
5. **Gác cổng file dùng chung** — phân biệt THÊM và SỬA để không kẹt giữa chừng:
   - **SỬA/đổi tên/xoá thuật ngữ đã có** trong `docs/00-glossary.md`, và **mọi thay đổi**
     `.specify/memory/constitution.md` → phải qua **PR riêng** được steward (code-owner) duyệt (blast
     radius lớn, đụng toàn dự án).
   - **THÊM thuật ngữ mới** (append 1 dòng) vào `docs/00-glossary.md` → **được làm ngay trong branch
     feature**; CODEOWNERS sẽ tự kéo steward review phần glossary khi mở PR. Không bị chặn giữa dòng.
6. **Chống lệch ngữ cảnh:** sync `main` trước khi bắt đầu feature; khi constitution/glossary vừa đổi trên
   `main`, rebase và **chạy lại `/speckit-analyze`** để bắt drift.

> Làm việc nhóm (nhiều người/1 dự án): xem đầy đủ ở [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md).
