# Intake — 231-cross-notebook-search

- Issue: #231 — "[feature] cross-notebook-search: Tìm kiếm & Hỏi đáp RAG ngữ nghĩa toàn cục xuyên suốt mọi Sổ tay (Pro/Enterprise)"
- Slug: `cross-notebook-search` (branch `231-cross-notebook-search`)
- Ngày intake: 2026-10-24
- Loại: tính năng NÂNG CAO cho bản quyền **Pro** và **Enterprise** (`crossNotebookSearch`).
- Chạm các tầng:
  - `src/main/services/rag/` (mở rộng `retrieval.ts`, `rag-service.ts` hỗ trợ tìm kiếm đa notebook / toàn cục).
  - `src/main/services/ingestion/` (`keyword-store.ts` BM25 và `vector-store.ts` LanceDB hỗ trợ truy vấn không lọc theo 1 notebook).
  - `src/main/services/license/feature-gate.ts` (thêm quyền `crossNotebookSearch` cho Pro & Enterprise).
  - `src/shared/ipc/` (mở rộng `RagAskInput`, `RagAskStreamInput`, `Citation` với `scope?: "current" | "all"`, `notebookName?: string`).
  - `src/renderer/features/rag-qa/` (thêm toggle chọn phạm vi tìm kiếm: "Sổ tay này" hoặc "Toàn bộ kho tri thức").

## Input sources

- [`docs/01-basic-design/cross-notebook-search/basic-design.md`](../01-basic-design/cross-notebook-search/basic-design.md) — **nguồn chính** (kiến trúc truy vấn RAG đa sổ tay, phân tầng bản quyền).
- [`docs/01-basic-design/enterprise-license/basic-design.md`](../01-basic-design/enterprise-license/basic-design.md) — kế thừa `FeatureGate`, cờ bản quyền.
- [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) — I (Local-first & No Default Egress), II (Verifiable Citations), III (Desktop Security Boundary), IV (TDD & coverage ≥ 80%).

## Prompt for /speckit-specify

Xây dựng tính năng **Tìm kiếm & Hỏi đáp RAG Ngữ nghĩa Toàn cục Xuyên suốt Mọi Sổ tay (`cross-notebook-search`)**:

1. **Phân tầng bản quyền (Tính năng Nâng cao / Pro License):**
   - Chỉ người dùng có bản quyền **Pro** hoặc **Enterprise** (cờ `crossNotebookSearch`) mới được phép kích hoạt phạm vi "Toàn bộ kho tri thức" (`scope: "all"`).
   - Người dùng bản Miễn phí (Free) khi bật tùy chọn toàn cục sẽ hiển thị thông báo yêu cầu nâng cấp Pro (`licenseRequireProCrossSearch`).

2. **Truy vấn Hybrid Đa Sổ tay (Cross-Notebook Hybrid Retrieval):**
   - **Vector Search (LanceDB)**: Bỏ điều kiện lọc `notebook_id = '...'` khi `scope === "all"` để tìm kiếm top-K chunks tương đồng nhất trên toàn bộ kho lưu trữ.
   - **BM25 Search (SQLite FTS5)**: Bỏ điều kiện `AND s.notebook_id = ?` để truy xuất từ khóa toàn cục.
   - **RRF & MMR Fusion**: Tái sử dụng thuật toán Reciprocal Rank Fusion và Maximal Marginal Relevance để đa dạng hóa ngữ nghĩa và loại bỏ trùng lặp giữa các sổ tay.

3. **Trích dẫn Đầy đủ Nguồn & Sổ tay (Cross-Notebook Citation):**
   - Các trích dẫn `Citation` trả về phải chứa thêm `notebookId` và `notebookName` để người dùng biết đoạn trích thuộc về Sổ tay nào.
   - Giao diện chip trích dẫn hiển thị rõ: `[n] Tên Sổ tay › Tên Nguồn`.

## Ambiguities to raise in /speckit-clarify

0 ambiguities — các yêu cầu và ranh giới đã được làm rõ.

## Thuật ngữ mới (append vào glossary)

| Tiếng Việt | English (dùng trong code) | Ghi chú |
| --- | --- | --- |
| Tìm kiếm toàn cục đa sổ tay | `CrossNotebookSearch` | Truy vấn ngữ nghĩa và từ khóa xuyên suốt mọi notebook trong vault — 231 |
| Phạm vi tìm kiếm RAG | `RagSearchScope` | `"current"` (chỉ sổ tay hiện tại) hoặc `"all"` (toàn bộ kho tri thức) — 231 |
