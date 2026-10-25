// 236 (PR B) — lỗi có mã thoát cho chế độ dòng lệnh của IT (contracts/audit-cli.md):
// 2 = lỗi sử dụng (tham số, tệp đích đã có) · 3 = lỗi I/O hoặc khoá. Không mang nội dung nhật ký.

export type AuditCliErrorReason =
  "exists" | "outsideDir" | "badKey" | "orgKeyMismatch" | "io";

export class AuditCliError extends Error {
  constructor(
    readonly exitCode: 2 | 3,
    readonly reason: AuditCliErrorReason,
    readonly detail?: string,
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "AuditCliError";
  }
}
