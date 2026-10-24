# Thiết kế Cơ bản: Kết nối Máy chủ AI Nội bộ & Chính sách Quản trị Doanh nghiệp (`lan-ai-and-policy`)

**Ngày thiết kế**: 2026-10-24  
**Thuộc**: Lộ trình B2B Enterprise — Pha 2 (tiếp nối `226-enterprise-license`)  
**Tài liệu liên quan**:
- [`docs/01-basic-design/enterprise-license/basic-design.md`](../enterprise-license/basic-design.md)
- [`docs/00-glossary.md`](../../00-glossary.md)
- [`.specify/memory/constitution.md`](../../../.specify/memory/constitution.md)

---

## 1. Mục tiêu & Bối cảnh

1. **Bối cảnh Doanh nghiệp**:
   - Khi triển khai ứng dụng cho nhiều nhân viên trong cơ quan/doanh nghiệp, phần lớn máy trạm cá nhân không có GPU đủ mạnh để chạy LLM cục bộ (7B/14B). Doanh nghiệp thường đầu tư một cụm máy chủ GPU đặt tại phòng Server nội bộ chạy Ollama hoặc vLLM / LiteLLM (OpenAI-compatible) cho toàn bộ nhân viên dùng chung qua mạng LAN/VPN.
   - Các tổ chức yêu cầu quản trị tập trung (IT Governance): IT Admin muốn cấu hình sẵn đường dẫn AI server và có quyền khóa cứng ứng dụng ở chế độ an toàn nội bộ (chặn nhân viên bật Cloud API như OpenAI/Claude/Gemini) thông qua tệp chính sách quản trị `enterprise-policy.json`.

2. **Mục tiêu kỹ thuật**:
   - **Hỗ trợ LAN AI Server**:
     - Cho phép kết nối tới máy chủ AI trong mạng nội bộ (dải IP riêng RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, tên miền `.local`, `.internal` hoặc dải hostname được cấu hình trong Policy).
     - Hỗ trợ 2 giao thức: **LAN Ollama** (`/api/chat`, `/api/tags`) và **LAN OpenAI-Compatible** (`/v1/chat/completions`, `/v1/models` như vLLM, LiteLLM, LocalAI) kèm tùy chọn Bearer Token.
     - Kiểm tra quyền `lanAi` từ `FeatureGate` (chỉ mở cho gói `Enterprise`).
   - **Chỉ báo Bảo mật Mạng Nội bộ (`PrivacyState: lan`)**:
     - Khi sử dụng LAN AI Server, chỉ báo bảo mật hiển thị huy hiệu 🛡️ **"Mạng nội bộ (LAN) — Thuộc tổ chức"** (thay vì "Online" hay "Cục bộ"), phân biệt rõ dữ liệu không rời khỏi mạng công ty.
   - **Chính sách Quản trị IT (`enterprise-policy.json`)**:
     - Tự động nạp tệp chính sách chỉ đọc từ vị trí hệ thống (hoặc thư mục dữ liệu ứng dụng).
     - Hỗ trợ các quy tắc:
       - `forceLocalOnly: true`: Khóa cứng không cho phép bật bất kỳ Cloud Provider nào (OpenAI/Anthropic/Gemini bị vô hiệu hóa trên UI Cài đặt).
       - `preconfiguredLanAi`: Cấu hình mặc định sẵn địa chỉ máy chủ LAN AI cho nhân viên mà không cần nhập tay.
       - `enforceBackupEncryption: true`: Bắt buộc nhập mật khẩu mã hóa khi sao lưu dữ liệu.

---

## 2. Ranh giới Bảo mật & Kiểm tra Địa chỉ LAN (SSRF Protection)

Để ngăn chặn tấn công SSRF hoặc rò rỉ dữ liệu ra Internet:
- Chỉ các URL thỏa mãn điều kiện địa chỉ mạng cục bộ mới được coi là hợp lệ cho `LAN AI`:
  - `http://` hoặc `https://`
  - IP thuộc các dải private:
    - `10.0.0.0/8`
    - `172.16.0.0/12` (`172.16.0.0` - `172.31.255.255`)
    - `192.168.0.0/16`
    - `127.0.0.1` / `localhost`
  - Hostname kết thúc bằng: `.local`, `.internal`, `.lan`, `.corp` hoặc danh sách tên miền được khai báo tường minh trong `enterprise-policy.json`.
- Mọi URL trỏ ra IP public công cộng ngoài danh sách sẽ bị từ chối với lỗi `lanAiInvalidHost`.

---

## 3. Cấu trúc Tệp Chính sách `enterprise-policy.json`

Tệp được đặt tại:
- macOS: `/Library/Application Support/SourceCraft/enterprise-policy.json` hoặc `<userData>/enterprise-policy.json`
- Windows: `C:\ProgramData\SourceCraft\enterprise-policy.json` hoặc `<userData>\enterprise-policy.json`
- Linux: `/etc/sourcecraft/enterprise-policy.json` hoặc `<userData>/enterprise-policy.json`

Schema:
```json
{
  "schemaVersion": 1,
  "policyId": "POLICY-ACME-CORP",
  "organization": "Tập đoàn ACME",
  "forceLocalOnly": true,
  "allowedLanHosts": ["*.acme.corp", "192.168.1.50"],
  "preconfiguredLanAi": {
    "enabled": true,
    "provider": "lan-ollama",
    "baseUrl": "http://192.168.1.50:11434",
    "chatModel": "qwen2.5:14b"
  },
  "enforceBackupEncryption": true
}
```

---

## 4. Trải nghiệm Người dùng & Giao diện

1. **Màn hình Cài đặt AI Runtime (`/settings`)**:
   - Thêm tab / lựa chọn **"Máy chủ AI Mạng nội bộ (LAN)"** (chỉ khả dụng khi có bản quyền Enterprise).
   - Chọn loại máy chủ: `Ollama Nội bộ` hoặc `Chuẩn OpenAI-Compatible (vLLM/LiteLLM)`.
   - Nhập `URL máy chủ` và `Khóa API (tùy chọn)`.
   - Khi có `enterprise-policy.json` áp dụng `forceLocalOnly: true`:
     - Các Cloud Provider (OpenAI/Anthropic/Gemini) bị mờ/khóa với nhãn *"Bị khóa bởi chính sách quản trị của tổ chức"*.
2. **Thanh Header & Trạng thái Riêng tư**:
   - Khi request chat/studio đang thực thi qua LAN AI, huy hiệu chuyển sang `mode: "lan"` với biểu tượng mạng nội bộ an toàn.
