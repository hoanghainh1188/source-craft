import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileNameFor } from "../../../src/main/services/audit/rotation";
import { AUDIT_DIR, memoryAuditFs, memoryKeystore } from "./helpers";
import { configuredPolicy, harness } from "./service-harness";

// T017 (236) — khởi động: chainStarted, started, tailRepaired, sessionAborted, keyRotated; không bao giờ ném (FR-014, FR-019b, R6, R19).

describe("AuditService.start", () => {
  it("chưa có tệp ⇒ audit.chainStarted rồi audit.started đủ trường; status active", async () => {
    const h = harness();
    await h.service.start();
    expect(h.types()).toEqual(["audit.chainStarted", "audit.started"]);
    const [chain, started] = h.records();
    expect(chain).toMatchObject({
      seq: 0,
      orgKeyId: expect.stringMatching(/^[0-9a-f]{32}$/),
    });
    expect(started).toMatchObject({
      osUser: "CORP\\nguyen.an",
      host: "BANK-LT-0142",
      appVersion: "0.3.0",
      policyId: "pol-1",
      organization: "Ngân hàng X",
      licenseId: "lic-1",
    });
    expect(started!.type === "audit.started" && started!.deviceKeyId).toBe(
      chain!.type === "audit.chainStarted" ? chain!.deviceKeyId : "",
    );
    expect(h.service.status()).toEqual({
      state: "active",
      organization: "Ngân hàng X",
      directoryKind: "custom",
    });
  });

  it("thư mục mặc định ⇒ directoryKind default", async () => {
    const h = harness({ policy: configuredPolicy(null) });
    await h.service.start();
    expect(h.service.status().directoryKind).toBe("default");
    expect(h.fs.list("/userData/audit")).toHaveLength(1);
  });

  it("đuôi dở ⇒ audit.tailRepaired là bản ghi đầu tiên của phiên", async () => {
    const fs = memoryAuditFs();
    const ks = memoryKeystore();
    const first = harness({ fs, keyStore: ks });
    await first.service.start();
    first.service.stop("appQuit");
    const file = join(AUDIT_DIR, fileNameFor(0));
    fs.files.set(
      file,
      Buffer.concat([fs.files.get(file)!, Buffer.from('{"cut')]),
    );
    const second = harness({ fs, keyStore: ks });
    await second.service.start();
    const types = second.types();
    const i = types.lastIndexOf("audit.stopped");
    expect(types.slice(i + 1)).toEqual(["audit.tailRepaired", "audit.started"]);
    expect(
      second.records().find((r) => r.type === "audit.tailRepaired"),
    ).toMatchObject({
      danglingBytes: 5,
    });
  });

  it("phiên trước không có audit.stopped ⇒ audit.sessionAborted{openInteractions}", async () => {
    const fs = memoryAuditFs();
    const ks = memoryKeystore();
    const first = harness({ fs, keyStore: ks });
    await first.service.start();
    // lượt treo: run không bao giờ xong ⇒ có interaction.start, không có end (giả lập crash)
    void first.service.runInteraction(
      {
        channel: "rag",
        scope: { kind: "all" },
        question: "q",
        model: { category: "local", providerId: "ollama", model: null },
      },
      () => new Promise(() => {}),
      () => ({ status: "completed", citations: [] }),
    );
    await new Promise((r) => setTimeout(r, 0));
    const second = harness({ fs, keyStore: ks });
    await second.service.start();
    const aborted = second
      .records()
      .find((r) => r.type === "audit.sessionAborted");
    expect(aborted).toMatchObject({ openInteractions: ["int-1"] });
  });

  it("khoá trong keychain mất ⇒ audit.keyRotated{keyMissing} nối chuỗi", async () => {
    const fs = memoryAuditFs();
    const first = harness({ fs });
    await first.service.start();
    first.service.stop("appQuit");
    const second = harness({ fs, keyStore: memoryKeystore() });
    await second.service.start();
    const rot = second.records().find((r) => r.type === "audit.keyRotated");
    expect(rot).toMatchObject({ reason: "keyMissing" });
    expect(
      second.types().filter((t) => t === "audit.chainStarted"),
    ).toHaveLength(1);
  });

  it("off / licenseInactive ⇒ không tạo tệp", async () => {
    const off = harness({ policy: { status: "notConfigured" } });
    await off.service.start();
    expect(off.fs.files.size).toBe(0);
    expect(off.service.status()).toEqual({ state: "off" });
    const inactive = harness({ license: { valid: true, itPolicy: false } });
    await inactive.service.start();
    expect(inactive.fs.files.size).toBe(0);
    expect(inactive.service.status()).toMatchObject({
      state: "licenseInactive",
      organization: "Ngân hàng X",
    });
  });

  it("policyError ⇒ status policyError + lý do, không ghi", async () => {
    const h = harness({
      policy: { status: "policyError", reason: "invalidAuditPublicKey" },
    });
    await h.service.start();
    expect(h.service.status()).toEqual({
      state: "policyError",
      reason: "invalidAuditPublicKey",
    });
    expect(h.fs.files.size).toBe(0);
  });

  it("lỗi I/O hoặc keychain ⇒ không ném, status blocked + reason, log chỉ có errorType", async () => {
    const fs = memoryAuditFs();
    fs.failAppend = { code: "ENOSPC" };
    const h = harness({ fs });
    await expect(h.service.start()).resolves.toBeUndefined();
    expect(h.service.status()).toMatchObject({
      state: "blocked",
      reason: "writeFailed",
    });
    expect(h.events.find((e) => e.event === "audit.writeFailed")?.meta).toEqual(
      { errorType: "ENOSPC" },
    );

    const ks = memoryKeystore();
    ks.failing = true;
    const k = harness({ keyStore: ks });
    await k.service.start();
    expect(k.service.status()).toMatchObject({
      state: "blocked",
      reason: "keyUnavailable",
    });
  });
});
