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

---

## 5. Nhật ký Kiểm toán (Audit Log)

Nhật ký kiểm toán ghi lại **ai đã hỏi AI điều gì, bằng mô hình nào, dựa trên tài liệu nào** trên từng máy trạm, phục vụ truy vết tuân thủ. Tính năng chỉ chạy khi có **cả hai** điều kiện: tệp chính sách **hệ thống** (mục 2) bật ghi, và bản quyền Enterprise còn hiệu lực có tính năng `itPolicy`. Tệp `enterprise-policy.json` đặt trong thư mục dữ liệu của người dùng **không** bật được nhật ký.

**Được ghi:** người dùng hệ điều hành và tên máy, thời điểm, phạm vi hỏi (một notebook hay toàn bộ), mô hình và nhóm provider (cục bộ / LAN / online), nguồn được trích dẫn, kết quả của lượt (hoàn tất / không tìm thấy / huỷ / lỗi / đang lập chỉ mục lại), các lần xuất tệp và các sự kiện vòng đời của nhật ký.
**Câu hỏi** được mã hoá bằng khoá công khai của tổ chức: trên máy trạm không ai đọc lại được, kể cả người dùng.
**Không được ghi:** câu trả lời của AI và nội dung tài liệu.

Mỗi bản ghi được nối chuỗi băm SHA-256 và ký Ed25519 bằng khoá riêng của máy (giữ trong Keychain / Credential Manager), nên mọi lần sửa, xoá hay chèn ở giữa đều bị phát hiện khi kiểm tra.

### 5.1. Các khoá trong chính sách

Ngoài ba khoá dưới đây, tệp chính sách phải có đủ `schemaVersion: 1`, `policyId` và `organization` (mục 2). Thiếu một trong ba ⇒ lỗi chính sách (AI tạm khoá).

| Khoá | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `enableAuditLogging` | có | `true` để bật. Sai kiểu dữ liệu ⇒ coi là **lỗi chính sách** (AI tạm khoá), không bị âm thầm bỏ qua. |
| `auditPublicKey` | có | Khoá công khai **X25519** của tổ chức (PEM) dùng mã hoá câu hỏi. Sinh bằng `--audit-keygen` (mục 5.3). |
| `auditLogDirectory` | không | Đường dẫn **tuyệt đối** tới thư mục lưu nhật ký. Bỏ trống ⇒ thư mục `audit` trong thư mục dữ liệu của ứng dụng. |

```json
{
  "schemaVersion": 1,
  "policyId": "POL-2026-CORP-001",
  "organization": "Ngân hàng TMCP XYZ",
  "forceLocalOnly": true,
  "enableAuditLogging": true,
  "auditPublicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VuAyEA…\n-----END PUBLIC KEY-----\n",
  "auditLogDirectory": "D:\\AuditLogs\\SourceCraft"
}
```

**Thư mục lưu:** nên chỉ định một thư mục mà tài khoản nhân viên **chỉ được ghi thêm** (Windows: ACL "Create files / Append data", bỏ quyền Delete / Write attributes; macOS: cờ `sappnd` hoặc gom định kỳ về máy chủ). Tệp tự xoay vòng khi đạt 5 MB và không bao giờ tự xoá tệp cũ. Số trong tên tệp là `seq` của bản ghi đầu tiên trong tệp, đệm 12 chữ số (`audit-000000000000.jsonl`, `audit-000000005120.jsonl`, …). Nhật ký **không** nằm trong bản sao lưu vault và báo lỗi (crash report).

### 5.2. Người dùng thấy gì

- Header có chip **"Đang ghi nhật ký kiểm toán"** cạnh chỉ báo riêng tư; di chuột hoặc dùng phím Tab để đọc giải thích.
- **Cài đặt › Nhật ký kiểm toán** hiển thị trạng thái, lý do, tên tổ chức và vị trí lưu dưới dạng nhãn ("Mặc định" / "Do bộ phận IT chỉ định"), không bao giờ hiện đường dẫn. Mục này chỉ để đọc: người dùng không bật, tắt hay xem nội dung nhật ký được.

### 5.3. Quy trình triển khai khoá

Gọi chính tệp chạy của ứng dụng đã cài ở chế độ dòng lệnh. Chế độ này không mở cửa sổ, không cần mạng và chạy được cả khi ứng dụng đang mở:

- macOS: `"/Applications/SourceCraft.app/Contents/MacOS/SourceCraft" <lệnh> …`
- Windows: `"%LOCALAPPDATA%\Programs\SourceCraft\SourceCraft.exe" <lệnh> …`

1. **Sinh cặp khoá tổ chức** trên máy quản trị (không phải máy nhân viên):

   ```bash
   SourceCraft --audit-keygen --out-dir ./audit-keys
   ```

   Lệnh tạo `sourcecraft-audit-org-public.pem` và `sourcecraft-audit-org-private.pem`, rồi in dòng `"auditPublicKey": "…"` để dán vào chính sách. **Khoá bí mật phải được giữ ngoài máy nhân viên** (két khoá, HSM hoặc máy quản trị tách mạng). Mất khoá này thì không giải mã được câu hỏi trong nhật ký.
2. **Phân phối chính sách** có `enableAuditLogging` + `auditPublicKey` như mục 1 và mục 2.
3. **Đăng ký khoá máy:** sau lần mở ứng dụng đầu tiên, chạy `--audit-verify` trên thư mục nhật ký của từng máy, rồi lưu `deviceKeyIds` trong báo cáo `--json` vào sổ tài sản. Ở các lần kiểm sau, truyền khoá đã đăng ký qua `--expect-device-key`. **Nếu không ghim khoá**, người có quyền ghi thư mục có thể dựng một lần "đổi khoá" hợp lệ rồi viết lại phần sau; báo cáo vẫn "nguyên vẹn" và chỉ kèm cảnh báo đổi khoá.

### 5.4. Kiểm tra và giải mã

macOS:

```bash
APP="/Applications/SourceCraft.app/Contents/MacOS/SourceCraft"
# Kiểm tra toàn vẹn (in báo cáo, hoặc --json để máy đọc)
"$APP" --audit-verify "/Volumes/AuditLogs/SourceCraft" --expect-device-key 9f2c0a…,b81e44… --json --out report.json
# Giải mã câu hỏi ra tệp riêng (quyền 0600; không bao giờ in ra màn hình)
"$APP" --audit-decrypt "/Volumes/AuditLogs/SourceCraft" --org-key ./audit-keys/sourcecraft-audit-org-private.pem --out questions.jsonl
```

Windows (Command Prompt):

```bat
set APP=%LOCALAPPDATA%\Programs\SourceCraft\SourceCraft.exe
start /wait "" "%APP%" --audit-verify "D:\AuditLogs\SourceCraft" --expect-device-key 9f2c0a…,b81e44… --json --out report.json
echo %ERRORLEVEL%
start /wait "" "%APP%" --audit-decrypt "D:\AuditLogs\SourceCraft" --org-key "C:\AuditKeys\sourcecraft-audit-org-private.pem" --out questions.jsonl
```

| Mã thoát | Ý nghĩa |
| --- | --- |
| `0` | Nguyên vẹn (có thể kèm cảnh báo: tương tác chưa kết thúc, đổi khoá, đồng hồ lùi, đuôi ghi dở đã sửa, tệp đầu đã lưu trữ) / lệnh thành công |
| `1` | Bị can thiệp: báo cáo chỉ ra tệp, dòng và `seq` hỏng đầu tiên |
| `2` | Lỗi sử dụng: thiếu/thừa tham số, hoặc tệp đích đã tồn tại / nằm trong thư mục nhật ký |
| `3` | Lỗi I/O hoặc khoá: không đọc được thư mục, khoá sai định dạng, khoá tổ chức không khớp |

- **Windows:** ứng dụng GUI không gắn vào console, nên luôn dùng `--out` và `start /wait` như trên để lấy mã thoát. Quyền 0600 không có tác dụng trên Windows; hãy lưu khoá bí mật và tệp giải mã trong thư mục có ACL chỉ quản trị viên đọc được.
- **Cắt bỏ phần cuối nhật ký** (xoá các bản ghi hoặc tệp cuối cùng) không phát hiện được từ chính nhật ký. Sau mỗi lần thu thập, hãy lưu `lastSeq` và giá trị `hash` cuối, rồi so ở lần sau.
- **Tệp đầu đã được lưu trữ đi:** muốn kiểm phần còn lại, truyền khoá công khai PEM của máy (`--expect-device-key <tệp PEM>`), vì chỉ `deviceKeyId` thì chưa đủ để kiểm chữ ký.

### 5.5. Fail-closed và cách xử lý lỗi

Khi chính sách đã bật mà không ghi được nhật ký, ứng dụng **khoá tính năng AI** (hỏi đáp, Studio) thay vì chạy mà không ghi. Các tính năng không gửi dữ liệu tới AI vẫn hoạt động.

- Khi **không ghi được** (`auditWriteFailed`, `auditKeyUnavailable`), chip trên header chuyển sang **"Nhật ký kiểm toán lỗi — AI tạm khoá"**.
- Khi **chính sách sai** (`auditPolicyInvalid`), header không có chip (nhật ký chưa từng bắt đầu); chỉ **Cài đặt › Nhật ký kiểm toán** báo "Lỗi chính sách — AI tạm khoá" kèm lý do, và lượt AI báo lỗi cho người dùng.

| Mã lỗi người dùng thấy | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `auditPolicyInvalid` | Tệp chính sách hệ thống không đọc được / JSON hỏng, `auditPublicKey` không phải khoá X25519, `auditLogDirectory` không phải đường dẫn tuyệt đối, hoặc `enableAuditLogging` sai kiểu | Sửa tệp chính sách rồi khởi động lại ứng dụng |
| `auditWriteFailed` | Không ghi được thư mục nhật ký (thiếu quyền, đầy đĩa, ổ mạng mất kết nối) | Khôi phục quyền / dung lượng / kết nối. Ứng dụng tự thử lại ở lượt AI sau và ghi `audit.recovered`, không cần khởi động lại |
| `auditKeyUnavailable` | Không đọc/ghi được khoá ký trong Keychain / Credential Manager | Kiểm tra quyền truy cập Keychain / Credential Manager của tài khoản. Nếu khoá bị mất, ứng dụng sinh khoá mới và ghi `audit.keyRotated`; hãy đăng ký lại khoá mới (mục 5.3) |

Bản quyền hết hạn hoặc bị gỡ ⇒ nhật ký dừng kèm bản ghi `audit.stopped{licenseInactive}` và AI chạy bình thường. Khi đó, Cài đặt báo "Chưa có hiệu lực — cần bản quyền Enterprise".
