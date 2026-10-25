import { createPublicKey } from "node:crypto";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import type { AuditCliCommand, CliLang } from "./cli-args";
import { AuditCliError } from "./cli-error";
import { decryptAuditDir } from "./decrypt";
import { generateOrgKeyPair, writeOrgKeyFiles, type KeyFs } from "./keygen";
import { cliText, formatVerifyReport, helpText } from "./report-text";
import { verifyAuditDir, type AuditReadFs, type VerifyOptions } from "./verify";
import { keyIdOf } from "../record-chain";

// 236 (PR B) — điều phối chế độ dòng lệnh cho IT (C4, FR-020b). Mã thoát: 0 nguyên vẹn/thành công · 1 bị can thiệp ·
// 2 lỗi sử dụng · 3 lỗi I/O hoặc khoá. KHÔNG có lệnh nào ghi/sửa/xoá thư mục nhật ký. Câu hỏi đã giải mã CHỈ ra tệp --out;
// khoá bí mật của tổ chức chỉ đọc vào bộ nhớ.

export interface CliFs extends AuditReadFs, KeyFs {
  /** Đường dẫn thật (giải symlink); không tồn tại ⇒ trả nguyên. */
  realpath?(path: string): string;
}

export interface RunCliDeps {
  fs: CliFs;
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  defaultLang: CliLang;
  /** Mặc định process.platform (tiêm để test). */
  platform?: NodeJS.Platform;
}

const KEY_ID = /^[0-9a-f]{32}$/;

/** Tệp đích: không ghi đè (2), và không bao giờ nằm trong thư mục nhật ký (FR-020b). So sánh theo đường dẫn thật và không phân
 * biệt hoa thường trên Windows / macOS (review: lách bằng symlink, junction hoặc chữ hoa). */
function assertOutPath(fs: CliFs, out: string, auditDir: string): void {
  const real = (p: string) => (fs.realpath ? fs.realpath(p) : p);
  const fold = (p: string) =>
    process.platform === "win32" || process.platform === "darwin"
      ? p.toLowerCase()
      : p;
  const dir = fold(real(resolve(auditDir)));
  const target = fold(join(real(dirname(resolve(out))), basename(out)));
  const rel = relative(dir, target);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    throw new AuditCliError(2, "outsideDir");
  }
  if (fs.exists(out)) throw new AuditCliError(2, "exists", out);
}

function readText(fs: CliFs, path: string): string {
  try {
    return fs.readFile(path).toString("utf8");
  } catch (e) {
    throw new AuditCliError(
      3,
      "io",
      (e as NodeJS.ErrnoException).code ?? "read",
    );
  }
}

/** `--expect-device-key a,b,…`: mỗi phần là deviceKeyId (32 hex, không phân biệt hoa thường) hoặc đường dẫn tệp PEM. */
function expectOptions(fs: CliFs, arg: string | undefined): VerifyOptions {
  if (!arg) return {};
  const ids: string[] = [];
  let pem: string | undefined;
  for (const part of arg
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    if (KEY_ID.test(part.toLowerCase())) {
      ids.push(part.toLowerCase());
      continue;
    }
    const text = readText(fs, part);
    try {
      const k = createPublicKey(text);
      if (k.asymmetricKeyType !== "ed25519") throw new Error("not ed25519");
      const normalized = k.export({ type: "spki", format: "pem" }) as string;
      if (pem === undefined) pem = normalized;
      else ids.push(keyIdOf(normalized));
    } catch {
      throw new AuditCliError(3, "badKey");
    }
  }
  return {
    ...(ids.length > 0 ? { expectDeviceKeyIds: ids } : {}),
    ...(pem ? { expectDevicePublicKeyPem: pem } : {}),
  };
}

async function run(
  cmd: AuditCliCommand,
  deps: RunCliDeps,
  lang: CliLang,
): Promise<number> {
  const { fs, stdout, stderr } = deps;
  const t = cliText(lang);
  switch (cmd.cmd) {
    case "help":
      stdout(helpText(lang));
      return 0;
    case "usageError":
      stderr(`${t.usage(cmd.code, cmd.detail)}\n${helpText(lang)}`);
      return 2;
    case "verify": {
      if (cmd.out) assertOutPath(fs, cmd.out, cmd.dir);
      const opts = expectOptions(fs, cmd.expectDeviceKey);
      const report = verifyAuditDir(fs, cmd.dir, opts);
      const text = cmd.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : formatVerifyReport(report, cmd.dir, lang);
      if (cmd.out) fs.writeFile(cmd.out, text, 0o600);
      stdout(
        cmd.json && cmd.out ? formatVerifyReport(report, cmd.dir, lang) : text,
      );
      return report.result === "intact" ? 0 : 1;
    }
    case "decrypt": {
      assertOutPath(fs, cmd.out, cmd.dir);
      const key = readText(fs, cmd.orgKey);
      const { report, lines, decrypted } = decryptAuditDir(fs, cmd.dir, key);
      fs.writeFile(cmd.out, lines.map((l) => `${l}\n`).join(""), 0o600);
      stdout(formatVerifyReport(report, cmd.dir, lang));
      stdout(`${t.decrypted(decrypted, cmd.out)}\n`);
      if ((deps.platform ?? process.platform) === "win32")
        stdout(`${t.windowsAcl()}\n`);
      return report.result === "intact" ? 0 : 1;
    }
    case "keygen": {
      const pair = generateOrgKeyPair();
      const paths = writeOrgKeyFiles(fs, cmd.outDir, pair);
      stdout(
        `${t.keygen(pair.orgKeyId)}\n${pair.policySnippet}\n${t.keygenFiles(paths.publicPath, paths.privatePath)}\n`,
      );
      if ((deps.platform ?? process.platform) === "win32")
        stdout(`${t.windowsAcl()}\n`);
      return 0;
    }
  }
}

export async function runAuditCli(
  cmd: AuditCliCommand,
  deps: RunCliDeps,
): Promise<number> {
  const lang = cmd.lang ?? deps.defaultLang;
  try {
    return await run(cmd, deps, lang);
  } catch (e) {
    if (e instanceof AuditCliError) {
      deps.stderr(`${cliText(lang).reason(e.reason, e.detail)}\n`);
      return e.exitCode;
    }
    deps.stderr(
      `${cliText(lang).reason("io", (e as NodeJS.ErrnoException).code ?? "io")}\n`,
    );
    return 3;
  }
}
