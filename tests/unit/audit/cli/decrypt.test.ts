import { describe, expect, it } from "vitest";
import { AuditCliError } from "../../../../src/main/services/audit/cli/cli-error";
import { decryptAuditDir } from "../../../../src/main/services/audit/cli/decrypt";
import { DIR, buildStandard } from "./fixtures";
import { orgKeyPair } from "../helpers";

// T057 (236) — giải mã câu hỏi bằng khoá bí mật của tổ chức (FR-010b). Không ghi gì vào thư mục nhật ký.

describe("decryptAuditDir", () => {
  it("mỗi interaction.start có question ⇒ dòng ra kèm questionText đúng; dòng khác giữ nguyên", () => {
    const f = buildStandard();
    const before = new Map(f.fs.files);
    const { report, lines } = decryptAuditDir(f.fs, DIR, f.org.privateKeyPem);
    expect(report.result).toBe("intact");
    const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(parsed).toHaveLength(report.records);
    const texts = parsed
      .filter((p) => p["type"] === "interaction.start")
      .map((p) => p["questionText"]);
    expect(texts).toEqual(f.questions);
    expect(
      parsed.find((p) => p["type"] === "audit.started"),
    ).not.toHaveProperty("questionText");
    expect(f.fs.files).toEqual(before); // không đụng tệp nhật ký
  });

  it("khoá tổ chức khác ⇒ AuditCliError mã 3 (orgKeyMismatch), không thử giải mã", () => {
    const f = buildStandard();
    try {
      decryptAuditDir(f.fs, DIR, orgKeyPair().privateKeyPem);
      throw new Error("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AuditCliError);
      expect(e).toMatchObject({ exitCode: 3, reason: "orgKeyMismatch" });
    }
  });

  it("khoá hỏng ⇒ AuditCliError mã 3 (badKey)", () => {
    const f = buildStandard();
    expect(() => decryptAuditDir(f.fs, DIR, "nope")).toThrow(
      expect.objectContaining({ exitCode: 3, reason: "badKey" }),
    );
  });

  it("nhật ký bị can thiệp ⇒ vẫn giải mã + dòng cảnh báo đầu tiên", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    ls[1] = ls[1]!.replace("Ngân hàng X", "Ngân hàng Y");
    f.setLines(file!, ls);
    const { report, lines } = decryptAuditDir(f.fs, DIR, f.org.privateKeyPem);
    expect(report.result).toBe("tampered");
    expect(JSON.parse(lines[0]!)).toMatchObject({
      warning: "tampered",
      firstFailure: { kind: "badHash" },
    });
    expect(lines.slice(1).some((l) => l.includes(f.questions[0]!))).toBe(true);
  });

  it("một bản ghi lệch orgKeyId ⇒ chỉ dòng đó questionError, phần còn lại vẫn giải mã (review bảo mật S2)", () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    const i = ls.findIndex((l) => l.includes('"interaction.start"'));
    const r = JSON.parse(ls[i]!);
    r.question.orgKeyId = "0".repeat(32);
    ls[i] = JSON.stringify(r);
    f.setLines(file!, ls);
    const { lines, decrypted } = decryptAuditDir(
      f.fs,
      DIR,
      f.org.privateKeyPem,
    );
    expect(decrypted).toBe(f.questions.length - 1);
    expect(
      lines.some((l) => l.includes('"questionError":"orgKeyMismatch"')),
    ).toBe(true);
  });
});
