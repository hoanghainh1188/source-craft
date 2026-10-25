import { describe, expect, it } from "vitest";
import {
  sealRecord,
  serializeRecord,
} from "../../../src/main/services/audit/record-chain";
import {
  parseAuditText,
  summarizeTail,
} from "../../../src/main/services/audit/tail";
import type {
  AuditRecord,
  AuditRecordBody,
  ChainHead,
} from "../../../src/main/services/audit/audit-types";
import { deviceKeyPair } from "./helpers";

// T010 (236) — suy đầu chuỗi + phiên trước từ đuôi nhật ký (R6).

const key = deviceKeyPair();
const T0 = Date.UTC(2026, 9, 25, 2, 0, 0);

function chain(bodies: AuditRecordBody[]): AuditRecord[] {
  let head: ChainHead | null = null;
  return bodies.map((b, i) => {
    const r = sealRecord(head, b, T0 + i, key.privateKeyPem);
    head = { seq: r.seq, hash: r.hash, tsMs: T0 + i };
    return r;
  });
}
const started = (deviceKeyId: string): AuditRecordBody => ({
  type: "audit.started",
  osUser: "u",
  host: "h",
  appVersion: "1",
  policyId: "p",
  organization: "o",
  deviceKeyId,
  orgKeyId: "k",
});
const start = (id: string): AuditRecordBody => ({
  type: "interaction.start",
  interactionId: id,
  osUser: "u",
  host: "h",
  channel: "rag",
  scope: { kind: "all" },
  model: { category: "local", providerId: "ollama", model: null },
});
const end = (id: string): AuditRecordBody => ({
  type: "interaction.end",
  interactionId: id,
  status: "completed",
  model: { category: "local", providerId: "ollama", model: null },
  citations: [],
});
const text = (rs: AuditRecord[]) => rs.map(serializeRecord).join("");

describe("parseAuditText", () => {
  it("rỗng ⇒ không bản ghi, không byte dở", () => {
    expect(parseAuditText("")).toEqual({ records: [], danglingBytes: 0 });
  });

  it("dòng cuối không có \\n ⇒ danglingBytes = byte UTF-8 của phần dở", () => {
    const rs = chain([started("d1")]);
    const partial = '{"type":"interaction.start","osUser":"Nguyễn';
    const r = parseAuditText(text(rs) + partial);
    expect(r.records).toHaveLength(1);
    expect(r.danglingBytes).toBe(Buffer.byteLength(partial, "utf8"));
  });

  it("bỏ qua dòng hỏng ở giữa (trình kiểm tra mới báo lỗi)", () => {
    const rs = chain([started("d1"), start("a")]);
    const lines = text(rs).split("\n");
    const broken = [lines[0], "{oops", lines[1], ""].join("\n");
    expect(parseAuditText(broken).records).toHaveLength(2);
  });
});

describe("summarizeTail", () => {
  it("không bản ghi ⇒ head null, deviceKeyId null, phiên không mở", () => {
    expect(summarizeTail([])).toEqual({
      head: null,
      deviceKeyId: null,
      openInteractions: [],
      sessionOpen: false,
    });
  });

  it("head = bản ghi cuối; deviceKeyId từ chainStarted / keyRotated / started gần nhất", () => {
    const rs = chain([
      {
        type: "audit.chainStarted",
        devicePublicKey: "pem",
        deviceKeyId: "d1",
        orgKeyId: "k",
      },
      started("d1"),
      {
        type: "audit.keyRotated",
        previousDeviceKeyId: "d1",
        devicePublicKey: "pem2",
        deviceKeyId: "d2",
        reason: "keyMissing",
      },
      { type: "audit.stopped", reason: "appQuit" },
    ]);
    const s = summarizeTail(rs);
    const last = rs[rs.length - 1]!;
    expect(s.head).toEqual({
      seq: last.seq,
      hash: last.hash,
      tsMs: Date.parse(last.ts),
    });
    expect(s.deviceKeyId).toBe("d2");
    expect(s.sessionOpen).toBe(false);
  });

  it("phiên mở (started không có stopped sau) + tương tác mở chỉ tính trong phiên cuối", () => {
    const rs = chain([
      started("d1"),
      start("old-open"),
      { type: "audit.stopped", reason: "appQuit" },
      started("d1"),
      start("a"),
      end("a"),
      start("b"),
    ]);
    const s = summarizeTail(rs);
    expect(s.sessionOpen).toBe(true);
    expect(s.openInteractions).toEqual(["b"]);
  });

  it("sessionAborted đã liệt kê ⇒ không tính là mở", () => {
    const rs = chain([
      started("d1"),
      start("x"),
      started("d1"),
      { type: "audit.sessionAborted", openInteractions: ["x"] },
    ]);
    expect(summarizeTail(rs).openInteractions).toEqual([]);
  });
});
