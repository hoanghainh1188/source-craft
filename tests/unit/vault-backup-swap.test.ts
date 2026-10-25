import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import * as fsp from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyPendingRestore,
  consumeRestoreResult,
  writeRestoreState,
  type SwapFs,
} from "../../src/main/services/vault-backup/restore-swap";

let data: string;

function vault(dir: string, tag: string, withWal = true): void {
  mkdirSync(join(dir, "vectors", "t.lance"), { recursive: true });
  writeFileSync(join(dir, "insightvault.db"), `db-${tag}`);
  if (withWal) writeFileSync(join(dir, "insightvault.db-wal"), `wal-${tag}`);
  writeFileSync(join(dir, "config.json"), `{"v":"${tag}"}`);
  writeFileSync(join(dir, "vectors", "t.lance", "x"), `vec-${tag}`);
}

function read(rel: string): string | null {
  const p = join(data, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

async function stage(): Promise<void> {
  const staged = join(data, "restore", "staged");
  mkdirSync(staged, { recursive: true });
  vault(staged, "new", false);
  writeFileSync(join(staged, "manifest.json"), "{}");
  await writeRestoreState(data, {
    phase: "staged",
    backupCreatedAt: "2026-10-01T00:00:00.000Z",
    preRestorePath: "/b/pre-restore-1.ivbackup",
  });
}

/** fs thật, nhưng rename thứ `failAt` (đếm từ 1) ném lỗi — mô phỏng lỗi đĩa/crash giữa chừng. */
function failingFs(failAt: number): SwapFs & { calls: () => number } {
  let n = 0;
  return {
    rename: async (a, b) => {
      n += 1;
      if (n === failAt) throw Object.assign(new Error("EIO"), { code: "EIO" });
      await fsp.rename(a, b);
    },
    calls: () => n,
  };
}

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), "iv-swap-"));
  vault(data, "old");
});
afterEach(() => rmSync(data, { recursive: true, force: true }));

describe("vault-backup restore swap (boot)", () => {
  it("không có restore/ ⇒ no-op", async () => {
    expect(await applyPendingRestore(data)).toBe("none");
    expect(read("insightvault.db")).toBe("db-old");
    expect(await consumeRestoreResult(data)).toBeNull();
  });

  it("staged ⇒ hoán đổi đủ mục, WAL cũ bị bỏ, result ok, dọn restore/", async () => {
    await stage();
    expect(await applyPendingRestore(data)).toBe("swapped");
    expect(read("insightvault.db")).toBe("db-new");
    expect(read("insightvault.db-wal")).toBeNull();
    expect(read("config.json")).toBe('{"v":"new"}');
    expect(read("vectors/t.lance/x")).toBe("vec-new");
    expect(read("manifest.json")).toBeNull();
    expect(existsSync(join(data, "restore", "staged"))).toBe(false);
    expect(existsSync(join(data, "restore", "previous"))).toBe(false);
    expect(existsSync(join(data, "restore", "state.json"))).toBe(false);
    expect(await consumeRestoreResult(data)).toEqual({
      ok: true,
      backupCreatedAt: "2026-10-01T00:00:00.000Z",
      preRestorePath: "/b/pre-restore-1.ivbackup",
    });
    // one-shot
    expect(await consumeRestoreResult(data)).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7])(
    "lỗi ở rename thứ %i ⇒ rollback: vault cũ nguyên byte, result swapFailed",
    async (k) => {
      await stage();
      const fs = failingFs(k);
      expect(await applyPendingRestore(data, fs)).toBe("rolledBack");
      expect(read("insightvault.db")).toBe("db-old");
      expect(read("insightvault.db-wal")).toBe("wal-old");
      expect(read("config.json")).toBe('{"v":"old"}');
      expect(read("vectors/t.lance/x")).toBe("vec-old");
      expect(existsSync(join(data, "restore", "state.json"))).toBe(false);
      expect(await consumeRestoreResult(data)).toEqual({
        ok: false,
        reason: "swapFailed",
      });
    },
  );

  it("crash giữa chừng (rename ném nhưng không rollback) ⇒ boot kế hoàn tất hoán đổi", async () => {
    await stage();
    // mô phỏng crash: chạy với fs ném ở rename thứ 6 (đang chuyển vào) nhưng chặn rollback bằng cách ném
    // từ chính rollback — applyPendingRestore phải ném ra (fatal) và để lại state.json cho lần sau.
    let n = 0;
    const crashing: SwapFs = {
      rename: async (a, b) => {
        n += 1;
        if (n >= 6) throw new Error("power loss");
        await fsp.rename(a, b);
      },
    };
    await expect(applyPendingRestore(data, crashing)).rejects.toThrow();
    expect(existsSync(join(data, "restore", "state.json"))).toBe(true);
    // boot kế (fs bình thường): hoàn tất rollback an toàn — vault cũ nguyên vẹn
    const r = await applyPendingRestore(data);
    expect(r).toBe("rolledBack");
    expect(read("insightvault.db")).toBe("db-old");
    expect(read("vectors/t.lance/x")).toBe("vec-old");
  });

  it("crash sau khi đã chuyển hết ra ngoài (phase movingIn, chưa chuyển gì vào) ⇒ boot kế hoàn tất", async () => {
    await stage();
    const prev = join(data, "restore", "previous");
    mkdirSync(prev, { recursive: true });
    for (const it of [
      "insightvault.db",
      "insightvault.db-wal",
      "config.json",
      "vectors",
    ]) {
      await fsp.rename(join(data, it), join(prev, it));
    }
    await writeRestoreState(data, {
      phase: "movingIn",
      backupCreatedAt: "2026-10-01T00:00:00.000Z",
      preRestorePath: null,
    });
    expect(await applyPendingRestore(data)).toBe("swapped");
    expect(read("insightvault.db")).toBe("db-new");
    expect(read("insightvault.db-wal")).toBeNull();
  });

  // B1 (code review): rollback bị gián đoạn ở BẤT KỲ lần đổi tên nào rồi boot lại ⇒ vault cũ nguyên byte.
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "lỗi ở bước chuyển vào + rollback gãy ở rename thứ %i của rollback ⇒ boot kế: vault cũ nguyên vẹn",
    async (k) => {
      await stage();
      // 4 rename chuyển ra (1-4), chuyển vào: db (5) ok, vectors (6) lỗi ⇒ rollback bắt đầu từ rename 7.
      let n = 0;
      const fs: SwapFs = {
        rename: async (a, b) => {
          n += 1;
          if (n === 6 || n === 6 + k) throw new Error("boom");
          await fsp.rename(a, b);
        },
      };
      await applyPendingRestore(data, fs).catch(() => "threw");
      // boot kế với fs bình thường (có thể đã xong ở lần 1 nếu k vượt quá số rename của rollback)
      await applyPendingRestore(data);
      expect(read("insightvault.db")).toBe("db-old");
      expect(read("insightvault.db-wal")).toBe("wal-old");
      expect(read("config.json")).toBe('{"v":"old"}');
      expect(read("vectors/t.lance/x")).toBe("vec-old");
      expect(existsSync(join(data, "restore", "state.json"))).toBe(false);
    },
  );

  // B2: dữ liệu chờ khôi phục biến mất trước khi hoán đổi ⇒ không đụng vault, báo thất bại.
  it("staged/ mất hoặc thiếu DB ⇒ không chuyển vault cũ ra, result swapFailed", async () => {
    await stage();
    rmSync(join(data, "restore", "staged"), { recursive: true });
    expect(await applyPendingRestore(data)).toBe("rolledBack");
    expect(read("insightvault.db")).toBe("db-old");
    expect(read("vectors/t.lance/x")).toBe("vec-old");
    expect(await consumeRestoreResult(data)).toEqual({
      ok: false,
      reason: "swapFailed",
    });

    await stage();
    rmSync(join(data, "restore", "staged", "insightvault.db"));
    expect(await applyPendingRestore(data)).toBe("rolledBack");
    expect(read("insightvault.db")).toBe("db-old");
  });

  it("crash giữa lúc chuyển ra (phase movingOut, staged còn) ⇒ boot kế hoàn tất", async () => {
    await stage();
    await writeRestoreState(data, {
      phase: "movingOut",
      backupCreatedAt: "2026-10-01T00:00:00.000Z",
      preRestorePath: null,
    });
    const prev = join(data, "restore", "previous");
    mkdirSync(prev, { recursive: true });
    await fsp.rename(join(data, "config.json"), join(prev, "config.json"));
    expect(await applyPendingRestore(data)).toBe("swapped");
    expect(read("insightvault.db")).toBe("db-new");
    expect(read("config.json")).toBe('{"v":"new"}');
  });

  it("payload tạm mồ côi trong restore/ bị dọn lúc boot", async () => {
    mkdirSync(join(data, "restore"), { recursive: true });
    writeFileSync(join(data, "restore", "staged.payload-abc123.tgz"), "x");
    await applyPendingRestore(data);
    expect(existsSync(join(data, "restore", "staged.payload-abc123.tgz"))).toBe(
      false,
    );
  });

  it("state.json hỏng + previous/ còn mục trùng với vault sống ⇒ GIỮ lại (recovered-*), không xoá", async () => {
    const prev = join(data, "restore", "previous");
    mkdirSync(prev, { recursive: true });
    writeFileSync(join(prev, "config.json"), "cũ-quý");
    writeFileSync(join(data, "restore", "state.json"), "{bad");
    await applyPendingRestore(data);
    const kept = readdirSync(join(data, "restore")).filter((n) =>
      n.startsWith("recovered-"),
    );
    expect(kept).toHaveLength(1);
    expect(
      readFileSync(join(data, "restore", kept[0], "config.json"), "utf8"),
    ).toBe("cũ-quý");
    expect(read("insightvault.db")).toBe("db-old");
  });

  it("state.json hỏng + vault sống còn ⇒ không phá vault, dọn rác", async () => {
    mkdirSync(join(data, "restore", "staged"), { recursive: true });
    writeFileSync(join(data, "restore", "state.json"), "{not json");
    expect(await applyPendingRestore(data)).toBe("none");
    expect(read("insightvault.db")).toBe("db-old");
    expect(existsSync(join(data, "restore", "staged"))).toBe(false);
  });

  it("state.json hỏng + DB sống mất nhưng previous/ còn ⇒ trả vault cũ về", async () => {
    const prev = join(data, "restore", "previous");
    mkdirSync(prev, { recursive: true });
    await fsp.rename(
      join(data, "insightvault.db"),
      join(prev, "insightvault.db"),
    );
    writeFileSync(join(data, "restore", "state.json"), "garbage");
    expect(await applyPendingRestore(data)).toBe("rolledBack");
    expect(read("insightvault.db")).toBe("db-old");
  });

  it("result.json sai hình ⇒ null", async () => {
    mkdirSync(join(data, "restore"), { recursive: true });
    writeFileSync(join(data, "restore", "result.json"), '{"ok":"maybe"}');
    expect(await consumeRestoreResult(data)).toBeNull();
  });
});

// T022 (236) — khôi phục vault KHÔNG được đụng/thay thư mục audit/ (FR-021).
describe("vault-backup restore swap — audit/", () => {
  it("audit/ đang sống giữ nguyên byte sau hoán đổi; audit/ trong bản staged bị bỏ qua", async () => {
    mkdirSync(join(data, "audit"), { recursive: true });
    writeFileSync(join(data, "audit", "audit-000000000000.jsonl"), "live\n");
    await stage();
    mkdirSync(join(data, "restore", "staged", "audit"), { recursive: true });
    writeFileSync(
      join(data, "restore", "staged", "audit", "audit-000000000000.jsonl"),
      "evil\n",
    );
    expect(await applyPendingRestore(data)).toBe("swapped");
    expect(read("audit/audit-000000000000.jsonl")).toBe("live\n");
  });
});
