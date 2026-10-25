# So sánh văn bản & hợp đồng — các điểm làm rõ (233)

- Ngày: 2026-10-25
- Feature: `233-document-diff-redline` (issue #233). Trạng thái: **Đã chấp nhận** — chủ dự án chốt khi yêu cầu cập nhật
  spec/plan theo bản review kế hoạch ngày 2026-10-25.
- Nguồn câu hỏi: review kế hoạch #233 (đối chiếu plan với code trên branch, commit `a1dc43e`).

## Quyết định

1. **Đúng 2 nguồn, có vai trò.** `documentDiff` nhận **đúng 2** nguồn khác nhau qua `sourceIds` (sau khử trùng). Thứ tự
   mang nghĩa: `sourceIds[0]` = **bản gốc**, `sourceIds[1]` = **bản sửa đổi**. Không có `sourceIds` (cả notebook), 1 nguồn,
   hoặc ≥ 3 nguồn ⇒ `UserFacingError("studioDiffNeedTwoSources")`. Không suy vai trò theo thứ tự nạp hay tên file.
   - Lý do: "thêm / bỏ / sửa" chỉ có nghĩa khi biết chiều so sánh; ≥ 3 tài liệu không có chiều rõ ràng.
   - Không thêm field IPC mới: `resolveSourceScope` đã giữ thứ tự khi khử trùng và `source_ids_json` lưu đúng thứ tự ⇒
     tạo lại phiên bản giữ nguyên vai trò.
2. **Nguồn phải có nội dung.** Mỗi nguồn trong cặp phải `ready` **và có ≥ 1 chunk**; nguồn ready mà 0 chunk ⇒
   `studioDiffNeedTwoSources`. Kiểm tra chạy **trước** `contextInfo()` và trước mọi lời gọi AI.
3. **Ghép ngữ cảnh theo thứ tự vai trò.** Service dựng `groups` theo thứ tự `sourceIds` (gốc trước, sửa đổi sau), không theo
   thứ tự nguồn trong notebook. Tin nhắn user mở đầu bằng khối `<pair>` ghi rõ tên hai tài liệu theo vai trò (tên file là dữ
   liệu không tin cậy ⇒ trung hoà thẻ giống `neutralizeRequestTags`).
4. **Map-reduce riêng cho diff.** Khi vượt ngân sách:
   - đóng lô **theo từng nguồn** (một lô không trộn đoạn của hai bản);
   - map prompt riêng: trích **gần nguyên văn** từng điều khoản kèm số điều/tiêu đề và `[n]`, **không** được làm tròn hay
     lược số tiền, ngày, thời hạn, tỉ lệ, chủ thể nghĩa vụ, từ phủ định;
   - ghi chú của mỗi lô gắn nhãn vai trò (gốc / sửa đổi) trước khi vào bước viết cuối.
     Kết quả vẫn dùng cờ `truncated` / `parts` hiện có để cảnh báo khi phải cắt bớt.
5. **Quy tắc trích dẫn theo mục.** Điều khoản _bổ sung_ trích `[n]` từ bản sửa đổi; điều khoản _bị loại bỏ_ trích từ bản
   gốc; điều khoản _sửa đổi_ trích **cả hai** (ít nhất một `[n]` mỗi bản). v1 quy định trong prompt + test prompt; chưa hậu
   kiểm vai trò của `[n]` ở `postprocessCitations` (ghi nhận làm việc sau).
6. **Định dạng đầu ra (thay cho "bảng đối chiếu trực quan" của issue).** Markdown 4 mục; mục 4 là **bảng GFM**
   `Điều khoản | Bản gốc | Bản sửa đổi | Ảnh hưởng / rủi ro`, mỗi ô nội dung có `[n]`. `MarkdownContent` đã bật
   `remark-gfm` ⇒ hiển thị được. Exporter DOCX/PDF (#232) đã dựng bảng Markdown (`docx-generator.ts`, `pdf-generator.ts`). Phải
   kiểm thêm bằng test: chip `[n]` trong ô bảng bấm được, và bảng có `[n]` trong ô xuất đúng ở cả hai định dạng.
7. **Phân tích rủi ro chỉ dựa trên câu chữ nguồn.** Mô tả nghĩa vụ/quyền/rủi ro thay đổi **suy ra trực tiếp** từ đoạn được
   trích; không viện dẫn luật bên ngoài, không đưa lời khuyên pháp lý. Kết quả `documentDiff` hiện một dòng ghi chú cố
   định (i18n) "Không thay thế tư vấn pháp lý".
8. **Không làm huy hiệu PRO riêng.** Các loại Studio khác bị khoá ở gói Free (`faq`, `outline`, …) hiện cũng không có huy
   hiệu; chỉ hiện `UpgradePrompt` khi main từ chối (`licenseRequireProStudio`). `documentDiff` theo đúng cơ chế này để nhất
   quán. Huy hiệu cho **mọi** loại bị khoá (đọc `allowedStudioKinds`) là issue riêng.
9. **Bản quyền qua `allowedStudioKinds`, không thêm cờ `studioPro`.** Thêm `documentDiff` vào `STUDIO_ALL_KINDS`
   (Pro/Enterprise nhận đủ) và **không** thêm vào `FREE_ALLOWED_STUDIO_KINDS`. Gate vẫn ở biên IPC (`register.ts`).
10. **Chế độ chuyên gia (238) không áp dụng.** `domainMode` vẫn qua gate IPC như loại khác nhưng prompt `documentDiff`
    không ghép prompt chuyên gia ở v1 (studio service hiện không dùng `domainMode`).
11. **Migration v13.** CHECK cột `kind` của `studio_result` (v11) không chấp nhận `documentDiff` ⇒ dựng lại bảng theo mẫu
    v11 (tạo `_new`, copy **đủ mọi cột**, DROP, RENAME, dựng lại `idx_studio_notebook` + `idx_studio_versions`).
12. **Quy trình.** `docs/01-basic-design/` là nguồn gốc từ khách hàng (agent không tạo/sửa) ⇒ chuyển
    `docs/01-basic-design/document-diff/basic-design.md` sang `docs/intake/233-document-diff-design.md`. Sau khi cập nhật
    tasks ⇒ chạy `/speckit-analyze` trước `/speckit-implement`.

## Không làm ở feature này

- So sánh ≥ 3 tài liệu, so sánh giữa hai notebook, so sánh hai phiên bản của **cùng** một nguồn (chưa có lịch sử phiên bản
  nguồn).
- Diff ký tự / redline kiểu track-changes (gạch xoá, tô màu) — v1 là phân tích của LLM có trích dẫn.
- Hậu kiểm vai trò `[n]` theo mục (quyết định 5) và huy hiệu PRO (quyết định 8).
