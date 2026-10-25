import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/db/database";
import {
  MIGRATIONS,
  getUserVersion,
  runMigrations,
} from "../../src/main/db/migrations";
import { STUDIO_ALL_KINDS } from "../../src/main/services/studio/constants";

// 233 — migration #13: studio_result thêm loại 'documentDiff' vào CHECK constraint.
const LATEST = Math.max(...MIGRATIONS.map((m) => m.version));

type Db = ReturnType<typeof openDatabase>;

interface Row {
  id: string;
  notebook_id: string;
  kind: string;
  content: string;
  citations_json: string;
  custom_prompt: string | null;
  source_ids_json: string | null;
  parts: number | null;
  truncated: number | null;
  local: number | null;
  created_at: number;
  updated_at: number;
}

const SEED_V12_ROWS = [
  ["r1", "summary", "Tóm tắt [1].", '[{"n":1}]', null, null, 1, 0, 1, 100, 100],
  [
    "r2",
    "custom",
    "Kết quả tuỳ chỉnh [1].",
    "[]",
    "Hãy tìm rủi ro",
    '["s1","s2"]',
    2,
    1,
    0,
    200,
    200,
  ],
] as const;

function seedV12(): Db {
  const db = openDatabase(":memory:");
  runMigrations(
    db,
    MIGRATIONS.filter((m) => m.version <= 12),
  );
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?,?,?,?,?)",
  ).run("nb1", "Notebook Diff", "#4F46E5", 1, 1);

  const ins = db.prepare(
    `INSERT INTO studio_result (
      id, notebook_id, kind, content, citations_json, custom_prompt, source_ids_json, parts, truncated, local, created_at, updated_at
    ) VALUES (?, 'nb1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const [
    id,
    kind,
    content,
    cit,
    cp,
    sids,
    parts,
    trunc,
    loc,
    c,
    u,
  ] of SEED_V12_ROWS) {
    ins.run(id, kind, content, cit, cp, sids, parts, trunc, loc, c, u);
  }
  return db;
}

function insertStudioResult(
  db: Db,
  id: string,
  kind: string,
  extra = "",
): void {
  db.prepare(
    `INSERT INTO studio_result (
      id, notebook_id, kind, content, citations_json, created_at, updated_at${extra ? ", " + extra.split("=")[0] : ""}
    ) VALUES (?, 'nb1', ?, 'Diff content [1]', '[]', 300, 300${extra ? ", " + extra.split("=")[1] : ""})`,
  ).run(id, kind);
}

describe("migration v13 — studio_result chấp nhận documentDiff (233)", () => {
  it("nâng lên v13 và giữ nguyên toàn bộ 12 cột của dữ liệu cũ", () => {
    const db = seedV12();
    expect(runMigrations(db)).toBe(LATEST);
    expect(getUserVersion(db)).toBe(LATEST);

    const rows = db
      .prepare("SELECT * FROM studio_result ORDER BY id")
      .all() as unknown as Row[];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "r1",
      notebook_id: "nb1",
      kind: "summary",
      content: "Tóm tắt [1].",
      citations_json: '[{"n":1}]',
      custom_prompt: null,
      source_ids_json: null,
      parts: 1,
      truncated: 0,
      local: 1,
      created_at: 100,
      updated_at: 100,
    });
    expect(rows[1]).toMatchObject({
      id: "r2",
      notebook_id: "nb1",
      kind: "custom",
      content: "Kết quả tuỳ chỉnh [1].",
      custom_prompt: "Hãy tìm rủi ro",
      source_ids_json: '["s1","s2"]',
      parts: 2,
      truncated: 1,
      local: 0,
      created_at: 200,
      updated_at: 200,
    });
  });

  it("CHECK constraint chấp nhận documentDiff và mọi STUDIO_ALL_KINDS, từ chối kind lạ", () => {
    const db = seedV12();
    runMigrations(db);

    // Chấp nhận documentDiff
    expect(() =>
      insertStudioResult(db, "diff-1", "documentDiff"),
    ).not.toThrow();

    // Chấp nhận mọi loại trong STUDIO_ALL_KINDS
    for (const k of STUDIO_ALL_KINDS) {
      expect(() => insertStudioResult(db, `k-${k}`, k)).not.toThrow();
    }

    // Từ chối kind lạ
    expect(() => insertStudioResult(db, "invalid-kind", "bogusKind")).toThrow();
  });

  it("xoá notebook cascade xoá phiên bản documentDiff", () => {
    const db = seedV12();
    runMigrations(db);
    insertStudioResult(db, "diff-cascade", "documentDiff");

    expect(db.prepare("PRAGMA foreign_key_check(studio_result)").all()).toEqual(
      [],
    );
    db.prepare("DELETE FROM notebook WHERE id = 'nb1'").run();
    const count = db
      .prepare("SELECT COUNT(*) AS count FROM studio_result")
      .get() as { count: number };
    expect(count.count).toBe(0);
  });

  it("tái tạo đúng index idx_studio_notebook và idx_studio_versions", () => {
    const db = seedV12();
    runMigrations(db);

    const names = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE tbl_name = 'studio_result' OR name LIKE 'studio_result%'",
        )
        .all() as { name: string }[]
    ).map((r) => r.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "studio_result",
        "idx_studio_notebook",
        "idx_studio_versions",
      ]),
    );
    expect(names).not.toContain("studio_result_new");
  });
});
