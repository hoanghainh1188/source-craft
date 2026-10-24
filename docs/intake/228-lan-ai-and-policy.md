# Intake — 228-lan-ai-and-policy

- Issue: #228 — "[feature] lan-ai-and-policy: Máy chủ AI Mạng nội bộ (LAN AI) và Chính sách Quản trị Doanh nghiệp (IT Policy)"
- Slug: `lan-ai-and-policy` (branch `228-lan-ai-and-policy`)
- Ngày intake: 2026-10-24
- Loại: tính năng MỚI (Pha 2 của lộ trình B2B Enterprise Edition). Chạm các tầng: `src/main/services/policy/` (Enterprise Policy Service đọc tệp `enterprise-policy.json`), `src/main/services/ai-runtime/` (LAN Ollama & LAN OpenAI-compatible provider, kiểm tra SSRF dải RFC1918), `src/main/services/app-shell/privacy-state.ts` (mở rộng trạng thái `mode: "lan"`), `src/shared/` (IPC types, channels, user-error codes, i18n vi/en), `src/preload/`, và `src/renderer/` (giao diện cấu hình LAN AI, khóa cloud theo policy, huy hiệu riêng tư LAN).

## Input sources

- [`docs/01-basic-design/lan-ai-and-policy/basic-design.md`](../01-basic-design/lan-ai-and-policy/basic-design.md) — **nguồn chính** (kiến trúc LAN AI, SSRF guard RFC1918, schema `enterprise-policy.json`, trải nghiệm UI và trạng thái bảo mật).
- [`docs/01-basic-design/enterprise-license/basic-design.md`](../01-basic-design/enterprise-license/basic-design.md) — kế thừa `FeatureGate`, cờ bản quyền `lanAi` và `itPolicy` từ Pha 1 (`226-enterprise-license`).
- [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) — I (Local-first & No Default Egress — LAN AI vận hành trong ranh giới mạng nội bộ của tổ chức), III (Desktop Security Boundary — kiểm tra SSRF và đọc policy tại main process), IV (TDD & coverage ≥ 80%).
- [`docs/00-glossary.md`](../00-glossary.md) — đã tra cứu thuật ngữ; bổ sung thuật ngữ LAN AI & IT Policy bên dưới.

## Prompt for /speckit-specify

Xây dựng hệ thống **Máy chủ AI Mạng nội bộ (LAN AI Server)** và **Chính sách Quản trị Doanh nghiệp (`enterprise-policy.json`)** cho ứng dụng SourceCraft nhằm hỗ trợ triển khai B2B Enterprise:

1. **Kết nối Máy chủ AI Mạng nội bộ (LAN AI Server):**
   - Hỗ trợ kết nối máy chủ LLM đặt trong mạng LAN của tổ chức với 2 giao thức:
     - **LAN Ollama**: gọi tới `/api/chat`, `/api/tags` với URL nội bộ và Bearer token (nếu có).
     - **LAN OpenAI-Compatible**: hỗ trợ vLLM, LiteLLM, LocalAI, TGI qua `/v1/chat/completions` và `/v1/models` với Bearer token (nếu có).
   - Kiểm tra ranh giới SSRF: Chỉ cho phép các địa chỉ thuộc dải IP nội bộ RFC1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`/`localhost`), tên miền `.local`, `.internal`, `.lan`, `.corp`, hoặc danh sách tên miền được khai báo trong Policy. Chặn tuyệt đối IP public tránh rò rỉ dữ liệu.
   - Kiểm tra bản quyền: Tính năng LAN AI chỉ khả dụng khi bản quyền có cờ `lanAi` (gói Enterprise).

2. **Chỉ báo Riêng tư Mạng Nội bộ (`PrivacyState: "lan"`):**
   - Mở rộng hệ thống trạng thái riêng tư: khi sử dụng LAN AI Server, huy hiệu bảo mật hiển thị trạng thái `mode: "lan"` với nhãn *"Mạng nội bộ (LAN) — Dữ liệu thuộc tổ chức"*.

3. **Chính sách Quản trị IT (`enterprise-policy.json`):**
   - Đọc tệp chính sách từ thư mục hệ thống hoặc thư mục ứng dụng lúc khởi động.
   - Khi `forceLocalOnly: true`: Khóa cứng không cho phép kích hoạt các nhà cung cấp Cloud AI thương mại (OpenAI, Anthropic, Gemini) trên giao diện.
   - Cung cấp cơ chế cấu hình sẵn địa chỉ `preconfiguredLanAi` để người dùng không phải tự nhập cấu hình.

## Ambiguities to raise in /speckit-clarify

0 ambiguities — các yêu cầu về giao thức, ranh giới dải IP riêng và chính sách khóa đám mây đã được xác định rõ ràng.

## Thuật ngữ mới (append vào glossary)

| Tiếng Việt | English (dùng trong code) | Ghi chú |
| --- | --- | --- |
| Máy chủ AI Mạng nội bộ | `LanAiServer` / `lanAi` | Máy chủ LLM chạy trong mạng LAN của doanh nghiệp (Ollama/vLLM) — 228 |
| Chính sách quản trị doanh nghiệp | `enterprise-policy.json` / `EnterprisePolicy` | Tệp cấu hình chỉ đọc do IT Admin cài đặt để khóa cloud hoặc cấu hình sẵn LAN AI — 228 |
| Trạng thái riêng tư mạng nội bộ | `PrivacyState` (`mode: "lan"`) | Chỉ báo bảo mật khi tương tác với LAN AI Server — 228 |
