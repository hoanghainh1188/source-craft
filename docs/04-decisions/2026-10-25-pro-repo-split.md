# Tách chức năng Pro sang repo riêng (mô hình stub như Sheafly)

- Ngày: 2026-10-25
- Feature liên quan: `248-pro-repo-split` (issue #248). Kế hoạch chi tiết: [`docs/pro-repo-split-plan.md`](../pro-repo-split-plan.md).
- Trạng thái: **Đã chấp nhận** — chủ dự án (Harry Nguyen) trả lời Q1–Q7 qua bảng câu hỏi ngày 2026-10-25. Sửa lại cùng ngày:
  **Q7** (sau khi PR A audit log #249 đã merge), rồi **Q2, Q5, Q6** khi chủ dự án chọn làm theo cách của Sheafly
  (`sheafly` + `sheafly-pro`): repo Pro chỉ là nơi có code, build và phát hành vẫn ở repo public.
- Bối cảnh: repo `hoanghainh1188/source-craft` public, giấy phép MIT, đang chứa mã chức năng trả phí; cổng bản quyền chỉ nằm
  trong code nên fork là gỡ được.

## Quyết định

1. **Q1 — Phạm vi bảo vệ:** chỉ bảo vệ mã Pro **viết từ nay** (và bản cải tiến của mã cũ). **Không** viết lại lịch sử git;
   mã Pro đã public trước đây vẫn thuộc MIT.
2. **Q2 — Mô hình** (sửa lại, thay "open-core + extension API, core là submodule"): theo **Sheafly**.
   - Repo public có **stub** `src/main/pro/`: cùng tên hàm, cùng chữ ký, cùng phụ thuộc với bản thật; mỗi hàm trả
     `unavailable(lang)`, `available()` = false. App build được chỉ từ repo public.
   - Repo private `source-craft-pro` chỉ chứa **cài đặt** các hàm đó + test. Module Pro là hàm thuần ở main process: không
     Electron, không IPC, không UI, không tự gọi mạng.
   - Cổng bản quyền, IPC, preload, UI, i18n, kiểu/id dữ liệu, migration DB ở lại repo public. Không làm extension API.
   - `api-types.test.ts` và `deps.json` giống hệt ở hai repo, `check-stub.mjs` so khớp.
3. **Q3 — Hạn mức:** **giữ** hạn mức gói Free hiện tại (3 notebook, 10 nguồn/notebook, 15 phút ghi cuộc họp). Sửa thông điệp
   "unlimited" trong README/OVERVIEW cho khớp.
4. **Q4 — Studio của bản stub:** chỉ **`summary` và `keyPoints`**. Prompt các loại khác (`faq`, `outline`, `studyGuide`,
   `briefing`, `timeline`, `keyTerms`, `custom`, `documentDiff`) dời sang repo Pro.
5. **Q5 — Build & phát hành** (sửa lại): **ở repo public.** `release.yml` thêm job `pro` dùng deploy key chỉ-đọc
   `SOURCECRAFT_PRO_DEPLOY_KEY` để lấy một commit của repo Pro và chép đè stub trước khi build. Tag `v*` thiếu key ⇒ fail;
   chạy tay / fork thiếu key ⇒ build bằng stub. Không upload mã Pro thành artifact. Phần Pro biên dịch sang V8 bytecode
   (`bytecodePlugin`), không sourcemap. Bản phát hành chính thức luôn có Pro; chưa có bản quyền ⇒ chạy như gói Free.
6. **Q6 — Issue & branch** (sửa lại): issue và Spec Kit ở **repo public**; branch `NNN-slug` theo issue repo public, **cùng tên
   ở cả hai repo** khi đợt đó có mã Pro. CI repo Pro test với branch cùng tên của repo public (không có thì `main`).
7. **Q7 — Audit log (#236)** (sửa lại): PR A (#249) đã merge vào `main` public trước khi đóng băng ⇒ **tạm ở lại public** (mã
   MIT theo Q1). Lõi audit (định dạng bản ghi, chuỗi băm, ký, mã hoá câu hỏi) **dời sang repo Pro ở đợt 4**, I/O qua
   `AuditFs`/keystore do core truyền vào. **PR B** (CLI audit) **không merge vào repo public**; làm ở repo Pro.
   - **Ghi nhận sai lệch (2026-10-25):** PR B (#253) vẫn bị làm và merge vào `main` public, trái quyết định trên (PR C #254
     — UI, IPC, i18n, tài liệu — đúng ranh giới 4.1 nên không vi phạm). Chủ dự án **giữ nguyên Q7**: CLI audit
     (`src/main/services/audit/cli/` — verify, decrypt, keygen, report-text, run-cli) **dời sang repo Pro ở đợt 4 cùng lõi
     audit**; core giữ phần rẽ nhánh dòng lệnh ở `main/index.ts`, `cli-args.ts` (phân tích tham số) và I/O `node-cli-fs.ts`,
     gọi `pro.*`. Bản stub: lệnh `--audit-*` in thông báo không có chức năng Pro, mã thoát 2. Theo Q1, mã CLI đã nằm trong
     lịch sử git public; việc dời chỉ bảo vệ các thay đổi về sau.

## Hệ quả

- Từ nay **không đưa mã Pro mới vào repo public**.
- Chỉ dời phần có giá trị cần giấu (prompt Studio Pro, chế độ chuyên gia, bộ dựng DOCX/PDF, lõi audit). LAN AI, tìm kiếm toàn
  cục, đa phương tiện, IT policy là mã nối ⇒ ở lại public, chỉ giữ cổng bản quyền.
- Script cấp bản quyền `scripts/issue-license.mjs` dời sang repo Pro; verifier + khoá công khai ở lại public.
- Chủ dự án tạo repo private `source-craft-pro` và deploy key chỉ-đọc (secret `SOURCECRAFT_PRO_DEPLOY_KEY` ở repo public).
- Khi bắt đầu: cập nhật ADR tech-stack (`2026-07-10-tech-stack.md`), `CLAUDE.md` (stub `src/main/pro/`, quy tắc ranh giới,
  branch cùng tên) và `docs/TEAM-WORKFLOW.md`.
