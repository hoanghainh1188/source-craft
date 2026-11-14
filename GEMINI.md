# Quy ước Dự án cho Gemini / Antigravity

Tài liệu này cung cấp ngữ cảnh cốt lõi để các AI agent (Antigravity, Gemini Code Assist, etc.) làm việc chính xác trong dự án SourceCraft.

## 1. Hệ thống Repository & Quản trị Task

- **Repo:** [source-craft](https://github.com/hoanghainh1188/source-craft) (toàn bộ app Electron, MIT — mọi chức năng miễn phí cho gói Free).
- **GitHub Project Board:** [SourceCraft Project #8](https://github.com/users/hoanghainh1188/projects/8).
- Repo private `source-craft-pro` đã gộp về đây và được archive (#261) — xem ADR [`docs/04-decisions/2026-11-14-merge-pro-into-free.md`](docs/04-decisions/2026-11-14-merge-pro-into-free.md).

## 2. Điểm khác biệt bất biến (Inviolable Principles)

1. **Local-first:** Dữ liệu tài liệu, index và vector store luôn ở trên máy người dùng ở chế độ mặc định. Không có network egress trừ khi người dùng chủ động cấu hình LLM online.
2. **Kiểm chứng được (Verifiable):** Mọi câu trả lời của AI trích dẫn nguồn qua chip `[n]`, click vào sẽ mở văn bản và highlight đúng đoạn nguồn gốc.
3. **Offline & Tự chủ:** Hoạt động hoàn toàn không cần Internet với local LLM (Ollama).

## 3. Ranh giới kiến trúc & Module chức năng nâng cao

- **`src/main/pro/`:** hàm thuần chạy ở Main Process (prompt Studio nâng cao, chế độ chuyên gia), không import Electron, không IPC, không gọi mạng. `available()` luôn `true`.
- **Freemium:** tắt bằng `FREEMIUM_ENABLED = false` (`src/shared/license-mode.ts`) — gói Free có mọi chức năng; khung bản quyền giữ để bật lại sau.
- **Feature ID & Branch:** Feature ID lấy theo số issue GitHub. Branch đặt tên `NNN-<slug>` (VD: `042-user-reservation`).

## 4. Tài liệu chi tiết & Quy chuẩn

- Quy ước phát triển đầy đủ: xem [`CLAUDE.md`](CLAUDE.md).
- Quy trình nhóm & Spec Kit: xem [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md).
