import { describe, expect, it } from "vitest";
import type { InteractionMeta } from "../../../src/main/services/audit/audit-types";
import { harness } from "./service-harness";

// T019 (236) — reevaluate / stop / onStatusChange (FR-014, R6a, R10).

const meta: InteractionMeta = {
  channel: "rag",
  scope: { kind: "all" },
  question: "q",
  model: { category: "local", providerId: "ollama", model: null },
};
const done = () => ({ status: "completed" as const, citations: [] });

describe("AuditService lifecycle", () => {
  it("reevaluate: mất bản quyền ⇒ audit.stopped{licenseInactive}; có lại ⇒ audit.started", async () => {
    const h = harness();
    await h.service.start();
    h.env.license = { valid: false, itPolicy: true };
    await h.service.reevaluate();
    expect(h.records().at(-1)).toMatchObject({
      type: "audit.stopped",
      reason: "licenseInactive",
    });
    expect(h.service.status().state).toBe("licenseInactive");
    h.env.license = { valid: true, itPolicy: true };
    await h.service.reevaluate();
    expect(h.records().at(-1)?.type).toBe("audit.started");
    expect(h.service.status().state).toBe("active");
  });

  it("stop(appQuit) khi còn tương tác mở ⇒ end{cancelled} TRƯỚC audit.stopped; run xong muộn không ghi thêm end", async () => {
    const h = harness();
    await h.service.start();
    let finish!: (v: number) => void;
    const p = h.service.runInteraction(
      meta,
      () => new Promise<number>((r) => (finish = r)),
      done,
    );
    await new Promise((r) => setTimeout(r, 0));
    h.service.stop("appQuit");
    expect(h.types().slice(-3)).toEqual([
      "interaction.start",
      "interaction.end",
      "audit.stopped",
    ]);
    expect(h.records().at(-2)).toMatchObject({
      status: "cancelled",
      interactionId: "int-1",
    });
    finish(5);
    await expect(p).resolves.toBe(5);
    expect(h.types().filter((t) => t === "interaction.end")).toHaveLength(1);
  });

  it("stop gọi 2 lần chỉ ghi 1 lần; sau stop không ghi tương tác mới", async () => {
    const h = harness();
    await h.service.start();
    h.service.stop("appQuit");
    h.service.stop("appQuit");
    expect(h.types().filter((t) => t === "audit.stopped")).toHaveLength(1);
    await h.service.runInteraction(meta, async () => 1, done);
    expect(h.types().at(-1)).toBe("audit.stopped");
  });

  it("onStatusChange chỉ phát khi state/reason đổi", async () => {
    const h = harness();
    const seen: string[] = [];
    h.service.onStatusChange((s) => seen.push(`${s.state}:${s.reason ?? ""}`));
    await h.service.start();
    await h.service.runInteraction(meta, async () => 1, done);
    await h.service.reevaluate();
    expect(seen).toEqual(["active:"]);
    h.fs.failAppend = { code: "ENOSPC" };
    await h.service.runInteraction(meta, async () => 1, done).catch(() => {});
    await h.service.runInteraction(meta, async () => 1, done).catch(() => {});
    expect(seen).toEqual(["active:", "blocked:writeFailed"]);
  });

  it("onStatusChange trả hàm huỷ", async () => {
    const h = harness();
    const seen: string[] = [];
    const off = h.service.onStatusChange((s) => seen.push(s.state));
    off();
    await h.service.start();
    expect(seen).toEqual([]);
  });
});
