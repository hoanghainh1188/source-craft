# Research: Shared Team Notebooks (`shared-team-notebooks`)

## Decision 1: Cấu trúc Định dạng Gói `.scnb`

- **Vấn đề**: Cần một định dạng tệp duy nhất đóng gói an toàn cả metadata, danh sách nguồn, các chunk văn bản và vector float32 384-chiều của LanceDB mà không phụ thuộc vào thư viện bên ngoài nặng nề.
- **Giải pháp**: Sử dụng kiến trúc Container JSON đóng gói nén (`zlib.gzipSync` có sẵn trong Node.js chuẩn):
  - Tệp `.scnb` là tệp nhị phân nén bằng Gzip chứa chuỗi JSON biểu diễn `NotebookPackageData`:
    - `manifest`: Metadata notebook (`title`, `description`, `version`, `author`, `createdAt`, `checksum`).
    - `sources`: Mảng thông tin các nguồn (`title`, `kind`, `charCount`, `tokenCount`).
    - `chunks`: Mảng các chunk văn bản (`id`, `sourceId`, `text`, `charStart`, `charEnd`, `pageNumber`).
    - `vectors`: Mảng vector số thực 384-chiều (`chunkId`, `vector: number[]`).
  - Kiểm tra tính toàn vẹn: Tính toán SHA-256 trên chuỗi JSON trước khi nén để xác thực khi nhập.

## Decision 2: Phân tầng Bản quyền — Tính năng Nâng cao (Pro / Enterprise)

- **Vấn đề**: Yêu cầu người dùng nêu rõ: chức năng này là chức năng nâng cao và cần Pro license.
- **Giải pháp**:
  - Cập nhật `DEFAULT_PRO_FEATURES` trong `src/main/services/license/feature-gate.ts`: thêm `"sharedNotebooks"`.
  - Cả hai gói **Pro** và **Enterprise** đều sở hữu cờ `"sharedNotebooks"`.
  - Gói **Free** không có cờ này. Khi gọi IPC `notebook:exportPackage` hoặc `notebook:importPackage`, Main process kiểm tra `licenseService.gate.hasFeature("sharedNotebooks")`. Nếu không có, ném `UserFacingError("licenseRequireProSharedNotebooks")`.

## Decision 3: Cơ chế Gắn kết Chỉ đọc (Mount Read-Only)

- **Vấn đề**: Khi một notebook được gắn kết từ ổ mạng của công ty, nhân viên chỉ được đọc và hỏi đáp, không được phép thêm nguồn làm thay đổi kho tri thức chung.
- **Giải pháp**:
  - Bổ sung trường `readOnly?: boolean` vào kiểu `Notebook`.
  - Ở ranh giới Main process (`register.ts`):
    - `sourceAdd`: Kiểm tra `if (notebook.readOnly) throw new UserFacingError("notebookReadOnly");`
    - `notebookRename`, `sourceRemove`: Tương tự.
  - Ở Renderer: Vô hiệu hóa nút Thêm nguồn và hiển thị huy hiệu 🔒 **"Dùng chung (Chỉ đọc)"**.
