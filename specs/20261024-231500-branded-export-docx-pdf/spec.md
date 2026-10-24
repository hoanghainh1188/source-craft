# Spec: branded-export-docx-pdf

## 1. Mục Tiêu
Cung cấp tính năng xuất báo cáo chuyên nghiệp từ AI Studio ra Microsoft Word (`.docx`) và `PDF` có gắn thông tin tổ chức, số trang, tiêu đề và định dạng đẹp mắt cho người dùng gói Pro và Enterprise.

## 2. Yêu Cầu Chức Năng
- **FR-1**: Mở rộng kênh IPC `studio:export` nhận thêm `format: "md" | "docx" | "pdf"` và cấu hình `options?: BrandedExportOptions`.
- **FR-2**: Kiểm soát bản quyền thông qua `brandedExport`. Gói Free ném `licenseRequireProExport` khi yêu cầu định dạng khác ngoài `md`.
- **FR-3**: Bộ sinh Word `.docx` tạo tệp docx chuẩn OPC zip thuần TypeScript/Node.js, hiển thị đầy đủ văn bản tiếng Việt, bảng biểu, danh sách và header/footer.
- **FR-4**: Bộ sinh PDF sử dụng Chromium in ấn qua Electron `printToPDF` kèm stylesheet in ấn A4 chuẩn mực.
- **FR-5**: UI trong `StudioResultCard` cung cấp menu chọn định dạng: Markdown (.md), Word (.docx) [PRO], PDF (.pdf) [PRO]. Khi người dùng Free chọn định dạng trả phí, kích hoạt modal nâng cấp bản quyền.

## 3. Ràng Buộc
- **Local-first**: Hoạt động 100% offline, không gửi nội dung ra mạng ngoài.
- **Bảo mật**: Người dùng luôn chủ động chọn vị trí lưu tệp qua hộp thoại của hệ thống (`showSaveDialog`). Không tự động ghi file ra ổ đĩa khi chưa có sự xác nhận của người dùng.
