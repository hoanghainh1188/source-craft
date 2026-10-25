import type { Db } from "./database";
import {
  LEGACY_SOURCE_ERROR_LABELS,
  SOURCE_ERROR_CODES,
} from "@shared/codes/source-error";
import { foldVietnamese } from "../services/ingestion/fts-fold";

// Migration runner (ADR 2026-07-11-sqlite-migrations): PRAGMA user_version, append-only, 1 transaction/bước.
// THÊM migration mới ở CUỐI mảng — KHÔNG sửa migration đã phát hành (dữ liệu người dùng đã áp).

export interface Migration {
  version: number;
  up(db: Db): void;
}

/**
 * DB trên đĩa có schema mới hơn app đang chạy (người dùng cài bản cũ đè bản mới hơn).
 * Cố ý KHÔNG tự hạ cấp — bảo vệ dữ liệu. Kiểu riêng để tầng khởi động nhận diện và hiện
 * dialog "cần cập nhật" thay vì chết âm thầm. `dbVersion`/`appVersion` là số schema (an toàn
 * để hiển thị — không phải nội dung người dùng).
 */
export class SchemaVersionError extends Error {
  constructor(
    readonly dbVersion: number,
    readonly appVersion: number,
  ) {
    super(
      `DB schema (v${dbVersion}) is newer than the app (v${appVersion}) — refusing to downgrade to avoid data loss.`,
    );
    this.name = "SchemaVersionError";
  }
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS notebook (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          color      TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    },
  },
  // 011-ingestion: bảng source + chunk. FK ON DELETE CASCADE (xoá notebook→source→chunk).
  // Vector ở LanceDB (không FK xuyên store) — dọn bằng lệnh riêng theo source_id/notebook_id.
  {
    version: 2,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS source (
          id           TEXT PRIMARY KEY,
          notebook_id  TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind         TEXT NOT NULL CHECK (kind IN ('pdf','docx','txt','md','url')),
          title        TEXT NOT NULL,
          origin       TEXT NOT NULL,
          status       TEXT NOT NULL CHECK (status IN ('queued','processing','awaiting_embedding','ready','error')),
          error_label  TEXT,
          page_count   INTEGER,
          content_hash TEXT NOT NULL,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS chunk (
          id         TEXT PRIMARY KEY,
          source_id  TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
          ordinal    INTEGER NOT NULL,
          text       TEXT NOT NULL,
          page       INTEGER,
          char_start INTEGER NOT NULL,
          char_end   INTEGER NOT NULL
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_notebook ON source(notebook_id)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_hash ON source(notebook_id, content_hash)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_chunk_source ON chunk(source_id)",
      );
    },
  },
  // 021-studio: bảng studio_result (bản tổng hợp Studio lưu bền). FK ON DELETE CASCADE (xoá notebook →
  // xoá kết quả). UNIQUE(notebook_id, kind) → 1 bản mới nhất mỗi loại/notebook; regenerate = UPSERT.
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS studio_result (
          id             TEXT PRIMARY KEY,
          notebook_id    TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind           TEXT NOT NULL CHECK (kind IN ('summary','keyPoints','faq','outline')),
          content        TEXT NOT NULL,
          citations_json TEXT NOT NULL,
          created_at     INTEGER NOT NULL,
          updated_at     INTEGER NOT NULL,
          UNIQUE (notebook_id, kind)
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_studio_notebook ON studio_result(notebook_id)",
      );
    },
  },
  // 027-chat-history: lịch sử hội thoại Chat theo notebook. FK ON DELETE CASCADE (xoá notebook → xoá lịch
  // sử). Lưu cả citations (giữ kiểm chứng được khi nạp lại) + cờ not_found.
  {
    version: 4,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS chat_message (
          id             TEXT PRIMARY KEY,
          notebook_id    TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          role           TEXT NOT NULL CHECK (role IN ('user','assistant')),
          content        TEXT NOT NULL,
          citations_json TEXT NOT NULL DEFAULT '[]',
          not_found      INTEGER NOT NULL DEFAULT 0,
          created_at     INTEGER NOT NULL
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_chat_notebook ON chat_message(notebook_id, created_at)",
      );
    },
  },
  // 045-audio-transcribe (Pha 2a): (a) chunk thêm t_start/t_end (giây) cho locator audio; (b) source.kind
  // BỎ CHECK cứng để nhận 'audio' (và video/ảnh sau) — validate loại ở app boundary (detectKindFromPath +
  // SourceKind). Tái tạo bảng source cần né cascade xoá chunk (FK ON): backup chunk → recreate → restore.
  {
    version: 5,
    up(db) {
      db.exec("ALTER TABLE chunk ADD COLUMN t_start REAL");
      db.exec("ALTER TABLE chunk ADD COLUMN t_end REAL");
      // Backup chunk (bảng thường, không FK → không bị cascade khi DROP source).
      db.exec(
        `CREATE TABLE chunk_bak_045 AS
           SELECT id, source_id, ordinal, text, page, char_start, char_end FROM chunk`,
      );
      // source mới — KHÔNG còn CHECK kind (validate ở app). Cột giữ nguyên thứ tự để INSERT SELECT *.
      db.exec(`
        CREATE TABLE source_new (
          id           TEXT PRIMARY KEY,
          notebook_id  TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind         TEXT NOT NULL,
          title        TEXT NOT NULL,
          origin       TEXT NOT NULL,
          status       TEXT NOT NULL CHECK (status IN ('queued','processing','awaiting_embedding','ready','error')),
          error_label  TEXT,
          page_count   INTEGER,
          content_hash TEXT NOT NULL,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        )
      `);
      db.exec("INSERT INTO source_new SELECT * FROM source");
      db.exec("DROP TABLE source"); // implicit DELETE → cascade xoá chunk (đã backup)
      db.exec("ALTER TABLE source_new RENAME TO source");
      // Khôi phục chunk từ backup (giữ id → vector LanceDB vẫn khớp).
      db.exec(
        `INSERT INTO chunk (id, source_id, ordinal, text, page, char_start, char_end)
           SELECT id, source_id, ordinal, text, page, char_start, char_end FROM chunk_bak_045`,
      );
      db.exec("DROP TABLE chunk_bak_045");
      // Tái tạo index của source (mất khi DROP).
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_notebook ON source(notebook_id)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_source_hash ON source(notebook_id, content_hash)",
      );
    },
  },
  // 053-image (Pha 2c): chunk thêm bbox (vùng chữ OCR, chuẩn hoá 0..1) cho locator ảnh. ADD COLUMN thuần,
  // append-only — KHÔNG phá CHECK (khác #5). kind='image' không cần migration (CHECK kind đã bỏ ở #5).
  {
    version: 6,
    up(db) {
      db.exec("ALTER TABLE chunk ADD COLUMN bbox_x REAL");
      db.exec("ALTER TABLE chunk ADD COLUMN bbox_y REAL");
      db.exec("ALTER TABLE chunk ADD COLUMN bbox_w REAL");
      db.exec("ALTER TABLE chunk ADD COLUMN bbox_h REAL");
    },
  },
  // 055-rag-enhance: FTS5 own-storage cho tìm keyword BM25. Lưu text đã FOLD (bỏ dấu + đ→d ở JS — vì
  // tokenizer remove_diacritics không xử lý đ). Trigger AFTER DELETE đồng bộ xoá (bao cả cascade source/
  // notebook). INSERT đồng bộ tay ở source-repo.insertChunks (cần fold JS). Backfill chunk hiện có.
  {
    version: 7,
    up(db) {
      db.exec(
        "CREATE VIRTUAL TABLE chunk_fts USING fts5(text, tokenize='unicode61')",
      );
      db.exec(`
        CREATE TRIGGER chunk_fts_ad AFTER DELETE ON chunk BEGIN
          DELETE FROM chunk_fts WHERE rowid = OLD.rowid;
        END
      `);
      // Backfill: fold text mọi chunk hiện có (JS) → chunk_fts theo rowid.
      const rows = db
        .prepare("SELECT rowid, text FROM chunk")
        .all() as unknown as { rowid: number; text: string }[];
      const ins = db.prepare(
        "INSERT INTO chunk_fts (rowid, text) VALUES (?, ?)",
      );
      for (const r of rows) ins.run(r.rowid, foldVietnamese(r.text));
    },
  },
  // 071-ungrounded-badge: chat_message thêm mode_used ('grounded'|'open'|NULL) để badge "không dựa trên
  // nguồn" (chế độ Mở rộng) BỀN qua reload (kiểm chứng được — Constitution II). ADD COLUMN thuần, append-only;
  // hàng cũ = NULL → coi như grounded (không badge).
  {
    version: 8,
    up(db) {
      db.exec("ALTER TABLE chat_message ADD COLUMN mode_used TEXT");
    },
  },
  // 112-pdf-layout: source.extraction_version — cách trích đã dùng cho văn bản/chunk hiện tại (PDF bố cục = 2).
  // ADD COLUMN thuần, append-only; nguồn cũ = 1 (cách trích trước 112) ⇒ gợi ý "Xử lý lại để giữ bố cục".
  {
    version: 9,
    up(db) {
      db.exec(
        "ALTER TABLE source ADD COLUMN extraction_version INTEGER NOT NULL DEFAULT 1",
      );
    },
  },
  // 123-i18n: source.error_label lưu MÃ (SourceErrorCode) thay văn bản tiếng Việt — giao diện dịch theo ngôn ngữ
  // hiện tại. CHỈ dữ liệu (không đổi schema); văn bản cũ ⇒ mã, giá trị lạ ⇒ "unknown", NULL giữ, mã sẵn giữ.
  {
    version: 10,
    up(db) {
      const update = db.prepare(
        "UPDATE source SET error_label = ? WHERE error_label = ?",
      );
      for (const [text, code] of Object.entries(LEGACY_SOURCE_ERROR_LABELS)) {
        update.run(code, text);
      }
      const codes = SOURCE_ERROR_CODES.map(() => "?").join(",");
      db.prepare(
        `UPDATE source SET error_label = 'unknown' WHERE error_label IS NOT NULL AND error_label NOT IN (${codes})`,
      ).run(...SOURCE_ERROR_CODES);
    },
  },
  // 178-studio-enhance-2: studio_result nhiều PHIÊN BẢN — bỏ UNIQUE(notebook_id, kind), CHECK đủ 9 loại (gồm 4 loại mới
  // + custom), thêm cột custom_prompt / source_ids_json / parts / truncated / local (NULL ở dòng cũ). SQLite không ALTER
  // được UNIQUE/CHECK ⇒ dựng lại bảng. KHÔNG cần tắt FK (PRAGMA foreign_keys là no-op trong giao dịch): studio_result là
  // bảng CON, không bảng nào tham chiếu nó ⇒ DROP không cascade gì, RENAME không phải sửa tham chiếu (khác v5).
  {
    version: 11,
    up(db) {
      db.exec(`
        CREATE TABLE studio_result_new (
          id              TEXT PRIMARY KEY,
          notebook_id     TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind            TEXT NOT NULL CHECK (kind IN ('summary','keyPoints','faq','outline','studyGuide','briefing','timeline','keyTerms','custom')),
          content         TEXT NOT NULL,
          citations_json  TEXT NOT NULL,
          custom_prompt   TEXT,
          source_ids_json TEXT,
          parts           INTEGER,
          truncated       INTEGER CHECK (truncated IN (0,1)),
          local           INTEGER CHECK (local IN (0,1)),
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        )
      `);
      db.exec(
        `INSERT INTO studio_result_new (id, notebook_id, kind, content, citations_json, created_at, updated_at)
           SELECT id, notebook_id, kind, content, citations_json, created_at, updated_at FROM studio_result`,
      );
      db.exec("DROP TABLE studio_result");
      db.exec("ALTER TABLE studio_result_new RENAME TO studio_result");
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_studio_notebook ON studio_result(notebook_id)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_studio_versions ON studio_result(notebook_id, kind, created_at)",
      );
    },
  },
  // 186-meeting-capture: nguồn cuộc họp (kind="meeting" — cột kind không còn CHECK từ v5, KHÔNG rebuild source). Ba bảng
  // con 1-n/1-1 của source, đều ON DELETE CASCADE: phiên ghi (metadata + phân đoạn/khoảng ngừng dạng JSON), đánh dấu
  // (neo thời gian audio), map char↔thời gian mức segment Whisper của transcript chốt (D3). Trạng thái nguồn giữ 5 giá trị
  // (A9) — nhãn UI lấy từ meeting_session.phase.
  {
    version: 12,
    up(db) {
      db.exec(`
        CREATE TABLE meeting_session (
          source_id             TEXT PRIMARY KEY REFERENCES source(id) ON DELETE CASCADE,
          session_id            TEXT NOT NULL UNIQUE,
          phase                 TEXT NOT NULL CHECK (phase IN ('recording','paused','stopping','finalizing','interrupted','incomplete','done')),
          ended_by_user         INTEGER NOT NULL DEFAULT 0 CHECK (ended_by_user IN (0,1)),
          language_mode         TEXT NOT NULL CHECK (language_mode IN ('auto','vi','en','multi')),
          language              TEXT CHECK (language IN ('vi','en')),
          language_changes_json TEXT NOT NULL DEFAULT '[]',
          device_label          TEXT,
          started_at            INTEGER NOT NULL,
          ended_at              INTEGER,
          duration_ms           INTEGER NOT NULL DEFAULT 0,
          segments_json         TEXT NOT NULL DEFAULT '[]',
          pause_gaps_json       TEXT NOT NULL DEFAULT '[]',
          transcript_quality    TEXT CHECK (transcript_quality IN ('final','draft')),
          final_progress        INTEGER NOT NULL DEFAULT 0,
          updated_at            INTEGER NOT NULL
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_meeting_session_phase ON meeting_session(phase)",
      );
      db.exec(`
        CREATE TABLE meeting_marker (
          id         TEXT PRIMARY KEY,
          source_id  TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
          kind       TEXT NOT NULL CHECK (kind IN ('decision','actionItem','question')),
          t_start    REAL NOT NULL CHECK (t_start >= 0),
          t_end      REAL NOT NULL CHECK (t_end >= t_start),
          created_at INTEGER NOT NULL
        )
      `);
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_meeting_marker_source ON meeting_marker(source_id, t_start)",
      );
      db.exec(`
        CREATE TABLE transcript_span (
          source_id  TEXT NOT NULL REFERENCES source(id) ON DELETE CASCADE,
          idx        INTEGER NOT NULL,
          char_start INTEGER NOT NULL,
          char_end   INTEGER NOT NULL CHECK (char_end > char_start),
          t_start    REAL NOT NULL,
          t_end      REAL NOT NULL CHECK (t_end >= t_start),
          PRIMARY KEY (source_id, idx)
        )
      `);
    },
  },
  // 233-document-diff: studio_result thêm loại 'documentDiff' vào CHECK constraint. Dựng lại bảng theo mẫu v11,
  // copy đủ 12 cột (gồm 5 cột thêm ở v11).
  {
    version: 13,
    up(db) {
      db.exec(`
        CREATE TABLE studio_result_new (
          id              TEXT PRIMARY KEY,
          notebook_id     TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
          kind            TEXT NOT NULL CHECK (kind IN ('summary','keyPoints','faq','outline','studyGuide','briefing','timeline','keyTerms','custom','documentDiff')),
          content         TEXT NOT NULL,
          citations_json  TEXT NOT NULL,
          custom_prompt   TEXT,
          source_ids_json TEXT,
          parts           INTEGER,
          truncated       INTEGER CHECK (truncated IN (0,1)),
          local           INTEGER CHECK (local IN (0,1)),
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        )
      `);
      db.exec(
        `INSERT INTO studio_result_new (id, notebook_id, kind, content, citations_json, custom_prompt, source_ids_json, parts, truncated, local, created_at, updated_at)
           SELECT id, notebook_id, kind, content, citations_json, custom_prompt, source_ids_json, parts, truncated, local, created_at, updated_at FROM studio_result`,
      );
      db.exec("DROP TABLE studio_result");
      db.exec("ALTER TABLE studio_result_new RENAME TO studio_result");
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_studio_notebook ON studio_result(notebook_id)",
      );
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_studio_versions ON studio_result(notebook_id, kind, created_at)",
      );
    },
  },
];

export function getUserVersion(db: Db): number {
  const row = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  return row.user_version;
}

/** Chạy các migration có version > user_version hiện tại. Trả version cuối. Ném nếu DB mới hơn app. */
export function runMigrations(
  db: Db,
  migrations: Migration[] = MIGRATIONS,
): number {
  const current = getUserVersion(db);
  const max = migrations.reduce((m, x) => Math.max(m, x.version), 0);
  if (current > max) {
    throw new SchemaVersionError(current, max);
  }
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const m of pending) {
    db.exec("BEGIN");
    try {
      m.up(db);
      // An toàn: m.version là HẰNG SỐ nội bộ (mảng MIGRATIONS), KHÔNG phải input người dùng; PRAGMA
      // không hỗ trợ bind parameter `?`. Mọi SQL còn lại dùng parameterized `?` (xem notebook-repo).
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return getUserVersion(db);
}
