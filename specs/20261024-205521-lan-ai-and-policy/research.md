# Research: LAN AI Server & Enterprise IT Policy (`lan-ai-and-policy`)

## Decision 1: Xác thực IP Nội bộ & Chống SSRF (RFC1918 Guard)

- **Vấn đề**: Người dùng có thể vô tình hoặc cố ý nhập một địa chỉ IP công cộng (vd `8.8.8.8` hoặc server ngoài Internet) vào cấu hình LAN AI, dẫn tới vi phạm nguyên tắc Local-first / No Default Egress và rò rỉ dữ liệu tổ chức.
- **Giải pháp**: Xây dựng module thuần `validateLanUrl(urlString, extraAllowedHosts)` ở `src/main/services/ai-runtime/lan/lan-guard.ts`:
  - Phân tích cú pháp URL với `new URL(urlString)`. Giao thức phải là `http:` hoặc `https:`.
  - Phân tích hostname:
    - Nếu là IPv4: Phải thuộc dải Loopback (`127.0.0.0/8`), Private Network Class A (`10.0.0.0/8`), Class B (`172.16.0.0/12`), hoặc Class C (`192.168.0.0/16`).
    - Nếu là tên miền: Phải kết thúc bằng `.local`, `.internal`, `.lan`, `.corp`, `localhost`, hoặc nằm trong danh sách `allowedLanHosts` của Policy.
  - Từ chối các IP link-local metadata cloud (`169.254.169.254`) để chống SSRF trên môi trường ảo hóa.

## Decision 2: Kiến trúc Provider cho LAN AI Server

- **Vấn đề**: Doanh nghiệp sử dụng cả máy chủ Ollama (GPU server dùng chung) và các framework inference hiệu năng cao như vLLM, LiteLLM, LocalAI, TGI (chuẩn OpenAI-compatible).
- **Giải pháp**: Tạo 2 Provider chuyên biệt nằm trong `src/main/services/ai-runtime/lan/`:
  1. `LanOllamaProvider`: Tương thích API Ollama (`/api/chat`, `/api/tags`).
  2. `LanOpenAiProvider`: Tương thích chuẩn OpenAI chat completions (`/v1/chat/completions`, `/v1/models`).
- Cả hai đều hỗ trợ tùy chọn Bearer token (lưu trữ trong `keytar` / `SecretStore` tương tự API keys của cloud provider).

## Decision 3: Cơ chế Nạp và Cưỡng chế `enterprise-policy.json`

- **Vấn đề**: Policy file có thể không tồn tại trên các máy người dùng cá nhân, hoặc có thể bị người dùng chỉnh sửa nếu đặt ở thư mục người dùng.
- **Giải pháp**:
  - Ưu tiên nạp từ thư mục cấp hệ thống (yêu cầu quyền Admin/Root để ghi):
    - macOS: `/Library/Application Support/SourceCraft/enterprise-policy.json`
    - Windows: `C:\ProgramData\SourceCraft\enterprise-policy.json`
    - Linux: `/etc/sourcecraft/enterprise-policy.json`
  - Fallback nạp từ `<userData>/enterprise-policy.json` cho môi trường thử nghiệm hoặc cài đặt portable.
  - Nếu tệp không tồn tại: Áp dụng `DEFAULT_POLICY` (không khóa tính năng nào).
  - Nếu tệp tồn tại nhưng sai schema: Báo lỗi trong log và coi như không áp dụng chính sách để tránh làm ứng dụng crash, nhưng hiển thị cảnh báo cho Admin.
