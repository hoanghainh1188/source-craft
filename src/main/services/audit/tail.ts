import type { AuditRecord, ChainHead } from "./audit-types";

// 236 — đọc đuôi nhật ký lúc khởi động (R6): đầu chuỗi, khoá máy đang hiệu lực, phiên trước có kết thúc sạch không,
// tương tác còn mở. Thuần. Không kiểm chữ ký (việc của trình kiểm tra — PR B).

export interface ParsedAuditText {
  records: AuditRecord[];
  /** Byte UTF-8 sau ký tự "\n" cuối cùng (dòng ghi dở khi crash). */
  danglingBytes: number;
}

export function parseAuditText(text: string): ParsedAuditText {
  if (text === "") return { records: [], danglingBytes: 0 };
  const lastNl = text.lastIndexOf("\n");
  const complete = lastNl === -1 ? "" : text.slice(0, lastNl);
  const dangling = text.slice(lastNl + 1);
  const records: AuditRecord[] = [];
  for (const line of complete.split("\n")) {
    if (!line) continue;
    try {
      const r = JSON.parse(line) as AuditRecord;
      if (
        r &&
        typeof r === "object" &&
        typeof r.seq === "number" &&
        typeof r.type === "string"
      ) {
        records.push(r);
      }
    } catch {
      /* dòng hỏng ở giữa: trình kiểm tra sẽ báo; đuôi chỉ cần bản ghi hợp lệ */
    }
  }
  return { records, danglingBytes: Buffer.byteLength(dangling, "utf8") };
}

export interface TailSummary {
  head: ChainHead | null;
  deviceKeyId: string | null;
  /** Tương tác có start, chưa có end, chưa được liệt kê ở sessionAborted — CHỈ trong phiên cuối. */
  openInteractions: string[];
  /** Bản ghi vòng đời cuối là audit.started (không có audit.stopped sau) ⇒ phiên trước kết thúc bất thường. */
  sessionOpen: boolean;
}

export function summarizeTail(records: AuditRecord[]): TailSummary {
  const last = records[records.length - 1];
  const head: ChainHead | null = last
    ? { seq: last.seq, hash: last.hash, tsMs: Date.parse(last.ts) }
    : null;

  let deviceKeyId: string | null = null;
  let sessionStart = -1;
  let sessionOpen = false;
  records.forEach((r, i) => {
    if (
      r.type === "audit.chainStarted" ||
      r.type === "audit.keyRotated" ||
      r.type === "audit.started"
    ) {
      deviceKeyId = r.deviceKeyId;
    }
    if (r.type === "audit.started") {
      sessionStart = i;
      sessionOpen = true;
    } else if (r.type === "audit.stopped") {
      sessionOpen = false;
    }
  });

  const open = new Set<string>();
  if (sessionStart >= 0) {
    for (const r of records.slice(sessionStart)) {
      if (r.type === "interaction.start") open.add(r.interactionId);
      else if (r.type === "interaction.end") open.delete(r.interactionId);
      else if (r.type === "audit.sessionAborted") {
        for (const id of r.openInteractions) open.delete(id);
      }
    }
  }
  return { head, deviceKeyId, openInteractions: [...open], sessionOpen };
}
