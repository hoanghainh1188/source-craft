import { describe, expect, it } from "vitest";
import { parseAuditCliArgs } from "../../../../src/main/services/audit/cli/cli-args";

// T054 (236) — tham số dòng lệnh cho IT (contracts/audit-cli.md). Không có cờ audit ⇒ null (app chạy bình thường).

const exe = ["/Applications/SourceCraft.app/Contents/MacOS/SourceCraft"];
const dev = [
  "/x/Electron",
  "-r",
  "/x/loader.js",
  "--inspect=0",
  "/x/out/main/index.js",
  "--user-data-dir=/tmp/u",
];

describe("parseAuditCliArgs", () => {
  it("không có cờ --audit-* ⇒ null (kể cả argv của Electron/Playwright)", () => {
    expect(parseAuditCliArgs(exe)).toBeNull();
    expect(parseAuditCliArgs(dev)).toBeNull();
    expect(parseAuditCliArgs([...exe, "--remote-debugging-port=0"])).toBeNull();
  });

  it("--audit-verify <dir> với tuỳ chọn (cả dạng --k v và --k=v)", () => {
    expect(parseAuditCliArgs([...exe, "--audit-verify", "/a"])).toEqual({
      cmd: "verify",
      dir: "/a",
      json: false,
    });
    expect(
      parseAuditCliArgs([
        ...dev,
        "--audit-verify=/a",
        "--expect-device-key",
        "/k.pem",
        "--json",
        "--out=/r.json",
        "--lang",
        "en",
      ]),
    ).toEqual({
      cmd: "verify",
      dir: "/a",
      expectDeviceKey: "/k.pem",
      json: true,
      out: "/r.json",
      lang: "en",
    });
  });

  it("--audit-decrypt cần --org-key và --out", () => {
    expect(
      parseAuditCliArgs([
        ...exe,
        "--audit-decrypt",
        "/a",
        "--org-key",
        "/p.pem",
        "--out",
        "/o.jsonl",
      ]),
    ).toEqual({
      cmd: "decrypt",
      dir: "/a",
      orgKey: "/p.pem",
      out: "/o.jsonl",
    });
    expect(
      parseAuditCliArgs([
        ...exe,
        "--audit-decrypt",
        "/a",
        "--org-key",
        "/p.pem",
      ]),
    ).toMatchObject({
      cmd: "usageError",
    });
    expect(
      parseAuditCliArgs([...exe, "--audit-decrypt", "/a", "--out", "/o"]),
    ).toMatchObject({ cmd: "usageError" });
  });

  it("--audit-keygen --out-dir; --help-audit", () => {
    expect(
      parseAuditCliArgs([...exe, "--audit-keygen", "--out-dir", "/k"]),
    ).toEqual({ cmd: "keygen", outDir: "/k" });
    expect(parseAuditCliArgs([...exe, "--audit-keygen"])).toMatchObject({
      cmd: "usageError",
    });
    expect(parseAuditCliArgs([...exe, "--help-audit", "--lang=vi"])).toEqual({
      cmd: "help",
      lang: "vi",
    });
  });

  it.each([
    [["--audit-verify"]],
    [["--audit-verify", "/a", "--audit-keygen", "--out-dir", "/k"]],
    [["--audit-verify", "/a", "--lang", "fr"]],
    [["--audit-verify", "/a", "--bogus"]],
  ])("lỗi sử dụng %j", (args) => {
    expect(parseAuditCliArgs([...exe, ...args])).toMatchObject({
      cmd: "usageError",
    });
  });

  it("tuỳ chọn đứng TRƯỚC lệnh vẫn được nhận (review S4); cờ lạ trước lệnh (Electron) bị bỏ qua", () => {
    expect(
      parseAuditCliArgs([
        ...dev,
        "--lang",
        "en",
        "--json",
        "--audit-verify",
        "/a",
      ]),
    ).toEqual({
      cmd: "verify",
      dir: "/a",
      json: true,
      lang: "en",
    });
  });

  it("lỗi sử dụng mang MÃ (dịch lúc in), giữ --lang", () => {
    expect(
      parseAuditCliArgs([...exe, "--lang", "vi", "--audit-decrypt", "/a"]),
    ).toEqual({
      cmd: "usageError",
      code: "decryptNeedsKeyAndOut",
      lang: "vi",
    });
  });
});
