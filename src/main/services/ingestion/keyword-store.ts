import type { Db } from "../../db/database";
import { buildFtsMatch } from "./fts-fold";

// Tìm keyword BM25 qua FTS5 (055, own-storage chunk_fts — text đã fold). JOIN chunk→source lọc notebook.
// I/O SQLite — phần thuần (fold/buildFtsMatch) ở fts-fold.ts. KHÔNG log câu hỏi/nội dung (Constitution III).

export interface KeywordHit {
  id: string; // chunk.id
  score: number; // bm25 (nhỏ = liên quan hơn)
}

export interface KeywordStore {
  /** Tìm topK chunk khớp keyword trong notebook (hoặc toàn cục nếu notebookId là null/rỗng) (055, 231). [] nếu query rỗng token. Ném nếu FTS chưa tồn tại. */
  searchBm25(
    notebookId: string | null | undefined,
    query: string,
    topK: number,
  ): KeywordHit[];
}

export function createKeywordStore(db: Db): KeywordStore {
  return {
    searchBm25(notebookId, query, topK) {
      const match = buildFtsMatch(query);
      if (match === "") return [];

      const isSpecificNotebook = Boolean(
        notebookId && notebookId.trim() !== "",
      );
      const sql = isSpecificNotebook
        ? `SELECT c.id AS id, bm25(chunk_fts) AS score
             FROM chunk_fts
             JOIN chunk c ON c.rowid = chunk_fts.rowid
             JOIN source s ON s.id = c.source_id
            WHERE chunk_fts MATCH ? AND s.notebook_id = ?
            ORDER BY score
            LIMIT ?`
        : `SELECT c.id AS id, bm25(chunk_fts) AS score
             FROM chunk_fts
             JOIN chunk c ON c.rowid = chunk_fts.rowid
             JOIN source s ON s.id = c.source_id
            WHERE chunk_fts MATCH ?
            ORDER BY score
            LIMIT ?`;

      const params = isSpecificNotebook
        ? [match, notebookId!, topK]
        : [match, topK];

      const rows = db.prepare(sql).all(...params) as unknown as KeywordHit[];
      return rows;
    },
  };
}
