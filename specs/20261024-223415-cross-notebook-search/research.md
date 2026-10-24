# Nghiên cứu Kỹ thuật: Tìm kiếm Toàn cục Đa Sổ tay (`cross-notebook-search`)

## 1. Truy vấn Vector LanceDB khi bỏ lọc Notebook

- Trong LanceDB hiện tại:
  ```typescript
  const rows = await t
    .search(queryVector)
    .distanceType("cosine")
    .where(`notebook_id = '${q(notebookId)}'`)
    .limit(topK)
    .toArray();
  ```
- Khi `notebookId` không được truyền (hoặc là `null`), ta chỉ cần bỏ phương thức `.where(...)` hoặc không lọc `notebook_id`:
  ```typescript
  let query = t.search(queryVector).distanceType("cosine");
  if (notebookId) {
    query = query.where(`notebook_id = '${q(notebookId)}'`);
  }
  const rows = await query.limit(topK).toArray();
  ```
- Hiệu năng: LanceDB lưu trữ vector theo dạng cột (Apache Arrow / Parquet). Khi không có bộ lọc `where`, tốc độ quét vector thậm chí còn nhanh hơn do không tốn chi phí kiểm tra điều kiện biểu thức trên từng dòng.

## 2. Truy vấn FTS5 BM25 trong SQLite

- Câu lệnh hiện tại trong `keyword-store.ts`:
  ```sql
  SELECT c.id AS id, bm25(chunk_fts) AS score
    FROM chunk_fts
    JOIN chunk c ON c.rowid = chunk_fts.rowid
    JOIN source s ON s.id = c.source_id
   WHERE chunk_fts MATCH ? AND s.notebook_id = ?
   ORDER BY score
   LIMIT ?
  ```
- Khi tìm kiếm toàn cục (`notebookId === null`):
  ```sql
  SELECT c.id AS id, bm25(chunk_fts) AS score
    FROM chunk_fts
    JOIN chunk c ON c.rowid = chunk_fts.rowid
    JOIN source s ON s.id = c.source_id
   WHERE chunk_fts MATCH ?
   ORDER BY score
   LIMIT ?
  ```
- SQLite tận dụng tối đa chỉ mục toàn văn FTS5, thời gian truy vấn dưới 5ms cho kho tài liệu hàng trăm nghìn đoạn trích.

## 3. Xác định Tên Sổ tay trong Trích dẫn (Citation Resolution)

- Hiện tại `sourceRepo.getById(sourceId)` trả về đối tượng `Source` có trường `notebookId`.
- Dùng `notebookRepo.list().find(n => n.id === src.notebookId)?.name` để lấy tên sổ tay hiển thị trên giao diện người dùng.
- Hiển thị chip trích dẫn: `[1] Sổ tay Pháp lý › Hop_Dong.pdf (Trang 5)` giúp người dùng phân biệt rõ ngữ cảnh của từng tài liệu.
