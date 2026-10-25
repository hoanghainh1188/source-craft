# Implementation Plan: document-diff-redline

## Giai đoạn 1: Kiểu dữ liệu & Từ điển i18n
1. Mở rộng `StudioKind` với `"documentDiff"` trong `src/shared/ipc/types.ts`.
2. Thêm mã lỗi `studioDiffNeedTwoSources` trong `src/shared/codes/user-error.ts`.
3. Bổ sung bản dịch tiếng Việt và tiếng Anh trong `src/shared/i18n/domains/studio.ts` và `core.ts`.

## Giai đoạn 2: Prompts & Studio Service Logic
1. Cập nhật `src/main/services/studio/prompt.ts`:
   - Thêm `task("documentDiff", lang)` cấu trúc phân tích 4 phần: Tóm tắt thay đổi, Điều khoản thêm mới, Điều khoản bị bỏ, Điều khoản sửa đổi kèm đánh giá rủi ro.
2. Cập nhật `src/main/services/studio/studio-service.ts`:
   - Kiểm tra `kind === "documentDiff"`: nếu số lượng nguồn trong phạm vi < 2 thì ném `UserFacingError("studioDiffNeedTwoSources")`.

## Giai đoạn 3: Renderer UI & Trải nghiệm Nâng cấp
1. Cập nhật `src/renderer/features/studio/StudioColumn.tsx`:
   - Thêm `"documentDiff"` vào danh sách `KINDS` và `RESULT_KINDS`.
   - Hiển thị huy hiệu `PRO` bên cạnh nút `"So sánh văn bản"`.
   - Nếu gói Free bấm nút: kích hoạt `UpgradePrompt` với mã `licenseRequireProStudio`.
2. Thêm style CSS cho nút Pro trong Studio nếu cần.

## Giai đoạn 4: Unit Test & Verification
1. Viết unit test kiểm tra prompt của `documentDiff` trong `tests/unit/studio-prompt.test.ts`.
2. Viết unit test kiểm tra ràng buộc tối thiểu 2 nguồn trong `tests/unit/studio-service.test.ts`.
3. Viết unit test kiểm tra gate bản quyền gói Free / Pro trong `tests/unit/license/feature-gate.test.ts`.
4. Chạy `npm test`, `npm run lint`, và `npm run build`.
