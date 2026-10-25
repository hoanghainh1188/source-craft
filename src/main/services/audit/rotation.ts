import { AUDIT_FILE_PATTERN, AUDIT_MAX_FILE_BYTES } from "./audit-constants";

// 236 — tên tệp + xoay vòng (R7). Tên chứa seq đầu tệp ⇒ thứ tự xác định, không phụ thuộc mtime.

export function fileNameFor(seq: number): string {
  return `audit-${String(seq).padStart(12, "0")}.jsonl`;
}

export function firstSeqOf(name: string): number | null {
  const m = AUDIT_FILE_PATTERN.exec(name);
  return m ? Number(m[1]) : null;
}

/** Chỉ xoay khi tệp hiện hành đã có dữ liệu (bản ghi lớn hơn ngưỡng vẫn ghi được vào tệp rỗng). */
export function shouldRotate(
  currentBytes: number,
  nextBytes: number,
  maxBytes: number = AUDIT_MAX_FILE_BYTES,
): boolean {
  return currentBytes > 0 && currentBytes + nextBytes > maxBytes;
}

export function sortAuditFiles(names: string[]): string[] {
  return names
    .filter((n) => firstSeqOf(n) !== null)
    .sort((a, b) => (firstSeqOf(a) ?? 0) - (firstSeqOf(b) ?? 0));
}
