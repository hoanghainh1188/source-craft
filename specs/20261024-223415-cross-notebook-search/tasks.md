# Danh sách Công việc (Tasks Breakdown) — 231-cross-notebook-search

## Giai đoạn 1: Schema & License Gate
- [ ] Task 1.1: Cập nhật `src/main/services/license/feature-gate.ts` (thêm `crossNotebookSearch` vào Pro & Enterprise).
- [ ] Task 1.2: Thêm `licenseRequireProCrossSearch` vào `src/shared/codes/user-error.ts` và từ điển i18n (`src/shared/i18n/domains/core.ts`).
- [ ] Task 1.3: Cập nhật `src/shared/ipc/types.ts` (`RagSearchScope`, `RagAskInput.scope`, `Citation.notebookName`).

## Giai đoạn 2: Tầng Lưu trữ & Retrieval
- [ ] Task 2.1: Sửa `src/main/services/ingestion/vector-store.ts` hỗ trợ tìm kiếm không lọc notebook khi `notebookId` là null/undefined.
- [ ] Task 2.2: Sửa `src/main/services/ingestion/keyword-store.ts` hỗ trợ BM25 không lọc notebook khi `notebookId` là null/undefined.
- [ ] Task 2.3: Sửa `src/main/services/rag/retrieval.ts` và `src/main/services/rag/rag-service.ts` xử lý `scope === "all"`.
- [ ] Task 2.4: Kiểm tra bản quyền `crossNotebookSearch` trong `src/main/ipc/register.ts` khi `input.scope === "all"`.

## Giai đoạn 3: Tầng Giao diện Người dùng (Renderer)
- [ ] Task 3.1: Thêm bộ chọn phạm vi tìm kiếm (`scope`) trong `src/renderer/features/rag-qa/`.
- [ ] Task 3.2: Hiển thị tên sổ tay trong danh sách trích dẫn `CitationChip`.

## Giai đoạn 4: Kiểm thử & Hoàn tất
- [ ] Task 4.1: Viết unit tests kiểm thử tìm kiếm toàn cục đa sổ tay (`tests/unit/rag/cross-notebook-search.test.ts`).
- [ ] Task 4.2: Chạy `check-template.py`.
- [ ] Task 4.3: Chạy `npm run lint`, `npm test`, `npm run build`.
- [ ] Task 4.4: Lưu artifact mã nguồn và tạo PR #231.
