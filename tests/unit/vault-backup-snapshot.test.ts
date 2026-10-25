import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { openDatabase, type Db } from "../../src/main/db/database";
import { runMigrations } from "../../src/main/db/migrations";
import { createSnapshot } from "../../src/main/services/vault-backup/snapshot";

let root: string;
let dataDir: string;
let db: Db;
let schema: number;

beforeEach(() => {
  // dấu ' trong path ⇒ kiểm escape của VACUUM INTO
  root = mkdtempSync(join(tmpdir(), "iv-snap-o'k-"));
  dataDir = join(root, "data");
  mkdirSync(join(dataDir, "vectors", "chunks.lance"), { recursive: true });
  writeFileSync(join(dataDir, "vectors", "chunks.lance", "d.bin"), "vec");
  db = openDatabase(join(dataDir, "insightvault.db"));
  schema = runMigrations(db);
  const now = Date.now();
  const ins = db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES (?, ?, 'blue', ?, ?)",
  );
  // ghi nhiều ⇒ còn nằm trong WAL lúc chụp
  for (let i = 0; i < 300; i++) ins.run(`nb${i}`, `Sổ ${i}`, now, now);
});
afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

describe("vault-backup snapshot", () => {
  it("VACUUM INTO đủ dữ liệu khi DB WAL đang mở; copy vectors; config từ object; manifest đúng", async () => {
    const dest = join(root, "snap");
    const manifest = await createSnapshot({
      db,
      dataDir,
      config: {
        embeddingModelVersion: "e5-small-384",
        onboardingComplete: true,
      },
      destDir: dest,
      appVersion: "0.2.3",
      encrypted: false,
      now: new Date("2026-10-06T00:00:00Z"),
    });

    expect(existsSync(join(dest, "insightvault.db-wal"))).toBe(false);
    const snap = new DatabaseSync(join(dest, "insightvault.db"), {
      readOnly: true,
    });
    const n = snap.prepare("SELECT count(*) AS c FROM notebook").get() as {
      c: number;
    };
    const v = snap.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    snap.close();
    expect(n.c).toBe(300);
    expect(v.user_version).toBe(schema);

    expect(
      readFileSync(join(dest, "vectors", "chunks.lance", "d.bin"), "utf8"),
    ).toBe("vec");
    expect(JSON.parse(readFileSync(join(dest, "config.json"), "utf8"))).toEqual(
      {
        embeddingModelVersion: "e5-small-384",
        onboardingComplete: true,
      },
    );
    expect(manifest).toMatchObject({
      schemaVersion: schema,
      notebookCount: 300,
      sourceCount: 0,
      embeddingModelVersion: "e5-small-384",
      encrypted: false,
      createdAt: "2026-10-06T00:00:00.000Z",
    });
    expect(
      JSON.parse(readFileSync(join(dest, "manifest.json"), "utf8")),
    ).toEqual(manifest);
    // vault gốc vẫn ghi được sau khi chụp
    db.prepare(
      "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('z', 'z', 'blue', 1, 1)",
    ).run();
  });

  it("không có vectors/ (cài mới) ⇒ snapshot không có vectors, vẫn OK", async () => {
    rmSync(join(dataDir, "vectors"), { recursive: true });
    const dest = join(root, "snap2");
    await createSnapshot({
      db,
      dataDir,
      config: {},
      destDir: dest,
      appVersion: "1",
      encrypted: true,
      now: new Date(0),
    });
    expect(existsSync(join(dest, "vectors"))).toBe(false);
    expect(existsSync(join(dest, "insightvault.db"))).toBe(true);
  });
});

// T022 (236) — nhật ký kiểm toán là của tổ chức: KHÔNG vào bản sao lưu vault (FR-021, research F5).
describe("vault-backup snapshot — audit/", () => {
  it("thư mục audit/ trong dataDir không được sao chép vào snapshot", async () => {
    mkdirSync(join(dataDir, "audit"), { recursive: true });
    writeFileSync(join(dataDir, "audit", "audit-000000000000.jsonl"), "{}\n");
    const dest = join(root, "snap-audit");
    await createSnapshot({
      db,
      dataDir,
      config: {},
      destDir: dest,
      appVersion: "0.3.0",
      encrypted: false,
      now: new Date("2026-10-25T00:00:00Z"),
    });
    expect(existsSync(join(dest, "audit"))).toBe(false);
  });
});
