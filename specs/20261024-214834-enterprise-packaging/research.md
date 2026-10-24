# Nghiên cứu Kỹ thuật: Đóng gói Triển khai Doanh nghiệp (`enterprise-packaging`)

## 1. Nghiên cứu NSIS Installer Flags trên Windows

- **Vấn đề**: Bộ cài đặt NSIS mặc định của `electron-builder` tạo ra wizard tương tác. Để các hệ thống MDM (Microsoft Intune, SCCM, PDQ Deploy, GPO) cài đặt tự động ngầm, cần các cờ:
  - `/S`: Chế độ Silent (không hiển thị cửa sổ, không cần bấm Next).
  - `/allusers`: Cài đặt vào `Program Files` cho tất cả người dùng trên máy tính (yêu cầu quyền Admin / UAC elevation lúc chạy script).
  - `/currentuser`: Cài đặt vào `AppData\Local` cho người dùng hiện tại (không cần quyền Admin).
  - `/D=<path>`: Chỉ định thư mục cài đặt tùy chỉnh.
- **Giải pháp**: Cấu hình NSIS trong `electron-builder.yml`:
  ```yaml
  nsis:
    oneClick: false
    perMachine: false # Cho phép người dùng cá nhân cài per-user, hoặc IT Admin truyền /allusers khi cài ngầm
    allowToChangeInstallationDirectory: true
  ```
  Cấu hình này đã tối ưu cho cả hai đối tượng: cá nhân và quản trị viên doanh nghiệp.

## 2. Nghiên cứu Kiến trúc Máy chủ AI Mạng Nội bộ (LAN AI Server)

- **Vấn đề**: Nhiều doanh nghiệp có máy chủ GPU chuyên dụng (NVIDIA A100/H100, RTX 4090, hoặc Mac Studio M2/M3 Ultra) trong mạng LAN/VPN và muốn tập trung xử lý suy luận (Chat RAG, Studio Synthesis) để máy trạm của nhân viên không cần card đồ họa rời.
- **Giải pháp**:
  - Triển khai **Ollama** hoặc **vLLM** qua Docker Compose trên máy chủ nội bộ.
  - Đặt một container Nginx / Caddy phía trước làm Reverse Proxy để kiểm tra header `Authorization: Bearer <token>`, ngăn chặn truy cập trái phép từ các thiết bị không thuộc diện cấp phép.
  - Client SourceCraft tại máy trạm nhân viên sẽ kết nối qua địa chỉ IP nội bộ (ví dụ: `http://192.168.1.100:11434` hoặc `https://ai.company.internal/v1`) và tự động gửi Bearer token đã lưu trong keytar.

## 3. Nghiên cứu Phân phối Chính sách & Giấy phép Hệ thống

- **macOS**: Thư mục `/Library/Application Support/SourceCraft/` thuộc quyền sở hữu của `root:admin` với phân quyền `0755`. Các tệp `enterprise-policy.json` và `company.sclicense` được phân phối qua Jamf Composer hoặc Shell Script.
- **Windows**: Thư mục `C:\ProgramData\SourceCraft\` (mặc định ẩn) có quyền ghi dành cho nhóm `Administrators` và quyền đọc dành cho `Users`. Script PowerShell triển khai qua Intune / GPO có thể tạo thư mục và sao chép tệp cấu hình chỉ với 2 dòng lệnh.
