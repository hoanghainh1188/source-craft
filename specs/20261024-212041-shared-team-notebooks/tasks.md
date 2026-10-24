# Tasks: Shared Team Notebooks (`shared-team-notebooks`)

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/package-ipc.md](./contracts/package-ipc.md)

## Phase 1: Setup & Shared Contracts
- [ ] T001 [P] Thêm `sharedNotebooks` vào `DEFAULT_PRO_FEATURES` trong `src/main/services/license/feature-gate.ts`
- [ ] T002 [P] Thêm `NotebookPackageManifest`, `NotebookPackageData`, `ExportPackageResult`, `ImportPackageResult` và cờ `readOnly` vào `src/shared/ipc/types.ts`
- [ ] T003 [P] Thêm channels `notebookExportPackage`, `notebookImportPackage` vào `src/shared/ipc/channels.ts`
- [ ] T004 [P] Thêm mã lỗi `licenseRequireProSharedNotebooks`, `packageCorrupted`, `notebookReadOnly` vào `src/shared/codes/user-error.ts`
- [ ] T005 [P] Thêm chuỗi i18n song ngữ cho tính năng gói sổ tay và mã lỗi trong `src/shared/i18n/domains/core.ts` và `notebooks.ts`

## Phase 2: Package Codec & Integrity
- [ ] T006 [P] Viết unit tests cho `package-codec.ts` (encode/decode gzip, phát hiện sai lệch SHA-256) trong `tests/unit/notebooks/package-codec.test.ts`
- [ ] T007 Triển khai `encodeNotebookPackage` và `decodeNotebookPackage` trong `src/main/services/notebooks/package/package-codec.ts`

## Phase 3: Exporter & Importer Services
- [ ] T008 [P] Viết unit tests cho `PackageService` (export từ repo/vector store, import tạo notebook mới kèm vector) trong `tests/unit/notebooks/package-service.test.ts`
- [ ] T009 Triển khai `createPackageService` trong `src/main/services/notebooks/package/package-service.ts`

## Phase 4: Main IPC & UI Integration
- [ ] T010 Đăng ký IPC handlers trong `src/main/ipc/register.ts` (kiểm tra `hasFeature("sharedNotebooks")`, ném lỗi nếu gói Free) và nối vào `src/main/index.ts`
- [ ] T011 Expose các phương thức trong `src/preload/index.ts`
- [ ] T012 Thêm nút "Xuất gói (.scnb)" trong menu notebook và nút "Nhập gói (.scnb)" trên giao diện danh sách notebook
- [ ] T013 Hiển thị huy hiệu "Chỉ đọc" cho notebook có `readOnly: true`

## Phase 5: Verification Gate
- [ ] T014 Chạy `python3 .github/scripts/check-template.py` kiểm tra tài liệu
- [ ] T015 Chạy `npm run lint && npm test && npm run build` kiểm tra toàn diện
