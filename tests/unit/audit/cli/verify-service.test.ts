import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyAuditDir } from "../../../../src/main/services/audit/cli/verify";
import { fileNameFor } from "../../../../src/main/services/audit/rotation";
import type { InteractionMeta } from "../../../../src/main/services/audit/audit-types";
import { AUDIT_DIR, memoryAuditFs, memoryKeystore } from "../helpers";
import { harness } from "../service-harness";

// Review PR B (S2): nhật ký do CHÍNH AuditService sinh ra trong các kịch bản thật phải kiểm là intact.

const meta: InteractionMeta = {
  channel: "rag",
  scope: { kind: "all" },
  question: "q",
  model: { category: "local", providerId: "ollama", model: null },
};
const done = () => ({ status: "completed" as const, citations: [] });
const kinds = (fs: ReturnType<typeof memoryAuditFs>) =>
  verifyAuditDir(fs, AUDIT_DIR)
    .warnings.map((w) => w.kind)
    .filter((k) => k !== "clockBackwards"); // mỗi harness khởi động lại đồng hồ giả

describe("verify trên nhật ký do service sinh", () => {
  it("phiên bình thường + tương tác + thoát ⇒ intact, không cảnh báo", async () => {
    const h = harness();
    await h.service.start();
    await h.service.runInteraction(meta, async () => 1, done);
    h.service.stop("appQuit");
    expect(verifyAuditDir(h.fs, AUDIT_DIR)).toMatchObject({
      result: "intact",
      warnings: [],
    });
  });

  it("crash giữa lượt ⇒ khởi động lại (sessionAborted) ⇒ intact", async () => {
    const fs = memoryAuditFs();
    const ks = memoryKeystore();
    const a = harness({ fs, keyStore: ks });
    await a.service.start();
    void a.service.runInteraction(meta, () => new Promise(() => {}), done);
    await new Promise((r) => setTimeout(r, 0));
    const b = harness({ fs, keyStore: ks });
    await b.service.start();
    b.service.stop("appQuit");
    expect(verifyAuditDir(fs, AUDIT_DIR).result).toBe("intact");
  });

  it("mất khoá ⇒ keyRotated ⇒ intact + cảnh báo keyRotated", async () => {
    const fs = memoryAuditFs();
    const a = harness({ fs });
    await a.service.start();
    a.service.stop("appQuit");
    const b = harness({ fs, keyStore: memoryKeystore() });
    await b.service.start();
    b.service.stop("appQuit");
    expect(verifyAuditDir(fs, AUDIT_DIR).result).toBe("intact");
    expect(kinds(fs)).toEqual(["keyRotated"]);
  });

  it("B1: mảnh dở + mất khoá cùng lần khởi động ⇒ intact (tailRepaired ký bằng khoá mới của keyRotated kế tiếp)", async () => {
    const fs = memoryAuditFs();
    const a = harness({ fs });
    await a.service.start();
    a.service.stop("appQuit");
    const file = join(AUDIT_DIR, fileNameFor(0));
    fs.files.set(
      file,
      Buffer.concat([fs.files.get(file)!, Buffer.from('{"half')]),
    );
    const b = harness({ fs, keyStore: memoryKeystore() });
    await b.service.start();
    b.service.stop("appQuit");
    const r = verifyAuditDir(fs, AUDIT_DIR);
    expect(r.firstFailure).toBeUndefined();
    expect(r.result).toBe("intact");
    expect(kinds(fs)).toEqual(
      expect.arrayContaining(["tailRepaired", "keyRotated"]),
    );
  });

  it("mất bản quyền giữa phiên ⇒ stopped{licenseInactive} ⇒ có lại ⇒ intact", async () => {
    const h = harness();
    await h.service.start();
    let finish!: (v: number) => void;
    const p = h.service.runInteraction(
      meta,
      () => new Promise<number>((r) => (finish = r)),
      done,
    );
    await new Promise((r) => setTimeout(r, 0));
    h.env.license = { valid: false, itPolicy: true };
    await h.service.reevaluate();
    finish(1);
    await p;
    h.env.license = { valid: true, itPolicy: true };
    await h.service.reevaluate();
    h.service.stop("appQuit");
    expect(verifyAuditDir(h.fs, AUDIT_DIR)).toMatchObject({
      result: "intact",
      warnings: [],
    });
  });
});
