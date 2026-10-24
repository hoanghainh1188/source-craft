// Kho vector cục bộ (LanceDB, ADR lancedb-integration). CHỈ ở main (Constitution III).
// Interface VectorStore để pipeline phụ thuộc trừu tượng → unit-test dùng mock, không cần LanceDB thật.
// File này (adapter thư viện native) loại khỏi ngưỡng coverage.

export interface VectorRecord {
  id: string; // = chunk.id
  notebookId: string;
  sourceId: string;
  vector: number[];
  dim: number;
}

export interface VectorHit {
  id: string;
  sourceId: string;
}

/** Kết quả tìm kiếm vector (013-rag-qa). `score` = khoảng cách (nhỏ = liên quan hơn). */
export interface VectorSearchHit {
  id: string; // = chunk.id
  sourceId: string;
  score: number;
}

/** 116: số liệu kho cho cổng bảo trì + nhật ký. */
export interface VectorStoreStats {
  fragmentCount: number;
  rowCount: number;
  /** Số phiên bản cũ hơn biên giữ lại (trừ phiên bản hiện tại) — sẽ bị dọn ở lần optimize kế. */
  prunableVersions: number;
}

/** 116: kết quả một lần optimize (gộp fragment + dọn phiên bản cũ). */
export interface VectorOptimizeResult {
  fragmentsRemoved: number;
  fragmentsAdded: number;
  versionsRemoved: number;
  bytesFreed: number;
}

export interface VectorStore {
  add(records: VectorRecord[]): Promise<void>;
  deleteBySource(sourceId: string): Promise<void>;
  /** 112: xoá vector theo danh sách chunk id (dọn vector cũ sau khi xử lý lại / vector mới khi xử lý lại lỗi). */
  deleteByIds(ids: string[]): Promise<void>;
  deleteByNotebook(notebookId: string): Promise<void>;
  countBySource(sourceId: string): Promise<number>;
  /** 059: đếm vector theo notebook (so với số chunk để biết notebook đã nhúng lại xong chưa). */
  countByNotebook(notebookId: string): Promise<number>;
  /** Tìm topK chunk gần nhất trong phạm vi notebook (hoặc toàn cục nếu notebookId là null/rỗng) (013, 231). Bảng chưa tồn tại → []. */
  search(
    queryVector: number[],
    notebookId: string | null | undefined,
    topK: number,
  ): Promise<VectorSearchHit[]>;
  /** 055: lấy vector của các chunk theo id (cho MMR). Id không có vector → bỏ khỏi Map. */
  getVectorsByIds(ids: string[]): Promise<Map<string, number[]>>;
  /** 059: xoá bảng vector (để tái tạo với dim mới khi đổi model embedding). Không tồn tại → no-op. */
  dropTable(): Promise<void>;
  /** 116: đo kho (không ghi). Bảng chưa tồn tại → null. */
  stats(retentionMs: number): Promise<VectorStoreStats | null>;
  /**
   * 116: gộp fragment + dọn phiên bản cũ hơn `retentionMs` (KHÔNG bật deleteUnverified — có thể hỏng bảng nếu có
   * giao dịch dở). Không đổi id/vector/kết quả truy vấn. Bảng chưa tồn tại → null.
   */
  optimize(retentionMs: number): Promise<VectorOptimizeResult | null>;
  /** 116: số thao tác đọc/ghi đang chạy — bảo trì không bắt đầu khi > 0. */
  activeOperations(): number;
  close(): Promise<void>;
}

const TABLE = "chunks";

function toRow(r: VectorRecord) {
  return {
    id: r.id,
    notebook_id: r.notebookId,
    source_id: r.sourceId,
    vector: r.vector,
    dim: r.dim,
  };
}

// Kiểu tối thiểu để không phụ thuộc chặt typings của LanceDB.
interface LanceQuery {
  where(predicate: string): LanceQuery;
  limit(n: number): LanceQuery;
  distanceType(t: string): LanceQuery;
  toArray(): Promise<Record<string, unknown>[]>;
}
interface LanceTable {
  add(data: unknown[]): Promise<unknown>;
  delete(predicate: string): Promise<unknown>;
  countRows(filter?: string): Promise<number>;
  search(vector: number[]): LanceQuery;
  query(): LanceQuery;
  // 116 (@lancedb/lancedb 0.31 — research R1).
  optimize(opts: { cleanupOlderThan: Date }): Promise<{
    compaction: { fragmentsRemoved: number; fragmentsAdded: number };
    prune: { bytesRemoved: number; oldVersionsRemoved: number };
  }>;
  stats(): Promise<{
    numRows: number;
    fragmentStats: { numFragments: number };
  }>;
  listVersions(): Promise<{ version: number; timestamp: Date }[]>;
}
interface LanceConn {
  tableNames(): Promise<string[]>;
  openTable(name: string): Promise<LanceTable>;
  createTable(name: string, data: unknown[]): Promise<LanceTable>;
  dropTable(name: string): Promise<void>;
}

/** Escape nháy đơn cho predicate SQL của LanceDB. */
function q(v: string): string {
  return v.replace(/'/g, "''");
}

export async function createLanceVectorStore(
  dir: string,
): Promise<VectorStore> {
  const lancedb = await import("@lancedb/lancedb");
  const conn = (await lancedb.connect(dir)) as unknown as LanceConn;
  let table: LanceTable | null = null;
  let inflight = 0;

  /** Đếm thao tác đọc/ghi đang bay (116: bảo trì chỉ bắt đầu khi kho yên). */
  const tracked = async <T>(fn: () => Promise<T>): Promise<T> => {
    inflight += 1;
    try {
      return await fn();
    } finally {
      inflight -= 1;
    }
  };

  const getTable = async (): Promise<LanceTable | null> => {
    if (table) return table;
    const names = await conn.tableNames();
    if (names.includes(TABLE)) {
      table = await conn.openTable(TABLE);
    }
    return table;
  };

  const searchRows = async (
    queryVector: number[],
    notebookId: string | null | undefined,
    topK: number,
  ): Promise<VectorSearchHit[]> => {
    const t = await getTable();
    if (!t) return []; // chưa nạp nguồn nào
    // Cosine distance (bị chặn [0,2], chuẩn cho text embedding) thay vì L2 mặc định — vector
    // embedding (vd nomic-embed-text) KHÔNG chuẩn hoá nên L2 không có ngưỡng ổn định (issue #15).
    let query = t.search(queryVector).distanceType("cosine");
    if (notebookId && notebookId.trim() !== "") {
      query = query.where(`notebook_id = '${q(notebookId)}'`);
    }
    const rows = await query.limit(topK).toArray();
    return rows.map((r) => ({
      id: String(r["id"]),
      sourceId: String(r["source_id"]),
      score: Number(r["_distance"]),
    }));
  };

  const vectorsByIds = async (
    ids: string[],
  ): Promise<Map<string, number[]>> => {
    const map = new Map<string, number[]>();
    if (ids.length === 0) return map;
    const t = await getTable();
    if (!t) return map;
    const inList = ids.map((id) => `'${q(id)}'`).join(",");
    const rows = await t
      .query()
      .where(`id IN (${inList})`)
      .limit(ids.length)
      .toArray();
    for (const r of rows) {
      const v = r["vector"];
      if (v != null) {
        map.set(String(r["id"]), Array.from(v as ArrayLike<number>, Number));
      }
    }
    return map;
  };

  const addRows = async (records: VectorRecord[]): Promise<void> => {
    if (records.length === 0) return;
    const rows = records.map(toRow);
    const t = await getTable();
    if (t) {
      await t.add(rows);
    } else {
      table = await conn.createTable(TABLE, rows);
    }
  };

  const deleteWhere = async (predicate: string): Promise<void> => {
    const t = await getTable();
    if (t) await t.delete(predicate);
  };

  const deleteIds = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const t = await getTable();
    if (!t) return;
    // Chia lô để biểu thức IN không quá dài (PDF lớn có thể vài nghìn chunk).
    for (let i = 0; i < ids.length; i += 500) {
      const inList = ids
        .slice(i, i + 500)
        .map((id) => `'${q(id)}'`)
        .join(",");
      await t.delete(`id IN (${inList})`);
    }
  };

  return {
    add(records) {
      return tracked(() => addRows(records));
    },
    deleteBySource(sourceId) {
      return tracked(() => deleteWhere(`source_id = '${q(sourceId)}'`));
    },
    deleteByIds(ids) {
      return tracked(() => deleteIds(ids));
    },
    deleteByNotebook(notebookId) {
      return tracked(() => deleteWhere(`notebook_id = '${q(notebookId)}'`));
    },
    countBySource(sourceId) {
      return tracked(async () => {
        const t = await getTable();
        if (!t) return 0;
        return t.countRows(`source_id = '${q(sourceId)}'`);
      });
    },
    countByNotebook(notebookId) {
      return tracked(async () => {
        const t = await getTable();
        if (!t) return 0;
        return t.countRows(`notebook_id = '${q(notebookId)}'`);
      });
    },
    search(queryVector, notebookId, topK) {
      return tracked(() => searchRows(queryVector, notebookId, topK));
    },
    getVectorsByIds(ids) {
      return tracked(() => vectorsByIds(ids));
    },
    async stats(retentionMs) {
      const t = await getTable();
      if (!t) return null;
      const [st, versions] = await Promise.all([t.stats(), t.listVersions()]);
      const cutoff = Date.now() - retentionMs;
      // reduce thay vì Math.max(...): vault cũ chưa từng bảo trì có thể có rất nhiều phiên bản.
      const latest = versions.reduce((m, v) => Math.max(m, v.version), -1);
      return {
        fragmentCount: st.fragmentStats.numFragments,
        rowCount: st.numRows,
        prunableVersions: versions.filter(
          (v) => v.version !== latest && v.timestamp.getTime() < cutoff,
        ).length,
      };
    },
    async optimize(retentionMs) {
      const t = await getTable();
      if (!t) return null;
      const r = await t.optimize({
        cleanupOlderThan: new Date(Date.now() - retentionMs),
      });
      return {
        fragmentsRemoved: r.compaction.fragmentsRemoved,
        fragmentsAdded: r.compaction.fragmentsAdded,
        versionsRemoved: r.prune.oldVersionsRemoved,
        bytesFreed: r.prune.bytesRemoved,
      };
    },
    activeOperations: () => inflight,
    dropTable() {
      return tracked(async () => {
        const names = await conn.tableNames();
        if (names.includes(TABLE)) {
          await conn.dropTable(TABLE);
        }
        table = null; // buộc mở/tạo lại (dim mới) ở lần add tiếp theo
      });
    },
    async close() {
      table = null;
    },
  };
}
