// 236 (PR B) — tham số dòng lệnh cho IT (contracts/audit-cli.md). Thuần. Không có cờ --audit-* / --help-audit ⇒ null:
// app khởi động bình thường. Cờ đã biết được nhận ở MỌI vị trí (review S4: `--lang en --audit-verify d`); cờ lạ đứng TRƯỚC lệnh
// là của Electron / Playwright (bỏ qua), cờ lạ đứng SAU lệnh là lỗi sử dụng. Lỗi trả MÃ — dịch vi/en lúc in (review S3).

export type CliLang = "vi" | "en";

export type UsageCode =
  | "unexpectedArgument"
  | "duplicateOption"
  | "missingValue"
  | "unknownOption"
  | "badLang"
  | "oneCommand"
  | "optionNotValid"
  | "decryptNeedsKeyAndOut"
  | "keygenNeedsOutDir";

export type AuditCliCommand =
  | {
      cmd: "verify";
      dir: string;
      expectDeviceKey?: string;
      json: boolean;
      out?: string;
      lang?: CliLang;
    }
  | { cmd: "decrypt"; dir: string; orgKey: string; out: string; lang?: CliLang }
  | { cmd: "keygen"; outDir: string; lang?: CliLang }
  | { cmd: "help"; lang?: CliLang }
  | { cmd: "usageError"; code: UsageCode; detail?: string; lang?: CliLang };

const COMMANDS = [
  "--audit-verify",
  "--audit-decrypt",
  "--audit-keygen",
  "--help-audit",
] as const;
/** Cờ có giá trị đi kèm (cờ lệnh verify/decrypt cũng nhận giá trị: thư mục). */
const VALUE_FLAGS = new Set([
  "--audit-verify",
  "--audit-decrypt",
  "--expect-device-key",
  "--out",
  "--org-key",
  "--out-dir",
  "--lang",
]);
const BOOL_FLAGS = new Set(["--json", "--audit-keygen", "--help-audit"]);
const isKnown = (name: string) => VALUE_FLAGS.has(name) || BOOL_FLAGS.has(name);

const nameOf = (raw: string) => {
  const eq = raw.indexOf("=");
  return eq === -1 ? raw : raw.slice(0, eq);
};

export function parseAuditCliArgs(
  argv: readonly string[],
): AuditCliCommand | null {
  const start = argv.findIndex((a) =>
    (COMMANDS as readonly string[]).includes(nameOf(a)),
  );
  if (start === -1) return null;

  const opts = new Map<string, string | true>();
  let error: { code: UsageCode; detail?: string } | null = null;
  for (let i = 0; i < argv.length && !error; i++) {
    const raw = argv[i]!;
    if (!raw.startsWith("--")) {
      if (i > start) error = { code: "unexpectedArgument", detail: raw };
      continue;
    }
    const eq = raw.indexOf("=");
    const name = nameOf(raw);
    if (!isKnown(name)) {
      if (i > start) error = { code: "unknownOption", detail: name };
      continue;
    }
    if (opts.has(name)) {
      error = { code: "duplicateOption", detail: name };
    } else if (BOOL_FLAGS.has(name)) {
      opts.set(name, true);
    } else {
      const value = eq === -1 ? argv[++i] : raw.slice(eq + 1);
      if (value === undefined || value === "" || value.startsWith("--")) {
        error = { code: "missingValue", detail: name };
      } else {
        opts.set(name, value);
      }
    }
  }

  const langRaw = opts.get("--lang");
  const lang = langRaw === "vi" || langRaw === "en" ? langRaw : undefined;
  const usage = (code: UsageCode, detail?: string): AuditCliCommand => ({
    cmd: "usageError",
    code,
    ...(detail ? { detail } : {}),
    ...(lang ? { lang } : {}),
  });
  const withLang = <T extends object>(o: T) => (lang ? { ...o, lang } : o);
  if (error) return usage(error.code, error.detail);
  if (langRaw !== undefined && !lang) return usage("badLang", String(langRaw));

  const commands = COMMANDS.filter((c) => opts.has(c));
  if (commands.length !== 1) return usage("oneCommand");
  const str = (k: string) => {
    const v = opts.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const extraBeyond = (keys: string[]) =>
    [...opts.keys()].filter((k) => !keys.includes(k) && k !== "--lang");

  switch (commands[0]) {
    case "--help-audit":
      return withLang({ cmd: "help" as const });
    case "--audit-verify": {
      const extra = extraBeyond([
        "--audit-verify",
        "--expect-device-key",
        "--json",
        "--out",
      ]);
      if (extra.length) return usage("optionNotValid", extra.join(", "));
      const expect = str("--expect-device-key");
      const out = str("--out");
      return withLang({
        cmd: "verify" as const,
        dir: str("--audit-verify")!,
        ...(expect ? { expectDeviceKey: expect } : {}),
        json: opts.has("--json"),
        ...(out ? { out } : {}),
      });
    }
    case "--audit-decrypt": {
      const extra = extraBeyond(["--audit-decrypt", "--org-key", "--out"]);
      if (extra.length) return usage("optionNotValid", extra.join(", "));
      const orgKey = str("--org-key");
      const out = str("--out");
      if (!orgKey || !out) return usage("decryptNeedsKeyAndOut");
      return withLang({
        cmd: "decrypt" as const,
        dir: str("--audit-decrypt")!,
        orgKey,
        out,
      });
    }
    default: {
      const extra = extraBeyond(["--audit-keygen", "--out-dir"]);
      if (extra.length) return usage("optionNotValid", extra.join(", "));
      const outDir = str("--out-dir");
      if (!outDir) return usage("keygenNeedsOutDir");
      return withLang({ cmd: "keygen" as const, outDir });
    }
  }
}
