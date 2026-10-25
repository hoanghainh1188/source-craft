# Tách chức năng Pro sang repo riêng (open-core)

- Ngày: 2026-10-25
- Feature liên quan: `248-pro-repo-split` (issue #248). Kế hoạch chi tiết: [`docs/pro-repo-split-plan.md`](../pro-repo-split-plan.md).
- Trạng thái: **Đã chấp nhận** — chủ dự án (Harry Nguyen) trả lời Q1–Q7 qua bảng câu hỏi ngày 2026-10-25; **Q7 sửa lại**
  cùng ngày sau khi PR A của audit log (#249) đã merge vào `main` public.
- Bối cảnh: repo `hoanghainh1188/source-craft` public, giấy phép MIT, đang chứa mã chức năng trả phí; cổng bản quyền chỉ nằm
  trong code nên fork là gỡ được.

## Quyết định

1. **Q1 — Phạm vi bảo vệ:** chỉ bảo vệ mã Pro **viết từ nay** (và bản cải tiến của mã cũ). **Không** viết lại lịch sử git;
   mã Pro đã public trước đây vẫn thuộc MIT.
2. **Q2 — Mô hình:** **open-core + extension API.** Repo public (core) giữ là app, thêm các điểm cắm (registry phía main,
   slot phía renderer, whitelist kênh IPC sinh lúc build). Repo private `source-craft-pro` chứa package Pro và gắn core bằng
   **git submodule theo tag**. Hợp đồng (id loại Studio, cờ bản quyền, tên kênh) và cổng bản quyền ở core; phần cài đặt ở
   repo Pro.
3. **Q3 — Hạn mức bản Community:** **giữ** hạn mức gói Free hiện tại (3 notebook, 10 nguồn/notebook, 15 phút ghi cuộc họp).
   Sửa thông điệp "unlimited" trong README/OVERVIEW cho khớp.
4. **Q4 — Studio của bản Community:** chỉ **`summary` và `keyPoints`**. Mọi loại khác (`faq`, `outline`, `studyGuide`,
   `briefing`, `timeline`, `keyTerms`, `custom`, `documentDiff`) dời sang repo Pro.
5. **Q5 — Phát hành:** **bản Pro là bản chính** cho người dùng cuối (chưa có bản quyền ⇒ chạy như gói Free). Bản Community
   để cộng đồng tự build từ repo public; không bắt buộc phát hành bộ cài Community.
6. **Q6 — Issue & đánh số:** issue chức năng Pro đặt ở **repo Pro**, branch `pro-NNN-slug` (NNN = số issue repo Pro) để không
   trùng số với core. Issue về điểm cắm/hợp đồng ở core vẫn ở repo public theo `NNN-slug`.
7. **Q7 — Audit log (#236)** (sửa lại): PR A (#249, lõi ghi + fail-closed, `src/main/services/audit/`) đã merge vào `main`
   public trước khi đóng băng ⇒ **tạm ở lại core**, theo Q1 phần này là mã MIT. **Dời sang repo Pro ở giai đoạn 2** cùng LAN AI,
   xuất DOCX/PDF, IT policy. **PR B** (CLI audit, đang làm ở worktree `source-craft-236-audit`) **không merge vào repo public**;
   làm tiếp ở repo Pro sau giai đoạn 1.

## Hệ quả

- Từ nay **không đưa mã Pro mới vào repo public** (đóng băng ở giai đoạn 0 của kế hoạch).
- `custom` không còn ở bản Community ⇒ gói Free trong bản Pro giữ nguyên hành vi hiện tại (`summary`, `keyPoints`).
- Script cấp bản quyền `scripts/issue-license.mjs` dời sang repo Pro; verifier + khoá công khai ở lại core.
- Khi bắt đầu: cập nhật ADR tech-stack (`2026-07-10-tech-stack.md`), `CLAUDE.md` (cấu trúc 2 repo, quy ước branch
  `pro-NNN`) và `docs/TEAM-WORKFLOW.md`.
