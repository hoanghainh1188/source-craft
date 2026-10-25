# Research: Document Diff & Contract Redline

## 1. Cơ chế đối chiếu ngữ cảnh của LLM

- `citationBlock` ghi `[n] (Source: <sourceTitle>, page <pageLabel>)` trước mỗi đoạn ⇒ LLM biết đoạn thuộc tài liệu nào.
  Nhưng chưa có **vai trò** (gốc / sửa đổi) ⇒ cần khối `<pair>` (D3).
- `studio-service.ts` dựng `groups` theo thứ tự nguồn **trong notebook**, không theo `sourceIds` ⇒ diff phải dựng theo thứ
  tự `scope.ids`. `resolveSourceScope` đã giữ thứ tự khi khử trùng.

## 2. Map-reduce với tài liệu dài

- `packBatches` (`map-reduce.ts`) đóng lô tham lam trên toàn bộ khối đã đánh số ⇒ một lô có thể chứa đoạn của cả hai bản.
- `mapPrompt` chỉ rút "các ý chính" ⇒ dễ mất đúng khác biệt cần so (số tiền, thời hạn, phủ định).
- ⇒ D4: đóng lô theo nguồn, map prompt riêng trích gần nguyên văn, ghi chú gắn nhãn vai trò.

## 3. Kiểm soát bản quyền

- `assertCanGenerateStudio` so `kind` với `entitlements.allowedStudioKinds`. Pro/Enterprise lấy `STUDIO_ALL_KINDS`
  (`feature-gate.ts:94`), Free lấy `FREE_ALLOWED_STUDIO_KINDS` (`summary`, `keyPoints`).
- `documentDiff` chỉ thuộc Pro khi được thêm vào `STUDIO_ALL_KINDS` (không tự động).
- Renderer hiện không có huy hiệu PRO cho loại Studio bị khoá; chỉ `UpgradePrompt` khi lỗi ⇒ D8.

## 4. Lưu trữ

- CHECK `kind` của `studio_result` (migration v11, `migrations.ts:263`) cố định 9 loại ⇒ cần migration v13 (D11).

## 5. Hiển thị & xuất

- `MarkdownContent` dùng `remark-gfm` ⇒ bảng hiển thị được.
- `docx-generator.ts` và `pdf-generator.ts` đã dựng bảng Markdown ⇒ chỉ cần test khoá cho bảng có `[n]`.
