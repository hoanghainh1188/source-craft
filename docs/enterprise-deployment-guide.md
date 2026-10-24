# Hướng dẫn Quản trị viên IT Triển khai Doanh nghiệp (SourceCraft Enterprise Deployment Guide)

Tài liệu này cung cấp hướng dẫn đầy đủ từ A-Z dành cho đội ngũ Quản trị IT (System Administrators, DevOps, Security Officers) khi triển khai **SourceCraft Enterprise** trên quy mô toàn tổ chức.

---

## 1. Cài đặt Hàng loạt & Tự động (Silent & Mass Deployment)

SourceCraft hỗ trợ cài đặt tự động không cần người dùng thao tác giao diện (Unattended / Silent Installation) qua các giải pháp MDM như Microsoft Intune, SCCM, PDQ Deploy, Group Policy (GPO) trên Windows và Jamf Pro / Munki trên macOS.

### 1.1. Triển khai trên Windows (NSIS Installer)

Bộ cài đặt `SourceCraft-<version>-Setup.exe` hỗ trợ các tham số dòng lệnh tiêu chuẩn:

| Tham số | Ý nghĩa |
| :--- | :--- |
| `/S` | Chế độ chạy ngầm hoàn toàn (Silent mode, không hiện giao diện cài đặt) |
| `/allusers` | Cài đặt cho mọi tài khoản người dùng máy tính (`C:\Program Files\SourceCraft`) |
| `/currentuser` | Cài đặt riêng cho tài khoản người dùng đang chạy (`%LocalAppData%\Programs\SourceCraft`) |
| `/D=<path>` | Chỉ định thư mục cài đặt đích (lưu ý: phải là tham số cuối cùng và không có dấu ngoặc kép) |

#### Kịch bản PowerShell Triển khai qua Microsoft Intune / SCCM:

```powershell
# 1. Cài đặt SourceCraft ngầm cho toàn bộ người dùng (yêu cầu quyền Administrator)
$installerPath = ".\SourceCraft-1.0.1-Setup.exe"
Start-Process -FilePath $installerPath -ArgumentList "/S /allusers" -Wait

# 2. Tạo thư mục cấu hình hệ thống
$configDir = "$env:ProgramData\SourceCraft"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force
}

# 3. Phân phối chính sách IT và bản quyền doanh nghiệp
Copy-Item -Path ".\enterprise-policy.json" -Destination "$configDir\enterprise-policy.json" -Force
Copy-Item -Path ".\company.sclicense" -Destination "$configDir\company.sclicense" -Force
```

#### Lệnh Gỡ Cài đặt Ngầm:

```powershell
Start-Process -FilePath "C:\Program Files\SourceCraft\Uninstall SourceCraft.exe" -ArgumentList "/S" -Wait
```

### 1.2. Triển khai trên macOS (DMG / PKG qua Jamf Pro)

Trên macOS, ứng dụng `SourceCraft.app` được gắn kết từ file `.dmg` và sao chép vào `/Applications/`.

#### Kịch bản Bash Triển khai qua Jamf Pro / Munki:

```bash
#!/bin/bash
# 1. Mount DMG và sao chép SourceCraft.app vào /Applications
hdiutil attach SourceCraft-1.0.1-arm64.dmg -nobrowse -mountpoint /Volumes/SourceCraft
cp -R /Volumes/SourceCraft/SourceCraft.app /Applications/
hdiutil detach /Volumes/SourceCraft

# 2. Tạo thư mục cấu hình hệ thống cấp máy (root:admin)
CONFIG_DIR="/Library/Application Support/SourceCraft"
mkdir -p "$CONFIG_DIR"
chmod 755 "$CONFIG_DIR"

# 3. Phân phối chính sách IT và bản quyền doanh nghiệp
cp enterprise-policy.json "$CONFIG_DIR/enterprise-policy.json"
cp company.sclicense "$CONFIG_DIR/company.sclicense"
chmod 644 "$CONFIG_DIR"/*
```

---

## 2. Quản trị Chính sách Bảo mật Tập trung (`enterprise-policy.json`)

Khi ứng dụng khởi động, Main Process tự động tìm đọc tệp `enterprise-policy.json` tại đường dẫn hệ thống:
- **Windows**: `C:\ProgramData\SourceCraft\enterprise-policy.json`
- **macOS**: `/Library/Application Support/SourceCraft/enterprise-policy.json`
- **Linux**: `/etc/sourcecraft/enterprise-policy.json`

### Cấu hình Mẫu:

```json
{
  "$schema": "https://sourcecraft.app/schemas/enterprise-policy-v1.json",
  "schemaVersion": 1,
  "policyId": "POL-2026-CORP-001",
  "organization": "Ngân hàng TMCP XYZ",
  "forceLocalOnly": true,
  "enforceBackupEncryption": true,
  "allowedLanHosts": [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "*.internal",
    "*.corp.local"
  ],
  "preconfiguredLanAi": {
    "enabled": true,
    "provider": "lan-openai",
    "baseUrl": "https://ai.xyz-bank.internal:8000",
    "chatModel": "Qwen/Qwen2.5-14B-Instruct"
  }
}
```

### Hiệu lực của Chính sách:
1. **`forceLocalOnly: true`**:
   - Vô hiệu hóa và khóa toàn bộ các AI Provider bên ngoài đám mây (OpenAI, Anthropic, Gemini).
   - Giao diện Cài đặt AI Online bị làm mờ kèm nhãn: *"Chính sách tổ chức: Toàn bộ AI Đám mây bên ngoài đã bị vô hiệu hóa bởi Quản trị viên"*.
2. **`enforceBackupEncryption: true`**:
   - Bắt buộc phải đặt mật khẩu mã hóa khi sao lưu kho dữ liệu (`.ivbackup`), chặn hoàn toàn sao lưu không mã hóa.
3. **`preconfiguredLanAi`**:
   - Cấu hình sẵn địa chỉ máy chủ AI nội bộ và model mặc định, người dùng không cần tự điền địa chỉ IP hay cổng mạng.

---

## 3. Quản lý Giấy phép Bản quyền Doanh nghiệp Offline (`.sclicense`)

SourceCraft sử dụng chữ ký số mật mã học **Ed25519** để xác thực bản quyền **100% Offline**, không yêu cầu kết nối ra bất kỳ máy chủ xác thực nào trên internet.

### 3.1. Cấp Giấy phép bằng CLI (Dành cho Quản trị viên cấp cao):

```bash
node scripts/issue-license.mjs \
  --org "Tập đoàn ABC" \
  --tier enterprise \
  --seats 100 \
  --days 365 \
  --features lanAi,sharedNotebooks,itPolicy,multimedia,studioPro \
  --out company.sclicense
```

### 3.2. Phân phối Giấy phép:
- Quản trị viên có thể đặt tệp `company.sclicense` cùng thư mục `enterprise-policy.json` (hoặc cấu hình đường dẫn qua thuộc tính `licenseFilePath` trong policy).
- Khi nhân viên mở ứng dụng, hệ thống tự động xác thực và kích hoạt cấp độ **Enterprise**, hiển thị huy hiệu doanh nghiệp: **"Được cấp phép cho: Tập đoàn ABC"**.

---

## 4. Dựng Cụm Máy chủ AI Mạng Nội bộ (LAN AI Server)

Để các máy trạm nhân viên có thể sử dụng các mô hình LLM lớn (14B, 32B, 70B tham số) với tốc độ cao mà không cần trang bị GPU đắt tiền trên từng máy, doanh nghiệp có thể triển khai cụm AI Server nội bộ.

### Cấu hình Triển khai nhanh với Docker Compose:

1. Điều hướng tới thư mục `deployment/`:
   ```bash
   cd deployment
   ```
2. Cập nhật secret token trong `nginx-lan-ai.conf`:
   ```nginx
   map $http_authorization $is_authorized {
       default 0;
       "Bearer YOUR_STRONG_SECRET_TOKEN_HERE" 1;
   }
   ```
3. Khởi chạy cụm dịch vụ:
   ```bash
   docker compose -f docker-compose.lan-ai.yml up -d
   ```
4. Kiểm tra trạng thái hoạt động:
   ```bash
   curl -i http://localhost:8000/healthz
   ```

Client SourceCraft tại máy trạm nhân viên chỉ cần kết nối tới địa chỉ máy chủ (ví dụ `http://192.168.1.50:8000`) và nhập token để tra cứu và chạy AI Studio với tốc độ tối đa!
