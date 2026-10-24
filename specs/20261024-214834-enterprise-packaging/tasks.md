# Danh sách Công việc (Tasks Breakdown) — 230-enterprise-packaging

## Giai đoạn 1: Chuẩn bị & Cấu hình Đóng gói
- [ ] Task 1.1: Rà soát `electron-builder.yml` đảm bảo tính tương thích với tham số silent install.
- [ ] Task 1.2: Tạo thư mục `deployment/` chứa bộ công cụ quản trị viên.

## Giai đoạn 2: Tạo Bộ Tài nguyên Quản trị IT
- [ ] Task 2.1: Tạo `deployment/enterprise-policy.json.example` với đầy đủ chú thích và mẫu cấu hình.
- [ ] Task 2.2: Tạo `deployment/docker-compose.lan-ai.yml` cấu hình Ollama và vLLM service.
- [ ] Task 2.3: Tạo `deployment/nginx-lan-ai.conf` cho reverse proxy xác thực Bearer token mạng nội bộ.

## Giai đoạn 3: Soạn thảo Tài liệu Triển khai Doanh nghiệp
- [ ] Task 3.1: Soạn thảo `docs/enterprise-deployment-guide.md` chi tiết từ A-Z.
- [ ] Task 3.2: Viết bài test xác thực tính hợp lệ của tệp chính sách mẫu (`tests/unit/policy/policy-example.test.ts`).

## Giai đoạn 4: Kiểm thử & Đóng gói
- [ ] Task 4.1: Chạy `python3 .github/scripts/check-template.py`.
- [ ] Task 4.2: Chạy `npm run lint` và `npm test`.
- [ ] Task 4.3: Chạy `npm run build`.
- [ ] Task 4.4: Commit, push nhánh và tạo Pull Request #230.
