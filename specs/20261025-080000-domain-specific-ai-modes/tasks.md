# Tasks: domain-specific-ai-modes

- [x] Task 1: Định nghĩa kiểu dữ liệu `DomainMode` và cờ bản quyền `specialistAiModes`.
- [x] Task 2: Cập nhật `feature-gate.ts`, `license-verifier.ts`, `scripts/issue-license.mjs` với `specialistAiModes`.
- [x] Task 3: Bổ sung mã lỗi `licenseRequireProSpecialistModes`, từ điển dịch thuật và đưa vào `UPSELL_CODES`.
- [x] Task 4: Xây dựng bộ lời nhắc chuyên gia (`legalSystemPrompt`, `medicalSystemPrompt`) trong `src/main/services/rag/prompt.ts`.
- [x] Task 5: Cập nhật `rag-service.ts` và `ai-runtime` để truyền tham số `temperature: 0.1` theo chế độ chuyên ngành.
- [x] Task 6: Gated tại biên IPC (`register.ts`) cho `rag:ask`, `rag:askStream`, `studio:generate`.
- [x] Task 7: Cập nhật giao diện `ChatColumn.tsx` và hook `useChat.ts` với selector chọn Chế độ Chuyên môn (Chung, Pháp lý, Y tế).
- [x] Task 8: Viết unit tests kiểm tra prompt, sampling và license gate.
- [x] Task 9: Kiểm tra toàn bộ test suite, lint và build sản phẩm.
