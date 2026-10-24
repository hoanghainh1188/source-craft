# Bảng Kiểm Tra Yêu Cầu (Requirements Checklist) — 230-enterprise-packaging

## Yêu cầu Triển khai & Đóng gói

- [ ] **CHK-01**: `electron-builder.yml` giữ cấu hình NSIS linh hoạt, hỗ trợ cả `perMachine: false` làm mặc định và tham số `/allusers` khi chạy ngầm.
- [ ] **CHK-02**: Tạo tệp `deployment/enterprise-policy.json.example` với đầy đủ các thuộc tính `orgName`, `licenseFilePath`, `disableExternalOnlineProviders`, `requireBackupPassword`, `lanAiServer`.
- [ ] **CHK-03**: Tạo tệp `deployment/docker-compose.lan-ai.yml` cấu hình Ollama và Nginx reverse proxy bảo vệ bằng Bearer Token.
- [ ] **CHK-04**: Soạn thảo tài liệu `docs/enterprise-deployment-guide.md` với các hướng dẫn chi tiết cho IT Admin:
  - Hướng dẫn cài đặt tự động ngầm qua Microsoft Intune, GPO và Jamf Pro.
  - Hướng dẫn cấu hình chính sách bảo mật hệ thống.
  - Hướng dẫn cấp phát tệp bản quyền `.sclicense`.
  - Hướng dẫn thiết lập máy chủ AI nội bộ (Ollama & vLLM).
- [ ] **CHK-05**: Kiểm thử tính toàn vẹn của tệp cấu hình mẫu và tài liệu hướng dẫn thông qua unit test hoặc validation script.
