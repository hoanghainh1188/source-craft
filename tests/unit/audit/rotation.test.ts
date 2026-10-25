import { describe, expect, it } from "vitest";
import { AUDIT_MAX_FILE_BYTES } from "../../../src/main/services/audit/audit-constants";
import {
  fileNameFor,
  firstSeqOf,
  shouldRotate,
  sortAuditFiles,
} from "../../../src/main/services/audit/rotation";

// T011 (236) — tên tệp + xoay vòng (R7).

describe("rotation", () => {
  it("fileNameFor đệm 12 chữ số", () => {
    expect(fileNameFor(0)).toBe("audit-000000000000.jsonl");
    expect(fileNameFor(4812)).toBe("audit-000000004812.jsonl");
  });

  it("firstSeqOf đọc seq từ tên; tên lạ ⇒ null", () => {
    expect(firstSeqOf("audit-000000004812.jsonl")).toBe(4812);
    expect(firstSeqOf("main.log")).toBeNull();
    expect(firstSeqOf("audit-12.jsonl")).toBeNull();
  });

  it("shouldRotate chỉ khi tệp đã có dữ liệu và vượt ngưỡng", () => {
    expect(shouldRotate(0, AUDIT_MAX_FILE_BYTES + 10)).toBe(false);
    expect(shouldRotate(AUDIT_MAX_FILE_BYTES - 10, 5)).toBe(false);
    expect(shouldRotate(AUDIT_MAX_FILE_BYTES - 10, 11)).toBe(true);
    expect(shouldRotate(100, 50, 120)).toBe(true);
  });

  it("sortAuditFiles theo seq trong tên, bỏ tệp không khớp mẫu", () => {
    expect(
      sortAuditFiles([
        "audit-000000000100.jsonl",
        "notes.txt",
        "audit-000000000000.jsonl",
        "audit-000000000020.jsonl",
        ".DS_Store",
      ]),
    ).toEqual([
      "audit-000000000000.jsonl",
      "audit-000000000020.jsonl",
      "audit-000000000100.jsonl",
    ]);
  });
});
