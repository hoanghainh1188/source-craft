# Kế hoạch Thực hiện (Execution Plan) — 230-enterprise-packaging

## 1. Mục tiêu Cần Đạt

Cung cấp đầy đủ cấu hình đóng gói tự động và bộ công cụ triển khai dành cho IT Administrator của các doanh nghiệp sử dụng SourceCraft Enterprise.

## 2. Các Bước Triển khai Chi tiết

1. **Bước 1 — Xác thực & Tinh chỉnh cấu hình Đóng gói (`electron-builder.yml`)**:
   - Kiểm tra các thiết lập `nsis` trong `electron-builder.yml` đảm bảo hỗ trợ đầy đủ `multiLanguageInstaller`, `perMachine`, và tham số cài đặt silent.

2. **Bước 2 — Xây dựng Bộ Tài nguyên IT Deployment (`deployment/`)**:
   - Tạo file `deployment/enterprise-policy.json.example`.
   - Tạo file `deployment/docker-compose.lan-ai.yml` cấu hình Ollama / vLLM kèm reverse proxy token.
   - Tạo file `deployment/nginx-lan-ai.conf` cấu hình Nginx kiểm tra Bearer token.

3. **Bước 3 — Soạn thảo Tài liệu Hướng dẫn Quản trị IT (`docs/enterprise-deployment-guide.md`)**:
   - Hướng dẫn cài đặt silent qua Intune/GPO/Jamf.
   - Hướng dẫn cấu hình chính sách và phân phối tệp bản quyền.
   - Hướng dẫn thiết lập máy chủ AI GPU nội bộ.

4. **Bước 4 — Kiểm thử & Xác thực**:
   - Viết unit test kiểm tra tính hợp lệ cú pháp của tệp cấu hình mẫu và tính toàn vẹn của bộ công cụ deployment.
   - Chạy `check-template.py`, `npm run lint`, `npm test`, `npm run build`.

5. **Bước 5 — Đóng gói & Tạo PR**:
   - Tạo commit, push nhánh và mở Pull Request trên GitHub.
