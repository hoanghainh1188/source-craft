# Quy ước Dự án cho Gemini / Antigravity

Tài liệu này cung cấp ngữ cảnh cốt lõi để các AI agent (Antigravity, Gemini Code Assist, etc.) làm việc chính xác trong dự án SourceCraft.

## 1. Hệ thống Repository & Quản trị Task

- **Repo Public (Core & App):** [source-craft](https://github.com/hoanghainh1188/source-craft) (chứa app chính Electron, UI, IPC, build/release, cổng bản quyền và stub cho bản Pro).
- **Repo Private (Pro Modules):** [source-craft-pro](https://github.com/hoanghainh1188/source-craft-pro) (chỉ chứa mã cài đặt thuần cho các tính năng Pro, không có UI/build).
- **GitHub Project Board (Quản lý chung cả 2 repo):** [SourceCraft Project #8](https://github.com/users/hoanghainh1188/projects/8).
- **Mô hình kiến trúc 2 repo:** Chi tiết xem tại [`docs/pro-repo-split-plan.md`](docs/pro-repo-split-plan.md) và ADR [`docs/04-decisions/2026-10-25-pro-repo-split.md`](docs/04-decisions/2026-10-25-pro-repo-split.md).

## 2. Điểm khác biệt bất biến (Inviolable Principles)

1. **Local-first:** Dữ liệu tài liệu, index và vector store luôn ở trên máy người dùng ở chế độ mặc định. Không có network egress trừ khi người dùng chủ động cấu hình LLM online.
2. **Kiểm chứng được (Verifiable):** Mọi câu trả lời của AI trích dẫn nguồn qua chip `[n]`, click vào sẽ mở văn bản và highlight đúng đoạn nguồn gốc.
3. **Offline & Tự chủ:** Hoạt động hoàn toàn không cần Internet với local LLM (Ollama).

## 3. Ranh giới kiến trúc & Module Pro

- **Quy tắc ranh giới Pro:** Các module ở repo Pro là các hàm thuần chạy ở Main Process, nhận dữ liệu và trả kết quả, không import trực tiếp Electron, không gọi IPC, không gọi mạng.
- **Stub ở repo public:** `src/main/pro/` đóng vai trò stub (MIT), cùng chữ ký hàm nhưng `available() = false`.
- **Feature ID & Branch:** Feature ID lấy theo số issue GitHub ở repo public. Branch đặt tên `NNN-<slug>` (VD: `042-user-reservation`), dùng chung tên branch ở cả hai repo.

## 4. Tài liệu chi tiết & Quy chuẩn

- Quy ước phát triển đầy đủ: xem [`CLAUDE.md`](CLAUDE.md).
- Quy trình nhóm & Spec Kit: xem [`docs/TEAM-WORKFLOW.md`](docs/TEAM-WORKFLOW.md).
