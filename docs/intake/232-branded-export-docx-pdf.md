# Intake: [feature] branded-export-docx-pdf: Xuất báo cáo AI Studio ra Word (.docx) & PDF chuẩn kèm logo/mục lục (Pro/Enterprise)

## 1. Thông tin Issue
- **Issue**: #232
- **Tiêu đề**: [feature] branded-export-docx-pdf: Xuất báo cáo AI Studio ra Word (.docx) & PDF chuẩn kèm logo/mục lục (Pro/Enterprise)
- **Nhánh**: `232-branded-export-docx-pdf`
- **Phân tầng cấp phép**: Pro & Enterprise (`brandedExport`)

## 2. Mục tiêu & Bối cảnh
Người dùng chuyên nghiệp (luật sư, bác sĩ, chuyên viên phân tích) khi sử dụng AI Studio để tổng hợp hồ sơ và báo cáo thường cần xuất tài liệu ra định dạng Microsoft Word (`.docx`) hoặc `PDF` để gửi cho đối tác/khách hàng hoặc in ấn trực tiếp. Hiện tại ứng dụng chỉ hỗ trợ xuất định dạng Markdown (`.md`) thô hoặc sao chép clipboard.

Tính năng này cung cấp:
1. **Kiểm soát bản quyền (License Gating)**:
   - Gói Miễn phí (Free): Tiếp tục hỗ trợ xuất Markdown (`.md`) và sao chép văn bản thô.
   - Gói Trả phí (Pro/Enterprise): Mở khóa xuất Word (`.docx`) và `PDF` có định dạng chuyên nghiệp.
2. **Xuất file Microsoft Word (.docx)**:
   - Tạo tệp `.docx` hợp chuẩn OPC Zip trực tiếp trong tiến trình Node/Electron mà không phụ thuộc binary ngoài.
   - Hỗ trợ bìa báo cáo (Title, Subtitle, Author, Date, Organization), header & footer có số trang (`PAGE / NUMPAGES`), mục lục tự động, định dạng bảng và trích dẫn.
3. **Xuất file PDF chuyên nghiệp**:
   - Tận dụng engine in ấn cục bộ `webContents.printToPDF` của Electron kết hợp template HTML/CSS chuyên nghiệp (typography tiêu chuẩn, tiêu đề, chân trang số trang, ngắt trang thông minh).
4. **Bảo toàn dữ liệu & Cục bộ**:
   - 100% xử lý offline tại máy cục bộ (Local-first), không gửi dữ liệu ra bên ngoài.
   - Hộp thoại lưu tệp hiển thị bộ lọc phù hợp (`.docx`, `.pdf`, `.md`).
