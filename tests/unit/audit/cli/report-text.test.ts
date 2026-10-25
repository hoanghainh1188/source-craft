import { describe, expect, it } from "vitest";
import {
  formatVerifyReport,
  helpText,
} from "../../../../src/main/services/audit/cli/report-text";
import type { AuditVerifyReport } from "../../../../src/main/services/audit/cli/verify";

// T059 (236) — báo cáo chữ vi/en (contracts/audit-cli.md). Không in nội dung câu hỏi.

const intact: AuditVerifyReport = {
  result: "intact",
  files: ["audit-000000000000.jsonl", "audit-000000004812.jsonl"],
  records: 9214,
  firstSeq: 0,
  lastSeq: 9213,
  firstTs: "2026-10-25T02:10:11.512Z",
  lastTs: "2026-11-02T09:44:03.000Z",
  deviceKeyIds: ["9f2c0000000000000000000000000000"],
  warnings: [
    { kind: "openInteraction", seq: 7731, file: "audit-000000004812.jsonl" },
    { kind: "keyRotated", seq: 5120, file: "audit-000000004812.jsonl" },
  ],
};

describe("formatVerifyReport", () => {
  it("vi: NGUYÊN VẸN + số cảnh báo + từng cảnh báo theo seq", () => {
    const t = formatVerifyReport(intact, "/a", "vi");
    expect(t).toContain("NGUYÊN VẸN");
    expect(t).toContain("2 cảnh báo");
    expect(t).toContain("9 214");
    expect(t).toContain("seq 7731");
    expect(t).toContain("seq 5120");
  });

  it("en: INTACT", () => {
    expect(formatVerifyReport(intact, "/a", "en")).toContain("INTACT");
  });

  it("tampered: chỉ ra tệp, dòng, seq và loại lỗi", () => {
    const t = formatVerifyReport(
      {
        ...intact,
        result: "tampered",
        warnings: [],
        firstFailure: {
          file: "audit-000000000000.jsonl",
          line: 6,
          seq: 5,
          kind: "badHash",
        },
      },
      "/a",
      "vi",
    );
    expect(t).toContain("BỊ CAN THIỆP");
    expect(t).toMatch(/audit-000000000000\.jsonl.*dòng 6.*seq 5/);
    expect(
      formatVerifyReport(
        {
          ...intact,
          result: "tampered",
          warnings: [],
          firstFailure: { file: "f", line: 1, seq: null, kind: "missingFile" },
        },
        "/a",
        "en",
      ),
    ).toContain("TAMPERED");
  });
});

describe("helpText", () => {
  it("liệt kê 3 lệnh ở cả vi và en", () => {
    for (const lang of ["vi", "en"] as const) {
      const h = helpText(lang);
      expect(h).toContain("--audit-verify");
      expect(h).toContain("--audit-decrypt");
      expect(h).toContain("--audit-keygen");
    }
  });
});
