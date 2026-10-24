# Intake — 230-enterprise-packaging

- Issue: #230 — "[feature] enterprise-packaging: Đóng gói triển khai doanh nghiệp, cài đặt tự động và Bộ công cụ Quản trị IT"
- Slug: `enterprise-packaging` (branch `230-enterprise-packaging`)
- Ngày intake: 2026-10-24
- Loại: tính năng triển khai & cấu hình đóng gói (Pha 4 của lộ trình B2B Enterprise Edition).
- Chạm các tầng: `electron-builder.yml` (cấu hình NSIS silent install, allUsers/perMachine), `deployment/` (bộ công cụ IT: Docker Compose LAN AI, template policy), `docs/` (Hướng dẫn Quản trị viên IT Triển khai Doanh nghiệp).

## Input sources

- [`docs/01-basic-design/enterprise-packaging/basic-design.md`](../01-basic-design/enterprise-packaging/basic-design.md) — **nguồn chính** (kiến trúc đóng gói doanh nghiệp, hỗ trợ silent install, IT deployment kit).
- [`docs/01-basic-design/enterprise-license/basic-design.md`](../01-basic-design/enterprise-license/basic-design.md) — cơ chế nạp giấy phép tự động.
- [`docs/01-basic-design/lan-ai-and-policy/basic-design.md`](../01-basic-design/lan-ai-and-policy/basic-design.md) — cơ chế nạp chính sách `enterprise-policy.json`.
- [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) — I (Local-first & No Default Egress), III (Desktop Security Boundary), IV (TDD & coverage ≥ 80%).

## Prompt for /speckit-specify

Xây dựng hệ thống **Đóng gói Triển khai Doanh nghiệp (`enterprise-packaging`)**:

1. **Cấu hình Đóng gói Cài đặt Tự động (Silent & Mass Deployment):**
   - Tối ưu hóa cấu hình `electron-builder.yml` để hỗ trợ bộ cài đặt Windows NSIS cho phép cài đặt diện rộng ở chế độ All Users (`perMachine`) hoặc Per-User, hỗ trợ tham số cài đặt ngầm (`/S`, `/allusers`).
   - Cung cấp tài liệu và tập lệnh đóng gói chuẩn hóa phục vụ phân phối qua Microsoft Intune, SCCM, Group Policy (GPO), và Jamf Pro trên macOS.

2. **Bộ Công cụ Quản trị IT (IT Administration Kit):**
   - Tệp chính sách mẫu `deployment/enterprise-policy.json.example` với đầy đủ các thiết lập kiểm soát: khóa Online AI bên ngoài (`disableExternalOnlineProviders`), ép mật khẩu mã hóa sao lưu (`requireBackupPassword`), và cấu hình mặc định máy chủ AI nội bộ (`lanAiServer`).
   - Mẫu triển khai máy chủ AI nội bộ `deployment/docker-compose.lan-ai.yml` cho Ollama và vLLM/OpenAI-compatible kèm Nginx reverse proxy bảo vệ bằng Bearer Token.

3. **Tài liệu Hướng dẫn Triển khai Doanh nghiệp:**
   - Soạn thảo tài liệu toàn diện `docs/enterprise-deployment-guide.md` hướng dẫn quản trị viên IT từ A-Z về phân phối ứng dụng, cấp phép bản quyền hàng loạt, thiết lập chính sách bảo mật và vận hành hạ tầng AI nội bộ.

## Ambiguities to raise in /speckit-clarify

0 ambiguities — các yêu cầu đóng gói, tham số silent install và hạ tầng AI nội bộ đã được định nghĩa thống nhất.

## Thuật ngữ mới (append vào glossary)

| Tiếng Việt | English (dùng trong code) | Ghi chú |
| --- | --- | --- |
| Cài đặt ngầm / tự động | `SilentInstall` | Cài đặt ứng dụng không cần tương tác giao diện qua cờ dòng lệnh `/S` — 230 |
| Bộ công cụ quản trị IT | `ItDeploymentKit` | Bộ tài liệu, tệp chính sách mẫu và Docker Compose phục vụ triển khai doanh nghiệp — 230 |
| Cài đặt diện rộng theo máy | `PerMachineInstall` | Cài đặt ứng dụng cho tất cả tài khoản người dùng trên một máy trạm (`Program Files`) — 230 |
