# Plan: branded-export-docx-pdf

## 1. Giai đoạn 1: Kiểu dữ liệu & Bản quyền
- Cập nhật `LicenseFeature` trong `src/shared/ipc/types.ts` với cờ `brandedExport`.
- Cập nhật `DEFAULT_PRO_FEATURES`, `DEFAULT_ENTERPRISE_FEATURES` trong `feature-gate.ts`, `license-verifier.ts`, và `scripts/issue-license.mjs`.
- Bổ sung `licenseRequireProExport` vào `src/shared/codes/user-error.ts` và từ điển bản địa hóa `core.ts`.
- Đưa `licenseRequireProExport` và `licenseRequireProCrossSearch` vào `src/renderer/features/license-upsell/upsell-codes.ts`.

## 2. Giai đoạn 2: Tầng sinh tệp DOCX & PDF tại Main Process
- Xây dựng module zip tối giản và bộ sinh tệp `docx` chuẩn XML tại `src/main/services/studio/export/docx-generator.ts`.
- Xây dựng module sinh `pdf` tại `src/main/services/studio/export/pdf-generator.ts`.
- Cập nhật hàm xuất tài liệu `exportDocument` tại `src/main/services/studio/export.ts` để phân nhánh theo format và validate qua `dialog.showSaveDialog`.
- Gắn cổng bảo vệ bản quyền tại `src/main/ipc/register.ts` cho kênh `studio:export`.

## 3. Giai đoạn 3: UI Lựa chọn định dạng xuất báo cáo tại Renderer
- Bổ sung menu thả xuống hoặc nút lựa chọn định dạng (`MD`, `DOCX [PRO]`, `PDF [PRO]`) trong `StudioResultCard.tsx`.
- Tích hợp kiểm tra bản quyền ở client để kích hoạt modal nâng cấp khi người dùng Free ấn vào định dạng PRO.

## 4. Giai đoạn 4: Kiểm thử & Xác thực
- Viết unit test cho bộ sinh DOCX, bộ lọc hộp thoại lưu file và kiểm soát gating.
- Chạy `npm run lint`, `npm test` và `npm run build`.
