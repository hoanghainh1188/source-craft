# Tasks: branded-export-docx-pdf

- [ ] Task 1: Định nghĩa kiểu dữ liệu `ExportFormat`, `BrandedExportOptions` và cờ `brandedExport`.
- [ ] Task 2: Cập nhật `feature-gate.ts`, `license-verifier.ts`, `scripts/issue-license.mjs` với `brandedExport`.
- [ ] Task 3: Bổ sung mã lỗi `licenseRequireProExport` và từ điển dịch thuật tiếng Việt / tiếng Anh.
- [ ] Task 4: Triển khai module sinh file DOCX chuẩn `docx-generator.ts`.
- [ ] Task 5: Triển khai module sinh file PDF `pdf-generator.ts`.
- [ ] Task 6: Tích hợp logic xuất tài liệu đa định dạng và gating trong `export.ts` và `register.ts`.
- [ ] Task 7: Cập nhật giao diện `StudioResultCard.tsx` hỗ trợ menu chọn định dạng và kết nối modal nâng cấp bản quyền.
- [ ] Task 8: Viết unit tests kiểm thử bộ sinh DOCX/PDF và IPC gating.
- [ ] Task 9: Chạy toàn bộ kiểm thử, lint và đóng gói build.
