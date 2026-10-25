import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuditWriter } from "../../../src/main/services/audit/audit-writer";
import type {
  AuditRecord,
  AuditRecordBody,
} from "../../../src/main/services/audit/audit-types";
import { fileNameFor } from "../../../src/main/services/audit/rotation";
import { verifySeal } from "../../../src/main/services/audit/record-chain";
import { AUDIT_DIR, deviceKeyPair, fakeClock, memoryAuditFs } from "./helpers";

// T015 (236) — ghi tuần tự + fsync, xoay vòng nối chuỗi, đầu chuỗi chỉ tiến khi ghi thành công (R6, R7, FR-017, FR-018).

const key = deviceKeyPair();
const stopped: AuditRecordBody = { type: "audit.stopped", reason: "appQuit" };
const parse = (lines: string[]) =>
  lines.map((l) => JSON.parse(l) as AuditRecord);

function setup(maxFileBytes?: number) {
  const fs = memoryAuditFs();
  const w = createAuditWriter({
    fs,
    dir: AUDIT_DIR,
    clock: fakeClock(),
    ...(maxFileBytes ? { maxFileBytes } : {}),
  });
  w.open();
  return { fs, w };
}

describe("audit-writer", () => {
  it("thư mục trống ⇒ tạo thư mục, tệp đầu audit-000000000000.jsonl, seq bắt đầu 0", () => {
    const { fs, w } = setup();
    expect(fs.dirs.has(AUDIT_DIR)).toBe(true);
    const r = w.append(() => stopped, key.privateKeyPem);
    expect(r.seq).toBe(0);
    expect(fs.list(AUDIT_DIR)).toEqual([fileNameFor(0)]);
  });

  it("build nhận đúng seq sẽ được niêm phong", () => {
    const { w } = setup();
    w.append(() => stopped, key.privateKeyPem);
    const seen: number[] = [];
    const r = w.append((seq) => {
      seen.push(seq);
      return stopped;
    }, key.privateKeyPem);
    expect(seen).toEqual([1]);
    expect(r.seq).toBe(1);
  });

  it("20 lần ghi liên tiếp ⇒ 20 dòng nguyên vẹn, seq liên tục, mỗi lần một fsync", () => {
    const { fs, w } = setup();
    for (let i = 0; i < 20; i++) w.append(() => stopped, key.privateKeyPem);
    const recs = parse(fs.linesIn(AUDIT_DIR));
    expect(recs.map((r) => r.seq)).toEqual([...Array(20).keys()]);
    for (let i = 1; i < recs.length; i++)
      expect(recs[i]!.prevHash).toBe(recs[i - 1]!.hash);
    for (const r of recs)
      expect(verifySeal(r, key.publicKeyPem)).toEqual({ ok: true });
    expect(fs.fsyncCount).toBe(20);
  });

  it("vượt ngưỡng ⇒ tệp mới bắt đầu bằng audit.fileStarted{prevFile}, chuỗi nối liền, không xoá tệp cũ", () => {
    const { fs, w } = setup(600);
    for (let i = 0; i < 8; i++) w.append(() => stopped, key.privateKeyPem);
    const names = fs.list(AUDIT_DIR).sort();
    expect(names.length).toBeGreaterThan(1);
    const recs = parse(fs.linesIn(AUDIT_DIR));
    recs.forEach((r, i) => expect(r.seq).toBe(i));
    for (let i = 1; i < recs.length; i++)
      expect(recs[i]!.prevHash).toBe(recs[i - 1]!.hash);
    const secondFirst = JSON.parse(
      fs.text(join(AUDIT_DIR, names[1]!)).split("\n")[0]!,
    );
    expect(secondFirst).toMatchObject({
      type: "audit.fileStarted",
      prevFile: names[0],
    });
    expect(names[1]).toBe(fileNameFor(secondFirst.seq));
  });

  it("ghi lỗi (ENOSPC) ⇒ ném kèm code, đầu chuỗi KHÔNG tiến; lần sau nối đúng sau bản ghi cuối đã ghi", () => {
    const { fs, w } = setup();
    const a = w.append(() => stopped, key.privateKeyPem);
    fs.failAppend = { code: "ENOSPC", once: true };
    expect(() => w.append(() => stopped, key.privateKeyPem)).toThrow(
      expect.objectContaining({ code: "ENOSPC" }),
    );
    expect(w.head()).toEqual({
      seq: a.seq,
      hash: a.hash,
      tsMs: Date.parse(a.ts),
    });
    const b = w.append(() => stopped, key.privateKeyPem);
    expect(b.seq).toBe(1);
    expect(b.prevHash).toBe(a.hash);
  });

  it("open() trên thư mục có sẵn ⇒ tiếp tục chuỗi; đuôi dở ⇒ danglingBytes, lần ghi đầu xuống dòng trước", () => {
    const { fs, w } = setup();
    const a = w.append(() => stopped, key.privateKeyPem);
    const file = join(AUDIT_DIR, fileNameFor(0));
    fs.files.set(
      file,
      Buffer.concat([fs.files.get(file)!, Buffer.from('{"half":')]),
    );
    const w2 = createAuditWriter({
      fs,
      dir: AUDIT_DIR,
      clock: fakeClock(Date.now()),
    });
    const tail = w2.open();
    expect(tail.danglingBytes).toBe(Buffer.byteLength('{"half":'));
    expect(tail.head?.seq).toBe(a.seq);
    const b = w2.append(() => stopped, key.privateKeyPem);
    expect(b.seq).toBe(2);
    expect(a.seq).toBe(0);
    const lines = fs.text(file).split("\n");
    expect(lines[1]).toBe('{"half":');
    expect(JSON.parse(lines[2]!)).toMatchObject({
      seq: 1,
      type: "audit.tailRepaired",
      danglingBytes: Buffer.byteLength('{"half":'),
    });
    expect(JSON.parse(lines[3]!).seq).toBe(2);
  });

  it("open() ném khi không tạo được thư mục", () => {
    const fs = memoryAuditFs();
    fs.mkdirp = () => {
      const e = new Error("EACCES") as NodeJS.ErrnoException;
      e.code = "EACCES";
      throw e;
    };
    const w = createAuditWriter({ fs, dir: AUDIT_DIR, clock: fakeClock() });
    expect(() => w.open()).toThrow(expect.objectContaining({ code: "EACCES" }));
  });
});

// Review (Blocking): lỗi GIỮA lúc ghi không được làm hỏng chuỗi — writer đồng bộ lại từ đĩa trước lần ghi kế tiếp.
describe("audit-writer — lỗi giữa chừng", () => {
  const verifyChain = (recs: AuditRecord[]) => {
    recs.forEach((r, i) => expect(r.seq).toBe(i));
    for (let i = 1; i < recs.length; i++)
      expect(recs[i]!.prevHash).toBe(recs[i - 1]!.hash);
  };
  const goodLines = (fs: ReturnType<typeof memoryAuditFs>) =>
    fs.linesIn(AUDIT_DIR).flatMap((l) => {
      try {
        return [JSON.parse(l) as AuditRecord];
      } catch {
        return [];
      }
    });

  it("ghi DỞ nửa dòng rồi ném ⇒ lần sau: xuống dòng + audit.tailRepaired, chuỗi liên tục, không dòng ghép", () => {
    const { fs, w } = setup();
    w.append(() => stopped, key.privateKeyPem);
    const realAppend = fs.appendDurable.bind(fs);
    fs.appendDurable = (p, d) => {
      realAppend(p, d.slice(0, 20)); // ghi được một phần
      fs.appendDurable = realAppend;
      const e = new Error("ENOSPC") as NodeJS.ErrnoException;
      e.code = "ENOSPC";
      throw e;
    };
    expect(() => w.append(() => stopped, key.privateKeyPem)).toThrow();
    w.append(() => stopped, key.privateKeyPem);
    const lines = fs.linesIn(AUDIT_DIR);
    expect(lines).toHaveLength(4); // rec0, mảnh dở, tailRepaired, rec mới
    const recs = goodLines(fs);
    expect(recs.map((r) => r.type)).toEqual([
      "audit.stopped",
      "audit.tailRepaired",
      "audit.stopped",
    ]);
    expect(recs[1]).toMatchObject({ danglingBytes: 20 });
    verifyChain(recs);
  });

  it("ghi XONG nhưng fsync ném ⇒ lần sau nối sau dòng đã nằm trên đĩa (không trùng seq)", () => {
    const { fs, w } = setup();
    w.append(() => stopped, key.privateKeyPem);
    const realAppend = fs.appendDurable.bind(fs);
    fs.appendDurable = (p, d) => {
      realAppend(p, d); // dữ liệu đã xuống đĩa
      fs.appendDurable = realAppend;
      const e = new Error("EIO") as NodeJS.ErrnoException;
      e.code = "EIO";
      throw e;
    };
    expect(() => w.append(() => stopped, key.privateKeyPem)).toThrow();
    const r = w.append(() => stopped, key.privateKeyPem);
    expect(r.seq).toBe(2);
    verifyChain(goodLines(fs));
  });
});

describe("audit-writer — đọc lùi đuôi qua nhiều tệp (review #5)", () => {
  it("audit.started nằm ngoài 2 tệp cuối ⇒ vẫn thấy phiên mở + khoá máy + tương tác mở", () => {
    const fs = memoryAuditFs();
    const w = createAuditWriter({
      fs,
      dir: AUDIT_DIR,
      clock: fakeClock(),
      maxFileBytes: 700,
    });
    w.open();
    w.append(
      () => ({
        type: "audit.started",
        osUser: "u",
        host: "h",
        appVersion: "1",
        policyId: "p",
        organization: "o",
        deviceKeyId: "dev-1",
        orgKeyId: "k",
      }),
      key.privateKeyPem,
    );
    w.append(
      () => ({
        type: "interaction.start",
        interactionId: "open-1",
        osUser: "u",
        host: "h",
        channel: "rag",
        scope: { kind: "all" },
        model: { category: "local", providerId: "ollama", model: null },
      }),
      key.privateKeyPem,
    );
    for (let i = 0; i < 12; i++)
      w.append(
        () => ({ type: "audit.recovered", since: "x" }),
        key.privateKeyPem,
      );
    expect(fs.list(AUDIT_DIR).length).toBeGreaterThan(3);
    const tail = createAuditWriter({
      fs,
      dir: AUDIT_DIR,
      clock: fakeClock(),
    }).open();
    expect(tail.sessionOpen).toBe(true);
    expect(tail.deviceKeyId).toBe("dev-1");
    expect(tail.openInteractions).toEqual(["open-1"]);
  });
});
