# Hợp đồng & Quy chuẩn Đóng gói: Triển khai Doanh nghiệp (`enterprise-packaging`)

## 1. Quy chuẩn Tham số Cài đặt Windows Installer

| Tham số | Ý nghĩa | Môi trường áp dụng |
| :--- | :--- | :--- |
| `/S` | Chạy ngầm hoàn toàn (Silent mode, không UI, không thông báo) | GPO, Intune, SCCM, Script |
| `/allusers` | Cài đặt cho mọi tài khoản người dùng (`%ProgramFiles%\SourceCraft`) | Máy trạm dùng chung, quyền Admin |
| `/currentuser` | Cài đặt riêng cho tài khoản đang đăng nhập (`%LocalAppData%\Programs\SourceCraft`) | Máy cá nhân không có quyền Admin |
| `/D=<path>` | Chỉ định thư mục cài đặt tùy chỉnh (phải đặt ở cuối dòng lệnh) | Kịch bản tự động hóa |

### Ví dụ Lệnh Cài đặt qua PowerShell (Intune / SCCM):

```powershell
Start-Process -FilePath ".\SourceCraft-1.0.1-Setup.exe" -ArgumentList "/S /allusers" -Wait
```

### Ví dụ Lệnh Gỡ cài đặt ngầm:

```powershell
Start-Process -FilePath "C:\Program Files\SourceCraft\Uninstall SourceCraft.exe" -ArgumentList "/S" -Wait
```

## 2. Quy chuẩn Vị trí Thư mục Cấu hình Hệ thống Doanh nghiệp

- **Windows**:
  - Thư mục: `C:\ProgramData\SourceCraft\`
  - Chính sách: `C:\ProgramData\SourceCraft\enterprise-policy.json`
  - Bản quyền mặc định: `C:\ProgramData\SourceCraft\org.sclicense`
- **macOS**:
  - Thư mục: `/Library/Application Support/SourceCraft/`
  - Chính sách: `/Library/Application Support/SourceCraft/enterprise-policy.json`
  - Bản quyền mặc định: `/Library/Application Support/SourceCraft/org.sclicense`
- **Linux**:
  - Thư mục: `/etc/sourcecraft/`
  - Chính sách: `/etc/sourcecraft/enterprise-policy.json`
  - Bản quyền mặc định: `/etc/sourcecraft/org.sclicense`
