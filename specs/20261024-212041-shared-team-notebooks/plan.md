# Implementation Plan: Shared Team Notebooks (`shared-team-notebooks`)

**Branch**: `229-shared-team-notebooks` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

## Summary

Triển khai Pha 3 của lộ trình B2B Enterprise — tính năng nâng cao yêu cầu bản quyền **Pro** hoặc **Enterprise**:
1. **Phân tầng Bản quyền**: Mở cờ `sharedNotebooks` cho gói Pro trong `feature-gate.ts`, chặn người dùng Free khi gọi IPC đóng gói/nhập gói.
2. **Package Serialization & Integrity (`package-codec.ts`)**: Nén và giải nén tệp `.scnb` bằng Gzip + kiểm tra toàn vẹn băm SHA-256.
3. **Package Exporter & Importer Service (`package-service.ts`)**:
   - `exportPackage`: Đọc dữ liệu từ SQLite (nguồn, chunk) và LanceDB (vector), nén và lưu tệp `.scnb` qua hộp thoại native ở Main process.
   - `importPackage`: Giải nén `.scnb`, nạp notebook vào SQLite và ghi hàng loạt vector vào LanceDB mà không cần tính toán lại.
4. **Read-Only / Mounted Mode**: Bảo vệ notebook dùng chung không bị sửa đổi, thêm huy hiệu trên UI Workspace.
5. **Renderer UI**: Nút Xuất trên menu Notebook và nút Nhập trên Header danh sách Notebook.

## Constitution Check

- **I. Local-First & No Default Egress**: PASS — Đóng gói và giải nén hoàn toàn cục bộ bằng `node:zlib` và `node:crypto`.
- **III. Desktop Security Boundary**: PASS — Hộp thoại lưu/chọn tệp chạy 100% tại Main process.
- **IV. Test-First & Coverage Discipline**: PASS — Unit test cho package codec, exporter, importer và tier check $\ge 80\%$.

## Project Structure

```text
src/
├── shared/
│   ├── codes/user-error.ts                      # +3 mã lỗi package & read-only
│   ├── ipc/channels.ts                          # +2 kênh IPC notebook package
│   └── ipc/types.ts                             # NotebookPackageData, ExportPackageResult...
├── main/
│   ├── services/
│   │   ├── license/
│   │   │   └── feature-gate.ts                  # DEFAULT_PRO_FEATURES includes "sharedNotebooks"
│   │   └── notebooks/package/
│   │       ├── package-codec.ts                 # Gzip encode/decode + SHA-256
│   │       └── package-service.ts               # Export/Import orchestration with SQLite & LanceDB
│   └── ipc/register.ts                          # Đăng ký IPC export/import
└── renderer/
    └── features/notebooks/
        ├── NotebookActionsMenu.tsx              # Thêm nút Xuất gói (.scnb)
        └── NotebookListHeader.tsx               # Thêm nút Nhập gói (.scnb)
```
