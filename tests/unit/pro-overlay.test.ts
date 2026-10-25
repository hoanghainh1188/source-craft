import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PRO_MARKER,
  applyOverlay,
  checkStub,
  missingDeps,
  parseDeps,
  runCli,
  // @ts-expect-error — script .mjs (không có khai báo kiểu), import thẳng như issue-license-cli.test.ts
} from "../../scripts/pro-overlay.mjs";

// 248 — chép đè bản Pro (repo source-craft-pro) lên stub src/main/pro/ lúc build release + kiểm stub ở CI public.

const PRO_HEADER = `// SPDX-License-Identifier: ${PRO_MARKER}\n`;

let root: string;

function write(rel: string, text: string): void {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

function makePro(): string {
  write(
    "pro/src/index.ts",
    `${PRO_HEADER}export const available = () => true;\n`,
  );
  write("pro/tests/index.test.ts", `${PRO_HEADER}// test\n`);
  write("pro/api-types.test.ts", "// ghim kiểu\n");
  write("pro/deps.json", "[]\n");
  write("pro/README.md", "# Pro\n");
  write("pro/scripts/check-stub.mjs", `${PRO_HEADER}`);
  write("pro/.git/config", "secret\n");
  write("pro/.github/workflows/ci.yml", "on: push\n");
  return join(root, "pro");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sc-pro-overlay-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("checkStub", () => {
  it("stub sạch ⇒ không có tệp vi phạm", () => {
    write("stub/index.ts", "// SPDX-License-Identifier: MIT\n");
    write("stub/deps.json", "[]");
    expect(checkStub(join(root, "stub"))).toEqual([]);
  });

  it("có dấu bản Pro ⇒ liệt kê tệp (đường dẫn tương đối)", () => {
    write("stub/index.ts", "// SPDX-License-Identifier: MIT\n");
    write("stub/deep/x.ts", PRO_HEADER);
    expect(checkStub(join(root, "stub"))).toEqual(["deep/x.ts"]);
  });
});

describe("parseDeps / missingDeps", () => {
  it("chỉ nhận mảng tên gói", () => {
    expect(parseDeps('["docx", "pdf-lib"]')).toEqual(["docx", "pdf-lib"]);
    expect(() => parseDeps('{"a":1}')).toThrow(/deps\.json/);
    expect(() => parseDeps("[1]")).toThrow(/deps\.json/);
    expect(() => parseDeps('[""]')).toThrow(/deps\.json/);
  });

  it("phụ thuộc Pro phải khai ở dependencies của package.json public", () => {
    const pkg = {
      dependencies: { docx: "^9" },
      devDependencies: { vite: "7" },
    };
    expect(missingDeps(["docx"], pkg)).toEqual([]);
    expect(missingDeps(["docx", "vite", "pdf-lib"], pkg)).toEqual([
      "vite",
      "pdf-lib",
    ]);
    expect(missingDeps(["x"], {})).toEqual(["x"]);
  });
});

describe("applyOverlay", () => {
  it("thay toàn bộ stub bằng src/ + tests/ + 2 tệp ghim, bỏ .git/.github/README/scripts", () => {
    const pro = makePro();
    write("target/index.ts", "// stub\n");
    write("target/stub.test.ts", "// chỉ có ở stub\n");
    const target = join(root, "target");

    const copied = applyOverlay(pro, target, { dependencies: {} });

    expect(copied.sort()).toEqual([
      "api-types.test.ts",
      "deps.json",
      "index.ts",
      "tests/index.test.ts",
    ]);
    expect(readFileSync(join(target, "index.ts"), "utf8")).toContain(
      PRO_MARKER,
    );
    expect(existsSync(join(target, "stub.test.ts"))).toBe(false);
    expect(existsSync(join(target, ".git"))).toBe(false);
    expect(existsSync(join(target, "README.md"))).toBe(false);
    expect(existsSync(join(target, ".github"))).toBe(false);
    // Chỉ đọc bản checkout Pro (an toàn với bản clone local của lập trình viên).
    expect(existsSync(join(pro, ".git/config"))).toBe(true);
  });

  it("tệp Pro thiếu dấu bản quyền ⇒ lỗi, không động vào stub", () => {
    const pro = makePro();
    write("pro/src/helper.ts", "export const x = 1;\n");
    write("target/index.ts", "// stub\n");
    const target = join(root, "target");
    expect(() => applyOverlay(pro, target, { dependencies: {} })).toThrow(
      /helper\.ts/,
    );
    expect(readFileSync(join(target, "index.ts"), "utf8")).toBe("// stub\n");
  });

  it("thiếu src/index.ts ⇒ lỗi", () => {
    const pro = makePro();
    rmSync(join(pro, "src/index.ts"));
    expect(() =>
      applyOverlay(pro, join(root, "target"), { dependencies: {} }),
    ).toThrow(/index\.ts/);
  });

  it("phụ thuộc chưa khai ở package.json ⇒ lỗi", () => {
    const pro = makePro();
    write("pro/deps.json", '["pdf-lib"]');
    expect(() =>
      applyOverlay(pro, join(root, "target"), { dependencies: {} }),
    ).toThrow(/pdf-lib/);
  });
});

describe("runCli", () => {
  it("check-stub: sạch ⇒ 0, có dấu Pro ⇒ 1", () => {
    write("src/main/pro/index.ts", "// MIT\n");
    write("src/main/pro/deps.json", "[]");
    write("package.json", '{"dependencies":{}}');
    const out: string[] = [];
    const log = (s: string) => out.push(s);
    expect(runCli(["check-stub"], { cwd: root, log })).toBe(0);
    write("src/main/pro/index.ts", PRO_HEADER);
    expect(runCli(["check-stub"], { cwd: root, log })).toBe(1);
    expect(out.join("\n")).toMatch(/index\.ts/);
  });

  it("check-stub: deps.json của stub khai gói chưa có ⇒ 1", () => {
    write("src/main/pro/index.ts", "// MIT\n");
    write("src/main/pro/deps.json", '["pdf-lib"]');
    write("package.json", '{"dependencies":{}}');
    expect(runCli(["check-stub"], { cwd: root, log: () => {} })).toBe(1);
  });

  it("apply <proDir>: chép đè src/main/pro/ của cwd", () => {
    makePro();
    write("src/main/pro/index.ts", "// stub\n");
    write("package.json", '{"dependencies":{}}');
    expect(runCli(["apply", "pro"], { cwd: root, log: () => {} })).toBe(0);
    expect(readFileSync(join(root, "src/main/pro/index.ts"), "utf8")).toContain(
      PRO_MARKER,
    );
  });

  it("lệnh sai ⇒ 2", () => {
    expect(runCli(["nope"], { cwd: root, log: () => {} })).toBe(2);
    expect(runCli(["apply"], { cwd: root, log: () => {} })).toBe(2);
  });
});
