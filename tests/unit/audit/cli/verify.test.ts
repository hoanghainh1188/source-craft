import { describe, expect, it } from "vitest";
import { verifyAuditDir } from "../../../../src/main/services/audit/cli/verify";
import {
  keyIdOf,
  sealRecord,
  serializeRecord,
} from "../../../../src/main/services/audit/record-chain";
import { createAuditWriter } from "../../../../src/main/services/audit/audit-writer";
import { DIR, buildStandard, rec, wrap } from "./fixtures";
import {
  deviceKeyPair,
  fakeClock,
  memoryAuditFs,
  orgKeyPair,
} from "../helpers";

// T055 (236) — trình kiểm tra toàn vẹn (contracts/audit-record.md, data-model §7, SC-003).

describe("verifyAuditDir — nguyên vẹn", () => {
  it("chuẩn ⇒ intact + đủ trường báo cáo", () => {
    const f = buildStandard();
    expect(f.files().length).toBeGreaterThanOrEqual(2);
    const r = verifyAuditDir(f.fs, DIR);
    expect(r.result).toBe("intact");
    expect(r.firstFailure).toBeUndefined();
    expect(r.files).toEqual(f.files());
    expect(r.firstSeq).toBe(0);
    expect(r.lastSeq).toBe(r.records - 1);
    expect(r.firstTs).toMatch(/^2026-10-25T/);
    expect(r.deviceKeyIds).toEqual([keyIdOf(f.device.publicKeyPem)]);
    expect(r.warnings).toEqual([]);
  });

  it("thư mục rỗng ⇒ tampered(missingFile)", () => {
    expect(verifyAuditDir(memoryAuditFs(), DIR)).toMatchObject({
      result: "tampered",
      firstFailure: { kind: "missingFile" },
    });
  });
});

describe("verifyAuditDir — can thiệp (SC-003)", () => {
  it("sửa một ký tự ⇒ badHash đúng seq", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    ls[4] = ls[4]!.replace("nguyen.an", "nguyen.bn"); // seq 4 = interaction.start (có osUser)
    f.setLines(file!, ls);
    expect(verifyAuditDir(f.fs, DIR).firstFailure).toMatchObject({
      kind: "badHash",
      seq: 4,
      line: 5,
      file,
    });
  });

  it("xoá một dòng ⇒ seqGap", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    ls.splice(7, 1);
    f.setLines(file!, ls);
    expect(verifyAuditDir(f.fs, DIR).firstFailure).toMatchObject({
      kind: "seqGap",
      seq: 8,
    });
  });

  it("chèn bản ghi giả do khoá khác ký ⇒ badSignature hoặc brokenChain", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    const prev = rec(ls[3]!);
    const forged = sealRecord(
      { seq: prev.seq, hash: prev.hash, tsMs: Date.parse(prev.ts) },
      { type: "audit.stopped", reason: "appQuit" },
      Date.parse(prev.ts) + 1,
      deviceKeyPair().privateKeyPem,
    );
    ls.splice(4, 0, serializeRecord(forged).trimEnd());
    f.setLines(file!, ls);
    expect(["badSignature", "brokenChain", "seqOrder"]).toContain(
      verifyAuditDir(f.fs, DIR).firstFailure?.kind,
    );
  });

  it("đổi thứ tự hai dòng ⇒ seqOrder", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    [ls[4], ls[5]] = [ls[5]!, ls[4]!];
    f.setLines(file!, ls);
    expect(verifyAuditDir(f.fs, DIR).firstFailure?.kind).toMatch(
      /seqOrder|seqGap/,
    );
  });

  it("thiếu tệp ở giữa ⇒ missingFile", () => {
    const f = buildStandard({ maxFileBytes: 3000 });
    const files = f.files();
    expect(files.length).toBeGreaterThanOrEqual(3);
    f.fs.files.delete(`${DIR}/${files[1]}`);
    expect(verifyAuditDir(f.fs, DIR).firstFailure).toMatchObject({
      kind: "missingFile",
      file: files[2],
    });
  });

  it("dòng hỏng không được giải thích ⇒ malformedLine", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    ls.splice(3, 0, "{oops");
    f.setLines(file!, ls);
    expect(verifyAuditDir(f.fs, DIR).firstFailure).toMatchObject({
      kind: "malformedLine",
      line: 4,
    });
  });
});

describe("verifyAuditDir — cảnh báo (vẫn intact)", () => {
  it("tương tác chưa kết thúc ⇒ openInteraction", () => {
    const f = buildStandard({ closeSession: false });
    const last = f.files().at(-1)!;
    const ls = f.lines(last);
    ls.pop(); // bỏ interaction.end cuối ⇒ start cuối mở
    f.setLines(last, ls);
    const r = verifyAuditDir(f.fs, DIR);
    expect(r.result).toBe("intact");
    expect(r.warnings.map((w) => w.kind)).toContain("openInteraction");
  });

  it("đổi khoá ký (keyRotated ký bằng khoá mới) ⇒ intact + cảnh báo keyRotated, 2 deviceKeyId", () => {
    const fs = memoryAuditFs();
    const d1 = deviceKeyPair();
    const d2 = deviceKeyPair();
    const org = orgKeyPair();
    const w = createAuditWriter({ fs, dir: DIR, clock: fakeClock() });
    w.open();
    w.append(
      () => ({
        type: "audit.chainStarted",
        devicePublicKey: d1.publicKeyPem,
        deviceKeyId: keyIdOf(d1.publicKeyPem),
        orgKeyId: keyIdOf(org.publicKeyPem),
      }),
      d1.privateKeyPem,
    );
    w.append(
      () => ({ type: "audit.stopped", reason: "appQuit" }),
      d1.privateKeyPem,
    );
    w.append(
      () => ({
        type: "audit.keyRotated",
        previousDeviceKeyId: keyIdOf(d1.publicKeyPem),
        devicePublicKey: d2.publicKeyPem,
        deviceKeyId: keyIdOf(d2.publicKeyPem),
        reason: "keyMissing",
      }),
      d2.privateKeyPem,
    );
    w.append(
      () => ({ type: "audit.stopped", reason: "appQuit" }),
      d2.privateKeyPem,
    );
    const r = verifyAuditDir(fs, DIR);
    expect(r.result).toBe("intact");
    expect(r.warnings.map((x) => x.kind)).toEqual(["keyRotated"]);
    expect(r.warnings[0]!.detail).toContain("keyMissing");
    expect(r.deviceKeyIds).toEqual([
      keyIdOf(d1.publicKeyPem),
      keyIdOf(d2.publicKeyPem),
    ]);
    // sau khi đổi khoá, bản ghi ký bằng khoá CŨ bị từ chối
    const f2 = wrap(fs, d1, org, []);
    const file = f2.files()[0]!;
    const ls = f2.lines(file);
    const prev = rec(ls[2]!);
    ls[3] = serializeRecord(
      sealRecord(
        { seq: prev.seq, hash: prev.hash, tsMs: Date.parse(prev.ts) },
        { type: "audit.stopped", reason: "appQuit" },
        Date.parse(prev.ts),
        d1.privateKeyPem,
      ),
    ).trimEnd();
    f2.setLines(file, ls);
    expect(verifyAuditDir(fs, DIR).firstFailure).toMatchObject({
      kind: "badSignature",
      seq: 3,
    });
  });

  it("dòng dở đã được audit.tailRepaired giải thích ⇒ intact + cảnh báo tailRepaired", () => {
    const f = buildStandard();
    const last = f.files().at(-1)!;
    const path = `${DIR}/${last}`;
    f.fs.files.set(
      path,
      Buffer.concat([f.fs.files.get(path)!, Buffer.from('{"cut')]),
    );
    const w = createAuditWriter({
      fs: f.fs,
      dir: DIR,
      clock: fakeClock(Date.UTC(2026, 9, 26)),
    });
    w.open();
    w.append(
      () => ({ type: "audit.stopped", reason: "appQuit" }),
      f.device.privateKeyPem,
    );
    const r = verifyAuditDir(f.fs, DIR);
    expect(r.result).toBe("intact");
    expect(r.warnings.map((x) => x.kind)).toContain("tailRepaired");
  });

  it("đuôi dở CHƯA sửa ở cuối tệp cuối ⇒ intact + cảnh báo danglingTail (crash phiên đang mở)", () => {
    const f = buildStandard();
    const last = f.files().at(-1)!;
    const path = `${DIR}/${last}`;
    f.fs.files.set(
      path,
      Buffer.concat([f.fs.files.get(path)!, Buffer.from('{"cut')]),
    );
    const r = verifyAuditDir(f.fs, DIR);
    expect(r.result).toBe("intact");
    expect(r.warnings.map((x) => x.kind)).toContain("danglingTail");
  });

  it("--expect-device-key khác khoá đầu chuỗi ⇒ unexpectedDeviceKey", () => {
    const f = buildStandard();
    expect(
      verifyAuditDir(f.fs, DIR, { expectDeviceKeyIds: ["f".repeat(32)] })
        .firstFailure,
    ).toMatchObject({
      kind: "unexpectedDeviceKey",
      seq: 0,
    });
    expect(
      verifyAuditDir(f.fs, DIR, {
        expectDeviceKeyIds: [keyIdOf(f.device.publicKeyPem)],
      }).result,
    ).toBe("intact");
  });

  it("tệp đầu đã được lưu trữ đi (bắt đầu bằng fileStarted) ⇒ cần khoá máy; có khoá ⇒ intact + startsAfterZero", () => {
    const f = buildStandard({ maxFileBytes: 3000 });
    f.fs.files.delete(`${DIR}/${f.files()[0]}`);
    expect(verifyAuditDir(f.fs, DIR).firstFailure?.kind).toBe("missingFile");
    const r = verifyAuditDir(f.fs, DIR, {
      expectDevicePublicKeyPem: f.device.publicKeyPem,
    });
    expect(r.result).toBe("intact");
    expect(r.warnings.map((x) => x.kind)).toContain("startsAfterZero");
    expect(r.firstSeq).toBeGreaterThan(0);
  });

  it("đồng hồ lùi ⇒ cảnh báo clockBackwards", () => {
    const fs = memoryAuditFs();
    const d = deviceKeyPair();
    const clock = fakeClock(Date.UTC(2026, 9, 25), 0);
    const w = createAuditWriter({ fs, dir: DIR, clock });
    w.open();
    w.append(
      () => ({
        type: "audit.chainStarted",
        devicePublicKey: d.publicKeyPem,
        deviceKeyId: keyIdOf(d.publicKeyPem),
        orgKeyId: "k",
      }),
      d.privateKeyPem,
    );
    clock.set(Date.UTC(2026, 9, 24));
    w.append(
      () => ({ type: "audit.stopped", reason: "appQuit" }),
      d.privateKeyPem,
    );
    expect(verifyAuditDir(fs, DIR).warnings.map((x) => x.kind)).toEqual([
      "clockBackwards",
    ]);
  });
});

// Review PR B (bảo mật B1/S1, code S1/S2): các đường đổi khoá / ranh giới tệp không được lừa trình kiểm tra.
describe("verifyAuditDir — chống lách bằng đổi khoá", () => {
  const forgeAt = (
    f: ReturnType<typeof buildStandard>,
    idx: number,
    body: Parameters<typeof sealRecord>[1],
    signer: string,
  ) => {
    const [file] = f.files();
    const ls = f.lines(file!);
    const prev = rec(ls[idx - 1]!);
    const forged = sealRecord(
      { seq: prev.seq, hash: prev.hash, tsMs: Date.parse(prev.ts) },
      body,
      Date.parse(prev.ts) + 1,
      signer,
    );
    // Viết lại phần sau bằng khoá của kẻ tấn công: chỉ giữ tới bản ghi giả để kiểm tra dừng đúng chỗ.
    f.setLines(file!, [...ls.slice(0, idx), serializeRecord(forged).trimEnd()]);
    for (const other of f.files().slice(1))
      f.fs.files.delete(`${DIR}/${other}`);
    return { file: file!, seq: forged.seq };
  };

  it("audit.chainStarted ở giữa chuỗi (khoá kẻ tấn công) ⇒ brokenChain", () => {
    const f = buildStandard();
    const evil = deviceKeyPair();
    const { seq } = forgeAt(
      f,
      3,
      {
        type: "audit.chainStarted",
        devicePublicKey: evil.publicKeyPem,
        deviceKeyId: keyIdOf(evil.publicKeyPem),
        orgKeyId: "k",
      },
      evil.privateKeyPem,
    );
    expect(verifyAuditDir(f.fs, DIR).firstFailure).toMatchObject({
      kind: "brokenChain",
      seq,
    });
  });

  it("audit.keyRotated có previousDeviceKeyId KHÁC khoá hiện tại ⇒ brokenChain", () => {
    const f = buildStandard();
    const evil = deviceKeyPair();
    const { seq } = forgeAt(
      f,
      3,
      {
        type: "audit.keyRotated",
        previousDeviceKeyId: "0".repeat(32),
        devicePublicKey: evil.publicKeyPem,
        deviceKeyId: keyIdOf(evil.publicKeyPem),
        reason: "keyMissing",
      },
      evil.privateKeyPem,
    );
    expect(verifyAuditDir(f.fs, DIR).firstFailure).toMatchObject({
      kind: "brokenChain",
      seq,
    });
  });

  it("có ghim khoá ⇒ xoay sang khoá KHÔNG được ghim ⇒ unexpectedDeviceKey; ghim cả khoá mới ⇒ intact", () => {
    const f = buildStandard();
    const evil = deviceKeyPair();
    forgeAt(
      f,
      3,
      {
        type: "audit.keyRotated",
        previousDeviceKeyId: keyIdOf(f.device.publicKeyPem),
        devicePublicKey: evil.publicKeyPem,
        deviceKeyId: keyIdOf(evil.publicKeyPem),
        reason: "keyMissing",
      },
      evil.privateKeyPem,
    );
    const orig = keyIdOf(f.device.publicKeyPem);
    expect(
      verifyAuditDir(f.fs, DIR, { expectDeviceKeyIds: [orig] }).firstFailure,
    ).toMatchObject({
      kind: "unexpectedDeviceKey",
    });
    expect(
      verifyAuditDir(f.fs, DIR, {
        expectDeviceKeyIds: [orig, keyIdOf(evil.publicKeyPem)],
      }).result,
    ).toBe("intact");
    // Không ghim: intact nhưng LUÔN có cảnh báo keyRotated kèm khoá cũ → mới.
    const r = verifyAuditDir(f.fs, DIR);
    expect(r.result).toBe("intact");
    expect(r.warnings.find((w) => w.kind === "keyRotated")?.detail).toContain(
      keyIdOf(evil.publicKeyPem),
    );
  });

  it("interaction.end không có start ⇒ cảnh báo orphanEnd", () => {
    const fs = memoryAuditFs();
    const d = deviceKeyPair();
    const w = createAuditWriter({ fs, dir: DIR, clock: fakeClock() });
    w.open();
    w.append(
      () => ({
        type: "audit.chainStarted",
        devicePublicKey: d.publicKeyPem,
        deviceKeyId: keyIdOf(d.publicKeyPem),
        orgKeyId: "k",
      }),
      d.privateKeyPem,
    );
    w.append(
      () => ({
        type: "interaction.end",
        interactionId: "x",
        status: "completed",
        model: { category: "local", providerId: "ollama", model: null },
        citations: [],
      }),
      d.privateKeyPem,
    );
    expect(verifyAuditDir(fs, DIR).warnings.map((x) => x.kind)).toEqual([
      "orphanEnd",
    ]);
  });

  it("fileStarted.prevFile sai ⇒ brokenChain; thiếu bản ghi ở ranh giới tệp ⇒ missingFile", () => {
    const f = buildStandard({ maxFileBytes: 3000 });
    const second = f.files()[1]!;
    const ls = f.lines(second);
    const fsRec = rec(ls[0]!);
    const wrongPrev = { ...fsRec, prevFile: "audit-999999999999.jsonl" };
    f.setLines(second, [JSON.stringify(wrongPrev), ...ls.slice(1)]);
    expect(verifyAuditDir(f.fs, DIR).firstFailure?.kind).toMatch(
      /brokenChain|badHash/,
    );

    const g = buildStandard({ maxFileBytes: 3000 });
    const first = g.files()[0]!;
    const gl = g.lines(first);
    g.setLines(first, gl.slice(0, -1)); // mất bản ghi cuối tệp đầu ⇒ tệp sau bắt đầu ở seq > prev + 1
    expect(verifyAuditDir(g.fs, DIR).firstFailure).toMatchObject({
      kind: "missingFile",
      file: g.files()[1],
    });
  });
});
