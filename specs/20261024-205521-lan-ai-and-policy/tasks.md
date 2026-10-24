# Tasks: LAN AI Server & Enterprise IT Policy (`lan-ai-and-policy`)

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/lan-ai-ipc.md](./contracts/lan-ai-ipc.md)

## Phase 1: Setup & Shared Contracts
- [ ] T001 [P] Thêm `EnterprisePolicy`, `LanAiConfig`, `LanAiTestResult`, mở rộng `PrivacyMode: "lan"` trong `src/shared/ipc/types.ts`
- [ ] T002 [P] Thêm channels `policyGet`, `lanAiGetConfig`, `lanAiSaveConfig`, `lanAiTestConnection`, `lanAiListModels` vào `src/shared/ipc/channels.ts`
- [ ] T003 [P] Thêm mã lỗi `lanAiInvalidHost`, `lanAiRequireEnterprise`, `policyCloudDisabled` trong `src/shared/codes/user-error.ts`
- [ ] T004 [P] Thêm chuỗi i18n cho LAN AI & IT Policy trong `src/shared/i18n/domains/core.ts`

## Phase 2: Core Foundational Logic & Security Guards
- [ ] T005 [P] Viết unit tests cho SSRF Guard (`validateLanUrl` với IP RFC1918, loopback, public IP, domain nội bộ) trong `tests/unit/lan/lan-guard.test.ts`
- [ ] T006 Triển khai `validateLanUrl` trong `src/main/services/ai-runtime/lan/lan-guard.ts`
- [ ] T007 [P] Viết unit tests cho `PolicyService` (nạp file, schema parse, fallback khi file thiếu) trong `tests/unit/policy/policy-service.test.ts`
- [ ] T008 Triển khai `PolicyService` trong `src/main/services/policy/policy-service.ts`

## Phase 3: LAN AI Providers & Privacy State
- [ ] T009 [P] Viết unit tests cho `LanOllamaClient` và `LanOpenAiClient` trong `tests/unit/lan/lan-clients.test.ts`
- [ ] T010 Triển khai `LanOllamaClient` và `LanOpenAiClient` trong `src/main/services/ai-runtime/lan/`
- [ ] T011 Cập nhật `src/main/services/app-shell/privacy-state.ts` hỗ trợ `mode: "lan"` và badge tương ứng

## Phase 4: Main IPC & Settings UI Integration
- [ ] T012 Đăng ký các IPC handlers trong `src/main/ipc/register.ts` và tích hợp vào `src/main/index.ts`
- [ ] T013 Expose các API trong `src/preload/index.ts`
- [ ] T014 Triển khai giao diện cấu hình LAN AI và phản ánh Policy trong `src/renderer/features/app-shell/SettingsLanAiSection.tsx` và gắn vào `SettingsPage.tsx`
- [ ] T015 Cập nhật huy hiệu hiển thị riêng tư trên `AppHeader.tsx` khi ở trạng thái LAN

## Phase 5: Verification Gate
- [ ] T016 Chạy `python3 .github/scripts/check-template.py` kiểm tra tài liệu
- [ ] T017 Chạy `npm run lint && npm test && npm run build` đảm bảo 100% tests pass và coverage $\ge 80\%$
