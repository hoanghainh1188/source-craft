# rename-sourcecraft — đổi tên sản phẩm sang SourceCraft & bổ sung banner ASCII

- Ngày: 2026-10-24
- Người quyết định: Harry (chủ dự án)
- Nguồn: Đổi tên repo GitHub thành `hoanghainh1188/source-craft` và định danh sản phẩm mới là **SourceCraft**.

## Quyết định

1. **Tên chính thức: SourceCraft.**
   - Hiển thị: productName, tiêu đề/header, About, i18n, User-Agent (`SourceCraft/1.0 (local)`), log prefix `[SourceCraft]`, tên tệp sao lưu (`SourceCraft-YYYYMMDD-HHmm.ivbackup`).
   - package.json: `"name": "source-craft"`.
   - electron-builder.yml: `productName: SourceCraft`.

2. **Tương thích dữ liệu người dùng cũ (Backward Compatibility):**
   - Hỗ trợ thư mục dữ liệu cũ theo thứ tự ưu tiên: `appData/Quillhold` -> `appData/InsightVault`.
   - Giữ nguyên service keychain `InsightVault` để không làm mất các API key online mà người dùng đã cấu hình.
   - Giữ nguyên `appId: com.insightvault.app` để cho phép cập nhật tại chỗ trên Windows mà không xung đột trình cài đặt.

3. **Banner ASCII màu sắc:**
   - **README.md / README.vi.md**: Thêm banner ASCII kiểu font Slant với mã màu ANSI (khối ```ansi được GitHub render màu sắc gốc) tạo điểm nhấn nhận diện thương hiệu.
   - **Hộp Giới thiệu (About)**:
     - Hộp mặc định của hệ điều hành (macOS/Windows qua `app.setAboutPanelOptions`): Tích hợp banner ASCII ở đầu trường `credits`.
     - Hộp thoại in-app (`AboutDialog`): Modal đẹp mắt có banner ASCII đa sắc gradient (CSS linear-gradient clip text), hiển thị đầy đủ thông tin phiên bản, cam kết quyền riêng tư local-first, giấy phép mã nguồn mở MIT và liên kết kho lưu trữ GitHub. Mở được trực tiếp khi bấm vào tên app trên header.
