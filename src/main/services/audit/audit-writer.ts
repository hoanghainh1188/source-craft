import { join } from "node:path";
import { AUDIT_MAX_FILE_BYTES } from "./audit-constants";
import type {
  AuditFs,
  AuditRecord,
  AuditRecordBody,
  ChainHead,
} from "./audit-types";
import { sealRecord, serializeRecord } from "./record-chain";
import { fileNameFor, shouldRotate, sortAuditFiles } from "./rotation";
import { parseAuditText, summarizeTail, type TailSummary } from "./tail";

// 236 — ghi nhật ký kiểm toán (R6, R7). Đồng bộ: một tiến trình ghi (single-instance lock) + mỗi lần ghi trọn một dòng
// ⇒ lượt song song không xen lẫn (FR-017). Đầu chuỗi CHỈ tiến sau khi append + fsync thành công.
// Ghi lỗi giữa chừng (ghi dở / fsync ném) ⇒ trạng thái trong bộ nhớ không còn tin được ⇒ lần ghi kế tiếp ĐỌC LẠI đuôi từ đĩa,
// xuống dòng + audit.tailRepaired nếu có mảnh dở, rồi nối sau bản ghi hợp lệ cuối cùng thật sự nằm trên đĩa (review #236).

export interface AuditWriterOptions {
  fs: AuditFs;
  dir: string;
  clock: () => number;
  maxFileBytes?: number;
}

export interface OpenedTail extends TailSummary {
  danglingBytes: number;
}

export interface AuditWriter {
  /** Tạo thư mục, đọc đuôi từ đĩa. Ném khi không tạo/đọc được. */
  open(): OpenedTail;
  /** `build(seq)` nhận đúng seq sẽ niêm phong. Ném (kèm `code`) khi ghi lỗi. Mảnh dở ⇒ tự ghi audit.tailRepaired trước. */
  append(
    build: (seq: number) => AuditRecordBody,
    privateKeyPem: string,
  ): AuditRecord;
  head(): ChainHead | null;
}

const hasSessionStart = (records: AuditRecord[]): boolean =>
  records.some((r) => r.type === "audit.started");

export function createAuditWriter(opts: AuditWriterOptions): AuditWriter {
  const { fs, dir, clock } = opts;
  const maxBytes = opts.maxFileBytes ?? AUDIT_MAX_FILE_BYTES;
  let head: ChainHead | null = null;
  let current: string | null = null;
  let size = 0;
  let dangling = 0;
  let dirty = false;

  function readTail(): OpenedTail {
    fs.mkdirp(dir);
    const files = sortAuditFiles(fs.list(dir));
    const last = files[files.length - 1];
    const lastParsed = last
      ? parseAuditText(fs.readFile(join(dir, last)).toString("utf8"))
      : { records: [], danglingBytes: 0 };
    // Đọc lùi tới khi gặp audit.started (phiên cuối + khoá máy đang hiệu lực) — review #5: không giới hạn 2 tệp.
    let records = lastParsed.records;
    for (let i = files.length - 2; i >= 0 && !hasSessionStart(records); i--) {
      const older = parseAuditText(
        fs.readFile(join(dir, files[i]!)).toString("utf8"),
      ).records;
      records = [...older, ...records];
    }
    const summary = summarizeTail(records);
    head = summary.head;
    current = last ?? null;
    size = current ? fs.size(join(dir, current)) : 0;
    dangling = lastParsed.danglingBytes;
    dirty = false;
    return { ...summary, danglingBytes: dangling };
  }

  /** Một lần ghi đĩa; lỗi ⇒ đánh dấu cần đọc lại đuôi trước lần ghi kế tiếp. */
  function write(file: string, data: string): void {
    try {
      fs.appendDurable(join(dir, file), data);
    } catch (e) {
      dirty = true;
      throw e;
    }
  }

  function writeRecord(
    file: string,
    rec: AuditRecord,
    tsMs: number,
    prefix = "",
  ): void {
    const data = prefix + serializeRecord(rec);
    write(file, data);
    head = { seq: rec.seq, hash: rec.hash, tsMs };
    size += Buffer.byteLength(data, "utf8");
  }

  return {
    open: readTail,

    append(build, privateKeyPem) {
      if (dirty) readTail();
      const tsMs = clock();
      if (current === null) current = fileNameFor(head ? head.seq + 1 : 0);

      if (dangling > 0) {
        const repaired = sealRecord(
          head,
          { type: "audit.tailRepaired", danglingBytes: dangling },
          tsMs,
          privateKeyPem,
        );
        writeRecord(current, repaired, tsMs, "\n");
        dangling = 0;
      }

      let rec = sealRecord(
        head,
        build(head ? head.seq + 1 : 0),
        tsMs,
        privateKeyPem,
      );
      const bytes = Buffer.byteLength(serializeRecord(rec), "utf8");
      if (head && shouldRotate(size, bytes, maxBytes)) {
        const prevFile = current;
        const started = sealRecord(
          head,
          { type: "audit.fileStarted", prevFile },
          tsMs,
          privateKeyPem,
        );
        const nextFile = fileNameFor(started.seq);
        write(nextFile, serializeRecord(started));
        head = { seq: started.seq, hash: started.hash, tsMs };
        current = nextFile;
        size = Buffer.byteLength(serializeRecord(started), "utf8");
        rec = sealRecord(head, build(head.seq + 1), tsMs, privateKeyPem);
      }
      writeRecord(current, rec, tsMs);
      return rec;
    },

    head: () => head,
  };
}
