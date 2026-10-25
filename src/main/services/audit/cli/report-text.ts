import { createTranslator } from "@shared/i18n";
import type { CliLang, UsageCode } from "./cli-args";
import type { AuditCliErrorReason } from "./cli-error";
import type { AuditVerifyReport } from "./verify";

// 236 (PR B) — chữ của chế độ dòng lệnh, lấy từ domain i18n "audit.cli" (vi/en). KHÔNG in nội dung câu hỏi.

export interface CliText {
  decrypted(count: number, out: string): string;
  keygen(orgKeyId: string): string;
  keygenFiles(publicPath: string, privatePath: string): string;
  error(reason: string): string;
  usage(code: UsageCode, detail?: string): string;
  reason(reason: AuditCliErrorReason, detail?: string): string;
  windowsAcl(): string;
}

export function cliText(lang: CliLang): CliText {
  const tr = createTranslator(lang);
  // Khoá động (mã lỗi): không phải khoá nào cũng có {detail} ⇒ gọi lỏng kiểu; tham số thừa bị bỏ qua khi nội suy.
  const loose = tr.t as unknown as (
    key: string,
    params?: Record<string, string>,
  ) => string;
  return {
    decrypted: (count, out) => tr.t("audit.cli.decrypted", { n: count, out }),
    keygen: (id) => tr.t("audit.cli.keygen", { id }),
    keygenFiles: (pub, priv) =>
      `${tr.t("audit.cli.keygenPublic", { path: pub })}\n${tr.t("audit.cli.keygenPrivate", { path: priv })}`,
    error: (reason) => tr.t("audit.cli.error", { reason }),
    usage: (code, detail) =>
      tr.t("audit.cli.error", {
        reason: loose(`audit.cli.usage.${code}`, { detail: detail ?? "" }),
      }),
    reason: (r, detail) =>
      tr.t("audit.cli.error", {
        reason: loose(`audit.cli.reason.${r}`, { detail: detail ?? "" }),
      }),
    windowsAcl: () => tr.t("audit.cli.windowsAcl"),
  };
}

/** Số có ngăn cách hàng nghìn: vi "9 214", en "9,214". */
const num = (n: number, lang: CliLang) =>
  lang === "vi"
    ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
    : n.toLocaleString("en-US");

export function formatVerifyReport(
  r: AuditVerifyReport,
  dir: string,
  lang: CliLang,
): string {
  const tr = createTranslator(lang);
  const lines = [
    tr.t("audit.cli.title"),
    tr.t("audit.cli.dir", {
      dir,
      files: r.files.length,
      records: num(r.records, lang),
      first: String(r.firstSeq ?? "-"),
      last: String(r.lastSeq ?? "-"),
    }),
    tr.t("audit.cli.range", { from: r.firstTs ?? "-", to: r.lastTs ?? "-" }),
    tr.t("audit.cli.keys", { ids: r.deviceKeyIds.join(", ") || "-" }),
  ];
  if (r.result === "tampered" && r.firstFailure) {
    const f = r.firstFailure;
    lines.push(
      tr.t("audit.cli.tampered", {
        reason: tr.t(`audit.cli.failure.${f.kind}`),
      }),
      tr.t("audit.cli.at", {
        file: f.file || dir,
        line: f.line,
        seq: f.seq === null ? "-" : String(f.seq),
      }),
    );
  } else {
    lines.push(
      r.warnings.length === 0
        ? tr.t("audit.cli.intact")
        : tr.t("audit.cli.intactWarnings", { n: r.warnings.length }),
    );
  }
  // Theo seq tăng dần (openInteraction được thêm cuối cùng khi quét).
  for (const w of [...r.warnings].sort((a, b) => a.seq - b.seq)) {
    const text = tr.t(`audit.cli.warning.${w.kind}`);
    lines.push(
      w.detail
        ? tr.t("audit.cli.warningDetail", {
            seq: w.seq,
            text,
            detail: w.detail,
          })
        : tr.t("audit.cli.warningLine", { seq: w.seq, text }),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function helpText(lang: CliLang): string {
  const tr = createTranslator(lang);
  return `${(["title", "verify", "decrypt", "keygen", "lang", "exit"] as const)
    .map((k) => tr.t(`audit.cli.help.${k}`))
    .join("\n")}\n`;
}
