# Feature Specification: LAN AI Server & Enterprise IT Policy (`lan-ai-and-policy`)

**Branch**: `228-lan-ai-and-policy` | **Date**: 2026-10-24 | **Issue**: #228  
**Status**: Ready for Planning | **Input**: [basic-design.md](../../docs/01-basic-design/lan-ai-and-policy/basic-design.md), [intake/228-lan-ai-and-policy.md](../../docs/intake/228-lan-ai-and-policy.md)

---

## 1. User Stories & Acceptance Criteria

### User Story 1 (P1): Kết nối Máy chủ AI Mạng nội bộ (LAN AI Server) cho Gói Enterprise
Là một nhân viên trong doanh nghiệp sử dụng máy trạm cấu hình phổ thông, tôi muốn kết nối ứng dụng SourceCraft với máy chủ GPU trong mạng nội bộ công ty (chạy Ollama hoặc vLLM/OpenAI-compatible) để tôi có thể hỏi đáp RAG và chạy AI Studio với mô hình lớn mà dữ liệu không bị gửi ra ngoài Internet.

- **AC 1.1**: Người dùng có bản quyền `Enterprise` (hoặc tính năng `lanAi`) có thể mở mục cấu hình "Máy chủ AI Mạng nội bộ (LAN)" trong Cài đặt.
- **AC 1.2**: Hỗ trợ 2 giao thức: `lan-ollama` (gọi tới `/api/chat`, `/api/tags`) và `lan-openai` (gọi tới `/v1/chat/completions`, `/v1/models`).
- **AC 1.3**: Hỗ trợ lưu trữ khóa API hoặc Bearer token tùy chọn an toàn trong `keytar` / `SecretStore`.
- **AC 1.4**: Hệ thống kiểm tra địa chỉ máy chủ (SSRF Guard): chỉ cho phép các địa chỉ thuộc mạng nội bộ (RFC1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`/`localhost`, hoặc các tên miền nội bộ `.local`, `.internal`, `.lan`, `.corp`). Nếu nhập địa chỉ IP công cộng (vd `8.8.8.8` hoặc domain công cộng ngoài danh sách cho phép), hệ thống từ chối và báo lỗi `lanAiInvalidHost`.
- **AC 1.5**: Người dùng chưa kích hoạt bản quyền Enterprise không được phép kích hoạt LAN AI Server (hiển thị khóa PRO/Enterprise với thông báo yêu cầu nâng cấp bản quyền).

### User Story 2 (P1): Chỉ báo Bảo mật Mạng Nội bộ (`PrivacyState: "lan"`)
Là một người dùng quan tâm đến bảo mật và quyền riêng tư, tôi muốn thanh tiêu đề hiển thị rõ ràng khi tôi đang gửi dữ liệu tới máy chủ AI nội bộ thay vì máy chủ Cloud công cộng.

- **AC 2.1**: Khi provider active là LAN AI Server, `PrivacyState.mode` trả về `"lan"`.
- **AC 2.2**: Khi đang gửi yêu cầu Chat hoặc Studio tới LAN AI, huy hiệu hiển thị biểu tượng khiên bảo vệ và nhãn *"Mạng nội bộ (LAN) — Dữ liệu thuộc tổ chức"*.
- **AC 2.3**: Khi chuyển đổi giữa Local, LAN và Online, huy hiệu cập nhật tức thời qua kênh `privacyChanged`.

### User Story 3 (P2): Chính sách Quản trị Doanh nghiệp (`enterprise-policy.json`)
Là một Quản trị viên IT doanh nghiệp, tôi muốn cấu hình sẵn máy chủ LAN AI và khóa tính năng Cloud AI thông qua tệp `enterprise-policy.json` được phân phối qua MDM/GPO để nhân viên chỉ được sử dụng hạ tầng nội bộ của công ty.

- **AC 3.1**: Main process tự động nạp tệp `enterprise-policy.json` khi khởi động nếu tệp tồn tại ở vị trí hệ thống hoặc thư mục dữ liệu ứng dụng.
- **AC 3.2**: Nếu chính sách bật `forceLocalOnly: true`, ứng dụng khóa cứng tất cả các nhà cung cấp Cloud AI (OpenAI, Anthropic, Gemini). Trên giao diện Cài đặt, các nút bật Cloud AI bị vô hiệu hóa kèm nhãn cảnh báo *"Bị khóa bởi chính sách quản trị của tổ chức"*.
- **AC 3.3**: Nếu chính sách định nghĩa `preconfiguredLanAi`, ứng dụng tự động điền cấu hình máy chủ LAN AI mặc định cho người dùng.
- **AC 3.4**: Nếu chính sách định nghĩa `allowedLanHosts`, các hostname bổ sung này được hợp lệ hóa trong danh sách kiểm tra SSRF của LAN AI Server.

---

## 2. Functional Requirements (FR)

- **FR-001**: Main process cung cấp module `PolicyService` kiểm tra sự tồn tại và cú pháp JSON của `enterprise-policy.json` (bỏ qua an toàn nếu tệp không tồn tại).
- **FR-002**: Bổ sung hàm kiểm tra SSRF `validateLanHost(url, allowedHosts)` đảm bảo URL chỉ trỏ vào IP riêng RFC1918, localhost hoặc hostname nội bộ.
- **FR-003**: Cung cấp `LanOllamaProvider` kế thừa logic chat/stream của Ollama client nhưng cho phép URL nội bộ RFC1918 và Bearer token.
- **FR-004**: Cung cấp `LanOpenAIProvider` tương thích chuẩn OpenAI (`/v1/chat/completions`, `/v1/models`) cho máy chủ vLLM, LiteLLM, LocalAI.
- **FR-005**: Mở rộng `PrivacyState` trong `src/shared/ipc/types.ts` để hỗ trợ `mode: "lan"`.
- **FR-006**: Bổ sung các IPC handler: `policy:get`, `lanAi:testConnection`, `lanAi:saveConfig`.
- **FR-007**: Giao diện Cài đặt: hiển thị mục cấu hình LAN AI (có kiểm tra cờ `lanAi` của `FeatureGate`) và phản ánh chính sách `forceLocalOnly`.

---

## 3. Success Criteria (SC)

- **SC-001**: Kiểm tra SSRF chặn 100% các địa chỉ IP public công cộng khi cấu hình LAN AI.
- **SC-002**: Người dùng Enterprise có thể kết nối và hỏi đáp thành công với máy chủ Ollama/vLLM trong mạng nội bộ.
- **SC-003**: Khi `forceLocalOnly` được bật trong policy, không có bất kỳ request nào gửi tới OpenAI, Anthropic hoặc Google Gemini.
- **SC-004**: Toàn bộ unit test cho `PolicyService`, SSRF guard, `LanOllamaProvider`, `LanOpenAIProvider` đạt độ bao phủ coverage $\ge 80\%$.
