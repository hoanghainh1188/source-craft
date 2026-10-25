# Plan: domain-specific-ai-modes

## 1. Giai Đoạn 1: Định Nghĩa Dữ Liệu & Bản Quyền
- Khai báo kiểu `DomainMode` (`"general" | "legal" | "medical"`).
- Thêm cờ `specialistAiModes` vào `LicenseFeature`, `DEFAULT_PRO_FEATURES`, `DEFAULT_ENTERPRISE_FEATURES`, `VALID_FEATURES` và `scripts/issue-license.mjs`.
- Bổ sung mã lỗi `licenseRequireProSpecialistModes` vào `USER_ERROR_CODES`, `UPSELL_CODES` và tệp dịch `core.ts`.

## 2. Giai Đoạn 2: Xây Dựng Lời Nhắc Chuyên Gia & Cấu Hình Sampling
- Mở rộng `src/main/services/rag/prompt.ts`:
  - `legalSystemPrompt`: Chỉ đạo trích dẫn chi tiết Điều/Khoản/Điểm, đối chiếu nghĩa vụ.
  - `medicalSystemPrompt`: Chỉ đạo đối chiếu bằng chứng lâm sàng, chèn tuyên bố miễn trừ y khoa.
- Cập nhật `src/main/services/rag/rag-service.ts` để truyền `domainMode` và thiết lập `temperature: 0.1` khi gọi `chat` / `chatStream`.
- Cập nhật `src/main/services/ai-runtime/` (Ollama/Online providers) để truyền tham số `temperature` xuống API mô hình.

## 3. Giai Đoạn 3: Kiểm Soát Biên IPC & Giao Diện Người Dùng (UI)
- Kiểm tra quyền `specialistAiModes` tại `src/main/ipc/register.ts` cho các kênh `rag:ask`, `rag:askStream`, `studio:generate`.
- Xây dựng component `DomainSelector` hoặc tích hợp vào composer của `ChatColumn` và `useChat`.
- Hiển thị huy hiệu PRO tại các chế độ chuyên ngành; kích hoạt popup `UpgradePrompt` khi người dùng Free click chọn.

## 4. Giai Đoạn 4: Kiểm Thử & Xác Nhận
- Viết unit tests kiểm tra:
  - Sinh prompt theo từng `domainMode`.
  - Tham số `temperature` được truyền chính xác.
  - Gated bản quyền chặn gói Free và mở cho gói Pro/Enterprise.
- Chạy `npm run lint`, `npm test` và `npm run build`.
