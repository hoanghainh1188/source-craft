# Contract: branded-export

## 1. IPC Kênh `studio:export`
- **Request Payload**: `StudioExportInput`
  - `content`: Chuỗi nội dung Markdown do AI Studio tạo ra.
  - `suggestedName`: Tên file gợi ý.
  - `format`: `"md" | "docx" | "pdf"` (mặc định: `"md"`).
  - `options`: Tùy chọn tiêu đề, tác giả, tổ chức, header/footer.
- **Response**: `StudioExportResult`
  - `saved`: `boolean` (true nếu người dùng đã chọn vị trí và lưu thành công, false nếu bấm Cancel).
  - `path`: Đường dẫn file đã lưu (tùy chọn).

## 2. Xử Lý Lỗi (Error Contract)
- Nếu `format === "docx" || format === "pdf"` và giấy phép hiện tại chưa có quyền `brandedExport`:
  - Ném `UserFacingError("licenseRequireProExport")`.
  - Mã lỗi `licenseRequireProExport` được gán vào `UPSELL_CODES` để kích hoạt popup nâng cấp gói Pro/Enterprise.
