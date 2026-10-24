---
title: "Đóng gói Triển khai Doanh nghiệp & Bộ công cụ Quản trị IT"
slug: enterprise-packaging
created_at: 2026-10-24T21:48:34+07:00
updated_at: 2026-10-24T21:48:34+07:00
status: planned
tags:
  - enterprise
  - packaging
  - deployment
  - it-policy
---

# Đặc tả Kỹ thuật: Đóng gói Triển khai Doanh nghiệp (`enterprise-packaging`)

## 1. Tóm tắt

Cung cấp cơ chế đóng gói bộ cài đặt tương thích với quy trình triển khai doanh nghiệp quy mô lớn (Silent Install, All-users mode) và bộ tài nguyên quản trị IT (IT Administration Kit) bao gồm cấu hình mẫu `enterprise-policy.json.example`, mẫu Docker Compose triển khai LAN AI Server nội bộ, và tài liệu hướng dẫn triển khai toàn diện.

## 2. Yêu cầu Chức năng

- **FR-01 (Installer Configuration)**: Bộ cài đặt NSIS trên Windows hỗ trợ cài đặt ở chế độ per-machine thông qua các tham số dòng lệnh `/S`, `/allusers` mà không hiển thị giao diện wizard khi chạy ngầm.
- **FR-02 (Policy Template)**: Cung cấp tệp mẫu `deployment/enterprise-policy.json.example` thể hiện tất cả các quy tắc chính sách IT có thể áp dụng cho SourceCraft.
- **FR-03 (LAN AI Server Kit)**: Cung cấp mẫu `deployment/docker-compose.lan-ai.yml` để IT Admin dựng nhanh máy chủ Ollama / vLLM nội bộ kèm reverse proxy bảo vệ bằng token xác thực.
- **FR-04 (Administrator Documentation)**: Cung cấp tài liệu `docs/enterprise-deployment-guide.md` hướng dẫn chi tiết từ cài đặt, quản trị chính sách, cấp bản quyền offline đến vận hành máy chủ AI mạng nội bộ.

## 3. Ranh giới Bảo mật & Bất biến

- Không làm thay đổi hành vi cài đặt mặc định của người dùng cá nhân (per-user vẫn là tùy chọn mặc định nếu không truyền cờ dòng lệnh quản trị).
- Toàn bộ kịch bản triển khai AI Server hoạt động hoàn toàn trong mạng nội bộ (On-premises / Intranet), tuân thủ nguyên tắc Local-first & Zero Cloud Egress.
