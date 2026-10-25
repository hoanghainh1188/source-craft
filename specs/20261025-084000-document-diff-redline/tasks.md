# Tasks: document-diff-redline

- [ ] Task 1: Bổ sung `"documentDiff"` vào `StudioKind` trong `src/shared/ipc/types.ts`.
- [ ] Task 2: Thêm mã lỗi `studioDiffNeedTwoSources` vào `src/shared/codes/user-error.ts` và từ điển dịch thuật `src/shared/i18n/domains/studio.ts`, `core.ts`.
- [ ] Task 3: Xây dựng cấu trúc prompt `task("documentDiff")` trong `src/main/services/studio/prompt.ts`.
- [ ] Task 4: Kiểm tra điều kiện tối thiểu 2 nguồn trong `src/main/services/studio/studio-service.ts`.
- [ ] Task 5: Cập nhật giao diện `StudioColumn.tsx` với nút So sánh văn bản, huy hiệu PRO và tích hợp `UpgradePrompt`.
- [ ] Task 6: Viết unit tests kiểm tra prompt, validation tối thiểu 2 nguồn và gating bản quyền.
- [ ] Task 7: Chạy kiểm thử toàn bộ test suite, lint và build dự án.
