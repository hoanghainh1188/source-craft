# Implementation Plan: document-diff-redline

- Spec: [`spec.md`](spec.md) · Data model: [`data-model.md`](data-model.md) · Quyết định:
  [`docs/04-decisions/2026-10-25-document-diff-clarify.md`](../../docs/04-decisions/2026-10-25-document-diff-clarify.md)

## Constitution check

| Nguyên tắc                | Cách đáp ứng                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Local-first / zero egress | Dùng lại `deps.chat` của Studio; không thêm kênh mạng. Không log nội dung, tên nguồn, id.                                                       |
| Kiểm chứng được (II)      | Khung `common()` + quy tắc `[n]` theo mục (FR-005); `postprocessCitations` như các loại khác.                                                   |
| Ranh giới bảo mật         | Kiểm tra cặp nguồn ở main (không tin renderer); gate bản quyền tại `register.ts` (đã có).                                                       |
| Cô lập theo feature       | Mã mới trong `src/main/services/studio/` + `src/renderer/features/studio/`; vùng chung chỉ: `types.ts`, `user-error.ts`, i18n, `migrations.ts`. |

## Bản đồ file

| File                                                                | Thay đổi                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/shared/ipc/types.ts`                                           | `StudioKind` + `documentDiff`; chú thích ngữ nghĩa `sourceIds` cho diff                              |
| `src/main/services/studio/constants.ts`                             | + `documentDiff` vào `STUDIO_KINDS`, `STUDIO_ALL_KINDS`                                              |
| `src/main/db/migrations.ts`                                         | migration **v13** dựng lại `studio_result` (data-model §4)                                           |
| `src/shared/codes/user-error.ts`, `src/shared/i18n/domains/core.ts` | mã + thông điệp `studioDiffNeedTwoSources`                                                           |
| `src/shared/i18n/domains/studio.ts`                                 | khoá `studio.kind.documentDiff`, `studio.diff.*` (data-model §6)                                     |
| `src/main/services/studio/prompt.ts`                                | `task("documentDiff")`, nhãn mục/cột theo ngôn ngữ, khối `<pair>` trong `finalUserContent`           |
| `src/main/services/studio/map-reduce.ts`                            | đóng lô theo nguồn + map prompt diff + nhãn vai trò cho ghi chú (khi `kind === "documentDiff"`)      |
| `src/main/services/studio/studio-service.ts`                        | kiểm tra cặp (FR-003), dựng `groups` theo thứ tự `sourceIds`, truyền vai trò xuống prompt/map-reduce |
| `src/renderer/features/studio/StudioDiffPicker.tsx` (mới)           | bộ chọn Bản gốc / Bản sửa đổi + hoán đổi + nút So sánh                                               |
| `src/renderer/features/studio/StudioColumn.tsx`                     | nút mở picker; `documentDiff` vào `RESULT_KINDS` (không vào `KINDS` của hàng nút thường)             |
| `src/renderer/features/studio/StudioResultCard.tsx`                 | ghi chú `studio.diff.disclaimer` cho `documentDiff`                                                  |
| `src/renderer/features/studio/studio.css`                           | style picker (token CSS hiện có)                                                                     |
| `src/main/services/studio/export-name.ts` + exporter                | nhãn loại / tên file cho `documentDiff` (nếu chưa tự lấy từ i18n)                                    |
| `docs/intake/233-document-diff-design.md`                           | chuyển từ `docs/01-basic-design/document-diff/basic-design.md` (D12)                                 |

## Giai đoạn 0: Dọn quy trình

1. `git mv docs/01-basic-design/document-diff/basic-design.md docs/intake/233-document-diff-design.md`; sửa sơ đồ trong đó
   cho khớp D1 (đúng 2 nguồn, có vai trò) và D8 (không huy hiệu PRO).

## Giai đoạn 1: Nền dữ liệu (test trước)

1. Test migration v13 (`tests/unit/migration-studio-diff.test.ts`): DB v12 có dòng Studio đủ cột (`custom_prompt`,
   `source_ids_json`, `parts`, `truncated`, `local`) ⇒ sau v13 giữ nguyên giá trị; INSERT `documentDiff` thành công; `kind`
   lạ vẫn bị CHECK từ chối; danh sách CHECK khớp `STUDIO_ALL_KINDS`.
2. Thêm `documentDiff` vào `StudioKind`, `STUDIO_KINDS`, `STUDIO_ALL_KINDS`; viết migration v13.
3. Mã lỗi `studioDiffNeedTwoSources` + bản dịch vi/en; khoá i18n `studio.kind.documentDiff`, `studio.diff.*`. Giữ xanh
   `i18n-catalog.test.ts` và `i18n-no-hardcoded-vi.test.ts`.

## Giai đoạn 2: Prompt (test trước)

1. Test trong `tests/unit/studio-prompt.test.ts`:
   - `systemPromptFor("documentDiff", vi|en)` có 4 tiêu đề mục đúng ngôn ngữ, tiêu đề cột bảng, quy tắc `[n]` theo mục
     (FR-005), câu "không phát hiện" cho mục rỗng, ràng buộc rủi ro chỉ từ câu chữ nguồn (FR-008).
   - `finalUserContent("documentDiff", …)` mở đầu bằng `<pair>` có tên gốc/sửa đổi đúng thứ tự; tên chứa `<pair>` /
     `<request>` bị trung hoà.
2. Cài `task("documentDiff")` (dùng khung `common()`), nhãn theo ngôn ngữ (như `FAQ_LABELS`), mở rộng `finalUserContent`
   nhận thông tin cặp (tham số tuỳ chọn — loại khác không đổi hành vi).

## Giai đoạn 3: Service & map-reduce (test trước)

1. Test trong `tests/unit/studio-service.test.ts`:
   - thiếu `sourceIds`, 1 id, 2 id trùng nhau, 3 id ⇒ `studioDiffNeedTwoSources`, `deps.chat` và `contextInfo` không được gọi;
   - một nguồn ready nhưng 0 chunk ⇒ `studioDiffNeedTwoSources`;
   - id lạ / chưa ready ⇒ giữ mã cũ (`studioSourcesInvalid` / `studioSourceNotReady`);
   - nguồn trong notebook xếp [B, A] mà `sourceIds = [A, B]` ⇒ đoạn của A đánh số trước, `<pair>` ghi A là bản gốc;
   - kết quả lưu `sourceIds = [A, B]` đúng thứ tự.
2. Test trong `tests/unit/studio-map-reduce.test.ts`: với `documentDiff`, không lô nào chứa đoạn của cả hai nguồn; map
   prompt là prompt diff (gần nguyên văn, giữ số liệu); ghi chú vào bước cuối có nhãn vai trò; các loại khác vẫn đóng lô như cũ.
3. Cài kiểm tra cặp trong `studio-service.ts` ngay sau `resolveSourceScope` (trước `contextInfo()`); dựng `groups` theo thứ tự
   `scope.ids` khi diff; truyền vai trò cho prompt + map-reduce.
4. Cài đóng lô theo nguồn (`packBatches` gọi riêng từng nhóm) + map prompt diff trong `map-reduce.ts`.

## Giai đoạn 4: Bản quyền

1. Test `tests/unit/license/feature-gate.test.ts`: Free ⇒ `assertCanGenerateStudio("documentDiff")` ném
   `licenseRequireProStudio`; Pro, Enterprise ⇒ qua.
2. Không cần mã mới nếu Giai đoạn 1 đã thêm vào `STUDIO_ALL_KINDS`; xác nhận `register.ts` gate trước khi vào service.

## Giai đoạn 5: Renderer (test trước)

1. Test mới `tests/unit/studio-diff-picker.test.ts`: chỉ liệt kê nguồn ready; điền sẵn khi phạm vi có đúng 2 nguồn; hoán
   đổi đổi vai trò; nút So sánh tắt khi chưa đủ 2 nguồn khác nhau; gửi `sourceIds = [gốc, sửa đổi]`.
2. Cập nhật `tests/unit/studio-kinds-layout.test.ts` (danh sách nút cố định) và test thẻ kết quả: `documentDiff` hiện ghi chú
   disclaimer; Free bị từ chối ⇒ `UpgradePrompt` hiện.
3. Cài `StudioDiffPicker.tsx`, nối vào `StudioColumn.tsx` (dùng `run(kind, …, sourceIds)` hiện có của `useStudio`), thêm
   `documentDiff` vào `RESULT_KINDS`, CSS bằng token có sẵn; trạng thái focus/hover theo kiểu nút Studio hiện có.
4. Kiểm tra chip `[n]` trong ô bảng GFM bấm được (test với `MarkdownContent`).

## Giai đoạn 6: Xuất DOCX/PDF

1. Test (`studio-export-docx.test.ts`, `studio-export-pdf.test.ts`, `studio-export-name.test.ts`): kết quả `documentDiff` có
   bảng chứa `[n]` xuất đúng; tên file/nhãn loại đúng vi/en.
2. Bổ sung nhãn nếu exporter/`export-name.ts` không tự lấy từ i18n.

## Giai đoạn 7: Quality gates

1. `npm test`, `npm run lint`, `npm run build`; coverage ≥ 80% phần mã mới/đổi.
2. `/speckit-analyze` trước `/speckit-implement`; sau implement: code-reviewer → glossary-steward (thuật ngữ "bản gốc",
   "bản sửa đổi", "so sánh văn bản") → security-reviewer (prompt injection qua tên file / nội dung nguồn).

## Rủi ro còn lại

- Chất lượng so sánh phụ thuộc model local; tài liệu rất dài vẫn có thể bị cắt (`truncated`) — chấp nhận ở v1, có cảnh báo.
- Vai trò `[n]` theo mục chỉ được ép bằng prompt, chưa hậu kiểm (D5).
