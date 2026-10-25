import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  runAuditCli,
  type CliFs,
} from "../../../../src/main/services/audit/cli/run-cli";
import { keyIdOf } from "../../../../src/main/services/audit/record-chain";
import { DIR, buildStandard, type Fixture } from "./fixtures";

// T060 (236) — điều phối lệnh + mã thoát 0/1/2/3 (contracts/audit-cli.md). Khoá bí mật chỉ đọc, không ghi lại.

function cli(f: Fixture, extra: Record<string, string> = {}) {
  const written = new Map<string, { data: string; mode?: number }>();
  const out: string[] = [];
  const err: string[] = [];
  const fs: CliFs = {
    list: (d) => f.fs.list(d),
    readFile: (p) =>
      p in extra ? Buffer.from(extra[p]!, "utf8") : f.fs.readFile(p),
    exists: (p) => written.has(p) || p in extra || f.fs.files.has(p),
    mkdirp: () => {},
    writeFile: (p, data, mode) => {
      written.set(p, { data, ...(mode !== undefined ? { mode } : {}) });
    },
  };
  return {
    written,
    out,
    err,
    run: (cmd: Parameters<typeof runAuditCli>[0]) =>
      runAuditCli(cmd, {
        fs,
        stdout: (s) => out.push(s),
        stderr: (s) => err.push(s),
        defaultLang: "vi",
      }),
  };
}

describe("runAuditCli", () => {
  it("verify nguyên vẹn ⇒ 0, in báo cáo chữ; --json in AuditVerifyReport; --out ghi tệp", async () => {
    const f = buildStandard();
    const c = cli(f);
    expect(await c.run({ cmd: "verify", dir: DIR, json: false })).toBe(0);
    expect(c.out.join("")).toContain("NGUYÊN VẸN");
    const j = cli(f);
    expect(
      await j.run({ cmd: "verify", dir: DIR, json: true, out: "/r.json" }),
    ).toBe(0);
    expect(JSON.parse(j.written.get("/r.json")!.data)).toMatchObject({
      result: "intact",
    });
  });

  it("verify bị can thiệp ⇒ 1", async () => {
    const f = buildStandard();
    const [file] = f.files();
    const ls = f.lines(file!);
    ls[2] = ls[2]!.replace("nguyen.an", "x");
    f.setLines(file!, ls);
    expect(await cli(f).run({ cmd: "verify", dir: DIR, json: false })).toBe(1);
  });

  it("--expect-device-key nhận keyId hoặc tệp PEM", async () => {
    const f = buildStandard();
    const id = keyIdOf(f.device.publicKeyPem);
    expect(
      await cli(f).run({
        cmd: "verify",
        dir: DIR,
        json: false,
        expectDeviceKey: id,
      }),
    ).toBe(0);
    const c = cli(f, { "/dev.pem": f.device.publicKeyPem });
    expect(
      await c.run({
        cmd: "verify",
        dir: DIR,
        json: false,
        expectDeviceKey: "/dev.pem",
      }),
    ).toBe(0);
    expect(
      await cli(f).run({
        cmd: "verify",
        dir: DIR,
        json: false,
        expectDeviceKey: "e".repeat(32),
      }),
    ).toBe(1);
  });

  it("decrypt ⇒ 0, questionText CHỈ ra tệp --out, không ra stdout; khoá bí mật không bị ghi lại", async () => {
    const f = buildStandard();
    const c = cli(f, { "/org.pem": f.org.privateKeyPem });
    expect(
      await c.run({
        cmd: "decrypt",
        dir: DIR,
        orgKey: "/org.pem",
        out: "/dec.jsonl",
      }),
    ).toBe(0);
    expect(c.written.get("/dec.jsonl")!.data).toContain(f.questions[0]!);
    expect(c.out.join("") + c.err.join("")).not.toContain(f.questions[0]!);
    expect(
      [...c.written.values()].some((w) => w.data.includes("PRIVATE KEY")),
    ).toBe(false);
    expect(c.written.get("/dec.jsonl")!.mode).toBe(0o600);
  });

  it("decrypt: tệp --out đã có ⇒ 2; khoá sai ⇒ 3", async () => {
    const f = buildStandard();
    const c = cli(f, { "/org.pem": f.org.privateKeyPem, "/exists.jsonl": "x" });
    expect(
      await c.run({
        cmd: "decrypt",
        dir: DIR,
        orgKey: "/org.pem",
        out: "/exists.jsonl",
      }),
    ).toBe(2);
    const bad = cli(f, { "/bad.pem": "nope" });
    expect(
      await bad.run({
        cmd: "decrypt",
        dir: DIR,
        orgKey: "/bad.pem",
        out: "/o.jsonl",
      }),
    ).toBe(3);
  });

  it("keygen ⇒ 0, in đoạn auditPublicKey + orgKeyId; đã có ⇒ 2", async () => {
    const f = buildStandard();
    const c = cli(f);
    expect(await c.run({ cmd: "keygen", outDir: "/k" })).toBe(0);
    expect(c.out.join("")).toContain('"auditPublicKey"');
    expect(
      c.written.get(join("/k", "sourcecraft-audit-org-private.pem"))?.mode,
    ).toBe(0o600);
    expect(c.out.join("")).not.toContain("PRIVATE KEY");
    expect(await c.run({ cmd: "keygen", outDir: "/k" })).toBe(2);
  });

  it("usageError ⇒ 2 + hướng dẫn ra stderr; help ⇒ 0", async () => {
    const f = buildStandard();
    const c = cli(f);
    expect(
      await c.run({ cmd: "usageError", code: "decryptNeedsKeyAndOut" }),
    ).toBe(2);
    expect(c.err.join("")).toContain("--audit-verify");
    expect(await c.run({ cmd: "help" })).toBe(0);
  });

  it("thư mục không đọc được ⇒ 3", async () => {
    const fsErr: CliFs = {
      list: () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      },
      readFile: () => Buffer.alloc(0),
      exists: () => false,
      mkdirp: () => {},
      writeFile: () => {},
    };
    expect(
      await runAuditCli(
        { cmd: "verify", dir: DIR, json: false },
        { fs: fsErr, stdout: () => {}, stderr: () => {}, defaultLang: "en" },
      ),
    ).toBe(3);
  });

  it("tệp đích nằm trong thư mục nhật ký hoặc đã có ⇒ 2 (CLI không ghi vào nhật ký, không ghi đè)", async () => {
    const f = buildStandard();
    const c = cli(f, { "/org.pem": f.org.privateKeyPem, "/old.json": "x" });
    expect(
      await c.run({
        cmd: "verify",
        dir: DIR,
        json: true,
        out: `${DIR}/r.json`,
      }),
    ).toBe(2);
    expect(
      await c.run({
        cmd: "decrypt",
        dir: DIR,
        orgKey: "/org.pem",
        out: `${DIR}/d.jsonl`,
      }),
    ).toBe(2);
    expect(
      await c.run({ cmd: "verify", dir: DIR, json: true, out: "/old.json" }),
    ).toBe(2);
    expect(c.written.size).toBe(0);
  });

  it("thông báo lỗi bằng tiếng Việt khi --lang vi (review S3)", async () => {
    const f = buildStandard();
    const c = cli(f);
    expect(
      await c.run({ cmd: "usageError", code: "keygenNeedsOutDir", lang: "vi" }),
    ).toBe(2);
    expect(c.err.join("")).toContain("--audit-keygen cần --out-dir");
  });

  it("đường dẫn đích đi qua symlink / khác hoa thường vào thư mục nhật ký ⇒ 2 (realpath)", async () => {
    const f = buildStandard();
    const fs: CliFs = {
      list: (d) => f.fs.list(d),
      readFile: (p) => f.fs.readFile(p),
      exists: () => false,
      mkdirp: () => {},
      writeFile: () => {
        throw new Error("must not write");
      },
      realpath: (p) => (p === "/link" ? DIR : p),
    };
    expect(
      await runAuditCli(
        { cmd: "verify", dir: DIR, json: true, out: "/link/r.json" },
        { fs, stdout: () => {}, stderr: () => {}, defaultLang: "en" },
      ),
    ).toBe(2);
  });

  it("Windows: in lưu ý ACL sau keygen", async () => {
    const out: string[] = [];
    const fs: CliFs = {
      list: () => [],
      readFile: () => Buffer.alloc(0),
      exists: () => false,
      mkdirp: () => {},
      writeFile: () => {},
    };
    expect(
      await runAuditCli(
        { cmd: "keygen", outDir: "C:\\k" },
        {
          fs,
          stdout: (s) => out.push(s),
          stderr: () => {},
          defaultLang: "en",
          platform: "win32",
        },
      ),
    ).toBe(0);
    expect(out.join("")).toContain("ACL");
  });
});
