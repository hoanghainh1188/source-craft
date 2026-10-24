# Bảng Kiểm Tra Yêu Cầu (Requirements Checklist) — 231-cross-notebook-search

## Yêu cầu Kiểm tra

- [ ] **CHK-01**: Cập nhật `DEFAULT_PRO_FEATURES` và `DEFAULT_ENTERPRISE_FEATURES` trong `src/main/services/license/feature-gate.ts` bổ sung `"crossNotebookSearch"`.
- [ ] **CHK-02**: Thêm mã lỗi `licenseRequireProCrossSearch` vào `src/shared/codes/user-error.ts` và từ điển bản địa hóa i18n (tiếng Việt và tiếng Anh).
- [ ] **CHK-03**: Mở rộng `RagAskInput` và `RagAskStreamInput` với trường tùy chọn `scope?: "current" | "all"`.
- [ ] **CHK-04**: Mở rộng `VectorStore.search` và `KeywordStore.searchBm25` hỗ trợ `notebookId?: string | null` (khi null thì tìm kiếm toàn cục).
- [ ] **CHK-05**: Bổ sung `notebookId` và `notebookName` vào `Citation` và giao diện chip dẫn chứng `CitationChip`.
- [ ] **CHK-06**: Tích hợp nút chuyển đổi phạm vi tìm kiếm trên thanh Chat RAG và chặn khi người dùng chưa nâng cấp bản quyền Pro.
- [ ] **CHK-07**: Viết bộ unit tests đầy đủ cho truy xuất cross-notebook và cổng bản quyền.
