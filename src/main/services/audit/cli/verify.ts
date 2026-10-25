import { join } from "node:path";
import { GENESIS_PREV_HASH } from "../audit-constants";
import type { AuditFs, AuditRecord } from "../audit-types";
import { createPublicKey } from "node:crypto";
import { hashRecord, keyIdOf, verifySeal } from "../record-chain";
import { firstSeqOf, sortAuditFiles } from "../rotation";

// 236 (PR B) — kiểm tra toàn vẹn nhật ký kiểm toán, hoàn toàn offline (FR-020, SC-003, SC-004; contracts/audit-record.md).
// Thuần (fs tiêm vào), CHỈ ĐỌC. Dừng ở lỗi đầu tiên; cảnh báo không làm hỏng kết quả.
// Thứ tự kiểm từng bản ghi: dòng parse được → seq liên tục → prevHash → hash → chữ ký của khoá máy đang hiệu lực.

export type AuditReadFs = Pick<AuditFs, "list" | "readFile">;

export type AuditVerifyFailureKind =
  | "malformedLine"
  | "badHash"
  | "badSignature"
  | "brokenChain"
  | "seqGap"
  | "seqOrder"
  | "missingFile"
  | "unexpectedDeviceKey";

export type AuditVerifyWarningKind =
  | "openInteraction"
  | "keyRotated"
  | "startsAfterZero"
  | "clockBackwards"
  | "tailRepaired"
  | "danglingTail"
  | "orphanEnd"
  | "openAtStop";

export interface AuditVerifyWarning {
  kind: AuditVerifyWarningKind;
  seq: number;
  file: string;
  /** keyRotated: "<khoá cũ> → <khoá mới> (<lý do>)". */
  detail?: string;
}

export interface AuditVerifyReport {
  result: "intact" | "tampered";
  files: string[];
  records: number;
  firstSeq: number | null;
  lastSeq: number | null;
  firstTs: string | null;
  lastTs: string | null;
  deviceKeyIds: string[];
  warnings: AuditVerifyWarning[];
  firstFailure?: {
    file: string;
    line: number;
    seq: number | null;
    kind: AuditVerifyFailureKind;
  };
}

export interface VerifyOptions {
  /** Các khoá máy IT đã đăng ký (32 hex). Có ghim ⇒ khoá đầu chuỗi VÀ mọi khoá sau khi xoay phải nằm trong danh sách. */
  expectDeviceKeyIds?: string[];
  /** Khoá công khai máy (PEM): được ghim như trên + cho phép kiểm khi tệp đầu đã được lưu trữ đi (startsAfterZero). */
  expectDevicePublicKeyPem?: string;
}

const isRecord = (v: unknown): v is AuditRecord =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as AuditRecord).seq === "number" &&
  typeof (v as AuditRecord).type === "string" &&
  typeof (v as AuditRecord).hash === "string" &&
  typeof (v as AuditRecord).sig === "string" &&
  typeof (v as AuditRecord).prevHash === "string";

/** keyId của khoá công khai Ed25519; khoá khác loại / hỏng ⇒ null. */
function ed25519KeyId(pem: unknown): string | null {
  if (typeof pem !== "string") return null;
  try {
    return createPublicKey(pem).asymmetricKeyType === "ed25519"
      ? keyIdOf(pem)
      : null;
  } catch {
    return null;
  }
}

/** Bản ghi hợp lệ về cú pháp theo thứ tự tệp (bỏ dòng hỏng) — cho giải mã. */
export function readAuditRecords(fs: AuditReadFs, dir: string): AuditRecord[] {
  const out: AuditRecord[] = [];
  for (const f of sortAuditFiles(fs.list(dir))) {
    for (const line of fs.readFile(join(dir, f)).toString("utf8").split("\n")) {
      if (!line) continue;
      try {
        const r: unknown = JSON.parse(line);
        if (isRecord(r)) out.push(r);
      } catch {
        /* dòng dở / hỏng: trình kiểm tra báo */
      }
    }
  }
  return out;
}

export function verifyAuditDir(
  fs: AuditReadFs,
  dir: string,
  opts: VerifyOptions = {},
): AuditVerifyReport {
  const files = sortAuditFiles(fs.list(dir));
  const pinned = new Set(
    [
      ...(opts.expectDeviceKeyIds ?? []),
      ...(opts.expectDevicePublicKeyPem
        ? [keyIdOf(opts.expectDevicePublicKeyPem)]
        : []),
    ].map((k) => k.toLowerCase()),
  );
  // Review B1 (code): writer ghi tailRepaired / fileStarted NGAY TRƯỚC keyRotated bằng khoá MỚI (khoá cũ đã mất) ⇒ các bản
  // ghi cấu trúc đứng liền trước một keyRotated được phép ký bằng khoá mà keyRotated đó công bố.
  const signedByNext = new Map<number, string>();
  const all = readAuditRecords(fs, dir);
  for (let i = 0; i < all.length; i++) {
    const k = all[i]!;
    if (k.type !== "audit.keyRotated") continue;
    for (let j = i - 1; j >= 0; j--) {
      const b = all[j]!;
      if (b.type !== "audit.tailRepaired" && b.type !== "audit.fileStarted")
        break;
      signedByNext.set(b.seq, k.devicePublicKey);
    }
  }
  const report: AuditVerifyReport = {
    result: "intact",
    files,
    records: 0,
    firstSeq: null,
    lastSeq: null,
    firstTs: null,
    lastTs: null,
    deviceKeyIds: [],
    warnings: [],
  };
  const fail = (
    file: string,
    line: number,
    seq: number | null,
    kind: AuditVerifyFailureKind,
  ): AuditVerifyReport => ({
    ...report,
    result: "tampered",
    firstFailure: { file, line, seq, kind },
  });
  if (files.length === 0) return fail("", 0, null, "missingFile");

  let prev: AuditRecord | null = null;
  let key: string | null = null;
  const open = new Map<string, { seq: number; file: string }>();
  const warn = (kind: AuditVerifyWarningKind, seq: number, file: string) =>
    report.warnings.push({ kind, seq, file });

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi]!;
    const segments = fs.readFile(join(dir, file)).toString("utf8").split("\n");
    const tail = segments.pop() ?? "";
    let pending: { line: number; bytes: number } | null = null;
    let firstInFile = true;

    for (let li = 0; li < segments.length; li++) {
      const lineNo = li + 1;
      const line = segments[li]!;
      let r: AuditRecord | null = null;
      try {
        const parsed: unknown = JSON.parse(line);
        r = isRecord(parsed) ? parsed : null;
      } catch {
        r = null;
      }
      if (!r) {
        if (pending) return fail(file, pending.line, null, "malformedLine");
        pending = { line: lineNo, bytes: Buffer.byteLength(line, "utf8") };
        continue;
      }
      if (pending) {
        if (
          r.type !== "audit.tailRepaired" ||
          r.danglingBytes !== pending.bytes
        ) {
          return fail(file, pending.line, null, "malformedLine");
        }
        warn("tailRepaired", r.seq, file);
        pending = null;
      }

      // Ranh giới tệp + seq.
      if (firstInFile) {
        firstInFile = false;
        if (firstSeqOf(file) !== r.seq)
          return fail(file, lineNo, r.seq, "brokenChain");
        if (!prev) {
          if (r.seq === 0) {
            if (r.type !== "audit.chainStarted")
              return fail(file, lineNo, r.seq, "brokenChain");
          } else {
            // Tệp đầu đã được IT lưu trữ đi: chỉ kiểm được khi có khoá máy.
            if (
              r.type !== "audit.fileStarted" ||
              !opts.expectDevicePublicKeyPem
            ) {
              return fail(file, lineNo, r.seq, "missingFile");
            }
            key = opts.expectDevicePublicKeyPem;
            report.deviceKeyIds.push(keyIdOf(key));
            warn("startsAfterZero", r.seq, file);
          }
        } else {
          if (r.seq > prev.seq + 1)
            return fail(file, lineNo, r.seq, "missingFile");
          if (r.type !== "audit.fileStarted" || r.prevFile !== files[fi - 1]) {
            return fail(file, lineNo, r.seq, "brokenChain");
          }
        }
      }
      if (prev) {
        if (r.seq < prev.seq + 1) return fail(file, lineNo, r.seq, "seqOrder");
        if (r.seq > prev.seq + 1) return fail(file, lineNo, r.seq, "seqGap");
        if (r.prevHash !== prev.hash)
          return fail(file, lineNo, r.seq, "brokenChain");
      } else if (r.seq === 0 && r.prevHash !== GENESIS_PREV_HASH) {
        return fail(file, lineNo, r.seq, "brokenChain");
      }
      if (hashRecord(r) !== r.hash) return fail(file, lineNo, r.seq, "badHash");

      if (r.v !== 1) return fail(file, lineNo, r.seq, "malformedLine");

      // Khoá đang hiệu lực. chainStarted CHỈ ở seq 0 (review B1 bảo mật: chainStarted giữa chuỗi = đổi khoá trái phép).
      // keyRotated phải nối từ khoá hiện tại (previousDeviceKeyId) và tự ký bằng khoá MỚI nó công bố.
      if (r.type === "audit.chainStarted" || r.type === "audit.keyRotated") {
        const id = ed25519KeyId(r.devicePublicKey);
        if (!id || id !== r.deviceKeyId)
          return fail(file, lineNo, r.seq, "badSignature");
        if (r.type === "audit.chainStarted") {
          if (prev || r.seq !== 0)
            return fail(file, lineNo, r.seq, "brokenChain");
        } else {
          if (
            !key ||
            r.previousDeviceKeyId !== keyIdOf(key) ||
            (r.reason !== "keyMissing" && r.reason !== "keyMismatch")
          ) {
            return fail(file, lineNo, r.seq, "brokenChain");
          }
          report.warnings.push({
            kind: "keyRotated",
            seq: r.seq,
            file,
            detail: `${r.previousDeviceKeyId} → ${id} (${r.reason})`,
          });
        }
        if (pinned.size > 0 && !pinned.has(id)) {
          return fail(file, lineNo, r.seq, "unexpectedDeviceKey");
        }
        key = r.devicePublicKey;
        report.deviceKeyIds.push(id);
      }
      const nextKey = signedByNext.get(r.seq);
      if (!key && !nextKey) return fail(file, lineNo, r.seq, "missingFile");
      const signedOk =
        (key !== null && verifySeal(r, key).ok) ||
        (nextKey !== undefined &&
          ed25519KeyId(nextKey) !== null &&
          verifySeal(r, nextKey).ok);
      if (!signedOk) return fail(file, lineNo, r.seq, "badSignature");

      if (r.clockBackwards) warn("clockBackwards", r.seq, file);
      if (r.type === "interaction.start") {
        open.set(r.interactionId, { seq: r.seq, file });
      } else if (r.type === "interaction.end") {
        // Có thể hợp lệ khi start nằm ở tệp đã lưu trữ đi ⇒ cảnh báo, không phải lỗi.
        if (!open.delete(r.interactionId)) warn("orphanEnd", r.seq, file);
      } else if (
        r.type === "audit.stopped" &&
        r.reason === "appQuit" &&
        open.size > 0
      ) {
        warn("openAtStop", r.seq, file); // writer đóng mọi tương tác trước khi thoát (R6a)
      }
      if (r.type === "audit.sessionAborted") {
        for (const id of r.openInteractions) open.delete(id);
      }

      report.records += 1;
      report.firstSeq ??= r.seq;
      report.firstTs ??= r.ts;
      report.lastSeq = r.seq;
      report.lastTs = r.ts;
      prev = r;
    }

    if (pending) return fail(file, pending.line, null, "malformedLine");
    if (tail !== "") {
      // Mảnh dở chưa sửa: hợp lệ CHỈ ở cuối tệp cuối (phiên đang chạy / crash chưa khởi động lại).
      if (fi !== files.length - 1)
        return fail(file, segments.length + 1, null, "malformedLine");
      warn("danglingTail", (prev?.seq ?? -1) + 1, file);
    }
  }

  for (const o of open.values()) warn("openInteraction", o.seq, o.file);
  return report;
}
