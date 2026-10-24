# Kế hoạch Thực hiện (Execution Plan) — 231-cross-notebook-search

## 1. Mục tiêu Cần Đạt

Mở rộng hệ thống hỏi đáp RAG hỗ trợ tìm kiếm toàn cục đa sổ tay dành cho người dùng bản quyền Pro & Enterprise, tuân thủ nguyên tắc TDD và kiểm tra tự động.

## 2. Các Bước Triển khai Chi tiết

1. **Bước 1 — Nâng cấp Cổng Kiểm soát Bản quyền (`FeatureGate`)**:
   - Thêm `"crossNotebookSearch"` vào `DEFAULT_PRO_FEATURES` và `DEFAULT_ENTERPRISE_FEATURES`.
   - Bổ sung mã lỗi `licenseRequireProCrossSearch` và chuỗi i18n tiếng Việt + tiếng Anh.

2. **Bước 2 — Nâng cấp Tầng Lưu trữ (`vector-store.ts` & `keyword-store.ts`)**:
   - Cho phép `VectorStore.search` nhận `notebookId?: string | null`.
   - Cho phép `KeywordStore.searchBm25` nhận `notebookId?: string | null`.

3. **Bước 3 — Nâng cấp Tầng RAG Service & Retrieval**:
   - Hỗ trợ `notebookId?: string | null` trong `retrieve()` và `createRagService()`.
   - Bổ sung ánh xạ tên sổ tay vào `Citation` thông qua metadata nguồn.

4. **Bước 4 — Nâng cấp Giao diện Renderer (Chat RAG UI)**:
   - Thêm thanh chuyển đổi phạm vi tìm kiếm (`scope`: "Sổ tay này" / "Toàn bộ kho tri thức").
   - Hiển thị hộp thoại nâng cấp Pro nếu người dùng Free chọn chế độ toàn cục.
   - Hiển thị nhãn tên Sổ tay trên các chip trích dẫn `CitationChip`.

5. **Bước 5 — Kiểm thử, TDD & Hoàn tất**:
   - Viết unit tests cho tìm kiếm đa sổ tay và cổng bản quyền.
   - Chạy `check-template.py`, `npm run lint`, `npm test`, `npm run build`.
   - Tạo artifact mã nguồn và mở Pull Request #231.
