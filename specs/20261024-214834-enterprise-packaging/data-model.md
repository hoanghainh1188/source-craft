# Mô hình Dữ liệu: Cấu hình Triển khai Doanh nghiệp (`enterprise-packaging`)

## 1. Cấu trúc Tệp Chính sách Mẫu (`enterprise-policy.json.example`)

```json
{
  "$schema": "https://sourcecraft.app/schemas/enterprise-policy-v1.json",
  "orgName": "Tập đoàn Công nghệ Mẫu",
  "licenseFilePath": "C:\\ProgramData\\SourceCraft\\company.sclicense",
  "disableExternalOnlineProviders": true,
  "disableUrlIngestion": false,
  "requireBackupPassword": true,
  "lanAiServer": {
    "protocol": "openai-compatible",
    "baseUrl": "http://192.168.1.50:8000",
    "defaultModel": "Qwen/Qwen2.5-14B-Instruct",
    "lockConfiguration": true
  },
  "sharedNotebooksDir": "\\\\nas.corp.internal\\SourceCraft\\Notebooks"
}
```

### Ý nghĩa các trường dữ liệu:

| Trường | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `orgName` | `string` | Có | Tên tổ chức / doanh nghiệp sở hữu bản quyền |
| `licenseFilePath` | `string` | Không | Đường dẫn tuyệt đối tới tệp bản quyền `.sclicense` được kích hoạt tự động |
| `disableExternalOnlineProviders` | `boolean` | Không | Nếu `true`, khóa toàn bộ các AI Provider bên ngoài đám mây (OpenAI, Anthropic, Gemini) |
| `disableUrlIngestion` | `boolean` | Không | Nếu `true`, ngăn chặn nạp tài liệu từ URL internet |
| `requireBackupPassword` | `boolean` | Không | Nếu `true`, bắt buộc phải đặt mật khẩu mã hóa khi tạo bản sao lưu kho lưu trữ |
| `lanAiServer.protocol` | `"ollama" \| "openai-compatible"` | Không | Chuẩn giao thức của máy chủ AI mạng nội bộ |
| `lanAiServer.baseUrl` | `string` | Không | Địa chỉ URL nội bộ của máy chủ AI (IP riêng hoặc domain nội bộ) |
| `lanAiServer.defaultModel` | `string` | Không | Tên mô hình LLM mặc định trên máy chủ |
| `lanAiServer.lockConfiguration` | `boolean` | Không | Nếu `true`, khóa không cho người dùng sửa đổi cấu hình máy chủ AI |
| `sharedNotebooksDir` | `string` | Không | Đường dẫn thư mục mạng chia sẻ chứa các gói tri thức nhóm `.scnb` |
