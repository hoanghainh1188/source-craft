# Specification: document-diff-redline

- Issue: #233 · Branch: `233-document-diff-redline`
- Quyết định làm rõ: [`docs/04-decisions/2026-10-25-document-diff-clarify.md`](../../docs/04-decisions/2026-10-25-document-diff-clarify.md)
  (viết tắt **D1..D12** bên dưới).

## 1. Bối cảnh & Mục tiêu

Khi làm việc với các phiên bản hợp đồng hoặc tài liệu quy phạm (phụ lục, thỏa thuận sửa đổi, văn bản chính sách), người dùng
chuyên nghiệp (luật sư, kế toán, chuyên viên thu mua) tốn hàng giờ đọc thủ công để phát hiện bên kia đã sửa điều khoản gì và
rủi ro phát sinh là gì. Loại Studio `documentDiff` so sánh **một bản gốc** với **một bản sửa đổi** trong cùng notebook, chỉ
dựa trên nội dung đã nạp, mọi nhận định kèm trích dẫn `[n]` kiểm chứng được.

## 2. User stories & Acceptance scenarios

### US1 — So sánh hai phiên bản hợp đồng (P1)

Người dùng Pro/Enterprise chọn bản gốc và bản sửa đổi, bấm "So sánh văn bản", nhận bản phân tích 4 mục có trích dẫn.

1. **Given** notebook có `HopDong_Goc.pdf` và `HopDong_SuaDoi.pdf` đều ready, gói Pro, **When** người dùng chọn gốc =
   `HopDong_Goc.pdf`, sửa đổi = `HopDong_SuaDoi.pdf` và bấm "So sánh", **Then** kết quả có đủ 4 mục (FR-004), mục 4 là bảng,
   mỗi nhận định có `[n]`, bấm chip mở đúng đoạn nguồn.
2. **Given** kết quả ở (1), **When** người dùng bấm hoán đổi rồi so sánh lại, **Then** "bổ sung" và "bị loại bỏ" đổi chỗ
   tương ứng (vai trò theo thứ tự chọn — D1).
3. **Given** một kết quả `documentDiff`, **When** người dùng tạo lại phiên bản, **Then** phiên bản mới giữ nguyên cặp và vai
   trò (D1).

### US2 — Chặn đầu vào không hợp lệ (P1)

1. **Given** người dùng chưa chọn đủ 2 nguồn khác nhau, **When** bấm "So sánh", **Then** nút bị vô hiệu ở renderer; nếu yêu
   cầu vẫn tới main (gửi trực tiếp) ⇒ lỗi `studioDiffNeedTwoSources`, không gọi AI.
2. **Given** một nguồn trong cặp ready nhưng không có chunk, **When** so sánh, **Then** lỗi `studioDiffNeedTwoSources` (D2).
3. **Given** một id không thuộc notebook / chưa ready, **When** so sánh, **Then** lỗi hiện có `studioSourcesInvalid` /
   `studioSourceNotReady` (không đổi hành vi `resolveSourceScope`).

### US3 — Gói Free (P2)

1. **Given** gói Free, **When** người dùng chạy so sánh, **Then** main từ chối với `licenseRequireProStudio` và
   `UpgradePrompt` hiện dưới lỗi; không gọi AI (D8, D9).

### US4 — Tài liệu dài (P2)

1. **Given** cặp hợp đồng vượt ngân sách ngữ cảnh, **When** so sánh, **Then** chạy map-reduce theo D4: không lô nào trộn
   đoạn của hai bản; ghi chú giữ số liệu/ngày/thời hạn gần nguyên văn; kết quả đánh dấu `truncated` nếu phải cắt.

## 3. Yêu cầu chức năng (FR)

- **FR-001**: Thêm `documentDiff` vào `StudioKind` (`src/shared/ipc/types.ts`), `STUDIO_KINDS` và `STUDIO_ALL_KINDS`
  (`src/main/services/studio/constants.ts`). Không thêm vào `FREE_ALLOWED_STUDIO_KINDS` (D9).
- **FR-002**: Migration **v13** dựng lại `studio_result` để CHECK `kind` chấp nhận `documentDiff`, giữ nguyên mọi dòng và cột
  hiện có (D11).
- **FR-003**: Đầu vào: đúng 2 id khác nhau trong `sourceIds` sau khử trùng; `sourceIds[0]` = bản gốc, `sourceIds[1]` = bản
  sửa đổi. Thiếu / 1 / ≥ 3 id, hoặc một nguồn không có chunk ⇒ `UserFacingError("studioDiffNeedTwoSources")`. Kiểm tra
  trước `contextInfo()` và mọi lời gọi AI (D1, D2).
- **FR-004**: `task("documentDiff")` yêu cầu Markdown 4 mục: (1) Tổng quan thay đổi; (2) Điều khoản bổ sung; (3) Điều khoản
  bị loại bỏ; (4) Điều khoản sửa đổi & phân tích rủi ro dạng bảng GFM `Điều khoản | Bản gốc | Bản sửa đổi | Ảnh hưởng / rủi
ro`. Mục không có thay đổi ⇒ một câu nêu rõ "không phát hiện", kèm `[n]` của đoạn đã đối chiếu (D6).
- **FR-005**: Quy tắc trích dẫn theo mục: bổ sung ⇒ `[n]` từ bản sửa đổi; loại bỏ ⇒ từ bản gốc; sửa đổi ⇒ ít nhất một `[n]`
  mỗi bản (D5). Câu không có `[n]` bị coi là không hợp lệ (khung `common()` hiện có).
- **FR-006**: Ngữ cảnh ghép theo thứ tự vai trò; tin nhắn user mở đầu bằng khối `<pair>` nêu tên bản gốc và bản sửa đổi; tên
  file được trung hoà thẻ (D3).
- **FR-007**: Map-reduce cho `documentDiff`: đóng lô theo nguồn, map prompt trích gần nguyên văn, ghi chú gắn nhãn vai trò
  (D4).
- **FR-008**: Phân tích rủi ro chỉ suy từ câu chữ được trích, không viện dẫn luật ngoài, không khuyên pháp lý; thẻ kết quả
  `documentDiff` hiện ghi chú cố định "Không thay thế tư vấn pháp lý" (i18n) (D7).
- **FR-009**: Renderer: nút "So sánh văn bản" mở bộ chọn cặp (2 ô chọn Bản gốc / Bản sửa đổi chỉ liệt kê nguồn ready, nút
  hoán đổi); điền sẵn nếu phạm vi hiện tại có đúng 2 nguồn; nút "So sánh" chỉ bật khi đã chọn 2 nguồn khác nhau. Kết quả nằm
  trong `RESULT_KINDS` (versions, huỷ, tiến độ, xuất như loại khác).
- **FR-010**: Bản quyền: gate tại `register.ts` qua `assertCanGenerateStudio` (đã có); gói Free thấy `UpgradePrompt` khi bị từ
  chối; không có huy hiệu PRO riêng (D8).
- **FR-011**: Xuất DOCX/PDF (#232): tên loại và tên file có nhãn cho `documentDiff`; bảng mục 4 (có `[n]` trong ô) xuất đúng ở
  cả DOCX và PDF — exporter đã hỗ trợ bảng Markdown, cần test khoá (D6).
- **FR-012**: `domainMode` không thay đổi prompt `documentDiff` ở v1 (D10).

## 4. Ràng buộc phi chức năng (NFR)

- **NFR-001**: Không network egress khi dùng AI cục bộ / LAN; không log nội dung, tên nguồn hay id (Constitution III).
- **NFR-002**: Mọi chuỗi giao diện qua `src/shared/i18n` (vi là nguồn, en đủ khoá).
- **NFR-003**: TDD, coverage ≥ 80% cho phần mã mới/đổi.
- **NFR-004**: Migration v13 chạy trong giao dịch của runner hiện có; DB cũ (v12) nâng cấp không mất dữ liệu Studio.

## 5. Edge cases

- Hai nguồn giống hệt nhau (nội dung) ⇒ mục 2–4 ghi "không phát hiện thay đổi" kèm `[n]`.
- Hai tài liệu khác chủ đề ⇒ mục 1 nêu rõ hai văn bản không phải hai phiên bản của nhau; không bịa đối ứng điều khoản.
- Tên file chứa `<pair>` / `<request>` ⇒ bị trung hoà, không phá khung prompt.
- Nguồn bị xoá sau khi đã tạo kết quả ⇒ thẻ kết quả hiển thị như các loại khác (scope note hiện có).

## 6. Success criteria

- **SC-001**: Bộ test hiện có + test mới xanh; `npm run lint`, `npm run build` sạch.
- **SC-002**: Với cặp hợp đồng mẫu trong test, prompt cuối chứa đủ 4 mục, khối `<pair>` đúng vai trò và quy tắc trích dẫn
  FR-005.
- **SC-003**: DB v12 có dữ liệu Studio nâng cấp lên v13 giữ nguyên số dòng và giá trị mọi cột; lưu được dòng
  `kind='documentDiff'`.
- **SC-004**: Gói Free không gọi AI khi chạy `documentDiff`.

## 7. Ngoài phạm vi

Xem mục "Không làm ở feature này" trong D-file: ≥ 3 tài liệu, so sánh giữa notebook, redline track-changes, hậu kiểm vai trò
`[n]`, huy hiệu PRO.
