# Implementation Plan: LAN AI Server & Enterprise IT Policy (`lan-ai-and-policy`)

**Branch**: `228-lan-ai-and-policy` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

## Summary

Triển khai Pha 2 của lộ trình B2B Enterprise:
1. **SSRF Guard & LAN Address Validation (`lan-guard.ts`)**: Hàm kiểm tra địa chỉ mạng nội bộ thuần RFC1918, localhost và domain nội bộ.
2. **Enterprise Policy Service (`policy-service.ts`)**: Nạp tệp cấu hình `enterprise-policy.json` (chỉ đọc) từ hệ thống/userData để khóa cloud providers và cung cấp cấu hình mặc định.
3. **LAN AI Providers (`lan-ollama-provider.ts`, `lan-openai-provider.ts`)**: Hỗ trợ 2 chuẩn kết nối LLM nội bộ (Ollama & OpenAI-compatible) có kèm token bảo mật.
4. **Privacy Indicator Expansion (`privacy-state.ts`)**: Bổ sung trạng thái `mode: "lan"` trên Header để phân biệt rõ luồng dữ liệu nội bộ với Cloud công cộng.
5. **Renderer UI & Settings Integration**: Màn hình cài đặt LAN AI và vô hiệu hóa các nút Cloud Provider khi có policy `forceLocalOnly`.

## Constitution Check

- **I. Local-First & No Default Egress**: PASS — LAN AI chỉ giao tiếp trong mạng nội bộ đã xác thực (RFC1918), chặn 100% egress công cộng trừ khi người dùng chủ động cho phép.
- **III. Desktop Security Boundary**: PASS — Đọc policy và kiểm tra SSRF hoàn toàn ở Main process.
- **IV. Test-First & Coverage Discipline**: PASS — Unit test cho `lan-guard`, `policy-service`, `lan-ollama`, `lan-openai` đạt $\ge 80\%$ coverage.

## Project Structure

```text
src/
├── shared/
│   ├── codes/user-error.ts                      # +3 mã lỗi LAN AI & Policy
│   ├── ipc/channels.ts                          # +5 kênh IPC cho Policy & LAN AI
│   └── ipc/types.ts                             # LanAiConfig, EnterprisePolicy, PrivacyMode: "lan"
├── main/
│   ├── services/
│   │   ├── policy/
│   │   │   ├── policy-schema.ts                 # Zod/Schema validator cho enterprise-policy.json
│   │   │   └── policy-service.ts                # Đọc tệp policy từ hệ thống/userData
│   │   ├── ai-runtime/lan/
│   │   │   ├── lan-guard.ts                     # Hàm kiểm tra RFC1918 & domain nội bộ
│   │   │   ├── lan-ollama-client.ts             # Client giao tiếp LAN Ollama
│   │   │   └── lan-openai-client.ts             # Client giao tiếp vLLM / LiteLLM
│   │   └── app-shell/
│   │       └── privacy-state.ts                 # Hỗ trợ mode: "lan"
│   └── ipc/register.ts                          # Đăng ký IPC policy & lanAi
└── renderer/
    └── features/settings/
        └── LanAiSettingsSection.tsx             # Giao diện cấu hình LAN AI
```
