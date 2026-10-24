import { describe, it, expect } from "vitest";
import { createReindexingCheck } from "../../src/main/services/embedding/reindex-check";

// Kho giả: số chunk (SQLite) và số vector (LanceDB) theo từng notebook.
function makeCheck(opts: {
  inProgress: boolean;
  chunks: Record<string, number>;
  vectors: Record<string, number>;
}) {
  return createReindexingCheck({
    inProgress: () => opts.inProgress,
    listNotebookIds: () => Object.keys(opts.chunks),
    countChunks: (nb) => opts.chunks[nb] ?? 0,
    countVectors: async (nb) => opts.vectors[nb] ?? 0,
  });
}

describe("059/231 — createReindexingCheck", () => {
  it("không có reindex đang chạy → luôn false (cả per-notebook lẫn toàn kho)", async () => {
    const check = makeCheck({
      inProgress: false,
      chunks: { a: 10 },
      vectors: { a: 0 },
    });
    expect(await check("a")).toBe(false);
    expect(await check(null)).toBe(false);
  });

  it("per-notebook: chỉ chặn notebook có vector < chunk", async () => {
    const check = makeCheck({
      inProgress: true,
      chunks: { done: 5, pending: 5 },
      vectors: { done: 5, pending: 2 },
    });
    expect(await check("done")).toBe(false);
    expect(await check("pending")).toBe(true);
  });

  it("notebook rỗng (0 chunk) không bị chặn", async () => {
    const check = makeCheck({
      inProgress: true,
      chunks: { empty: 0 },
      vectors: {},
    });
    expect(await check("empty")).toBe(false);
  });

  it("toàn kho (null): true nếu CÒN BẤT KỲ notebook nào chưa nhúng xong", async () => {
    const check = makeCheck({
      inProgress: true,
      chunks: { done: 5, pending: 5, empty: 0 },
      vectors: { done: 5, pending: 2 },
    });
    expect(await check(null)).toBe(true);
  });

  it("toàn kho (null): false khi mọi notebook đã nhúng đủ", async () => {
    const check = makeCheck({
      inProgress: true,
      chunks: { a: 5, b: 3, empty: 0 },
      vectors: { a: 5, b: 3 },
    });
    expect(await check(null)).toBe(false);
  });
});
