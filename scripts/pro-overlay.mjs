#!/usr/bin/env node
// 248 — chép đè bản Pro (repo private source-craft-pro) lên stub src/main/pro/, và kiểm stub ở CI repo public.
// Mô hình: docs/pro-repo-split-plan.md §4. Chỉ dùng node:fs — không mạng, không git.
// Usage:
//   node scripts/pro-overlay.mjs check-stub         # CI public: stub KHÔNG được có dấu bản Pro, deps.json hợp lệ
//   node scripts/pro-overlay.mjs apply <proDir>     # release / CI repo Pro: thay src/main/pro/ bằng bản Pro
//
// Bố cục repo Pro → src/main/pro/:  src/** → ./  ·  tests/** → tests/  ·  api-types.test.ts, deps.json → ./
// Mọi thứ khác (.git, .github, scripts/, README…) KHÔNG được chép.

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PRO_MARKER = "LicenseRef-SourceCraft-Pro";
export const STUB_DIR = join("src", "main", "pro");
/** Hai tệp GIỐNG HỆT ở hai repo (check-stub.mjs của repo Pro so khớp) — không mang dấu bản quyền riêng. */
export const PINNED_FILES = ["api-types.test.ts", "deps.json"];
const CODE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

/** Liệt kê tệp (đường dẫn tương đối, phân cách "/") dưới dir. */
export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** Tệp trong stub mang dấu bản Pro (phải rỗng ở repo public). */
export function checkStub(dir) {
  return listFiles(dir).filter((f) =>
    readFileSync(join(dir, f), "utf8").includes(PRO_MARKER),
  );
}

/** deps.json = mảng tên gói npm (không rỗng). */
export function parseDeps(text) {
  const v = JSON.parse(text);
  if (
    !Array.isArray(v) ||
    !v.every((d) => typeof d === "string" && d.length > 0)
  ) {
    throw new Error("deps.json phải là mảng tên gói npm");
  }
  return v;
}

/** Phụ thuộc Pro chưa khai ở `dependencies` của package.json public (lockfile phải không đổi khi chép đè). */
export function missingDeps(deps, pkg) {
  const declared = pkg.dependencies ?? {};
  return deps.filter((d) => !Object.prototype.hasOwnProperty.call(declared, d));
}

function assertDeps(depsPath, pkg) {
  const missing = missingDeps(parseDeps(readFileSync(depsPath, "utf8")), pkg);
  if (missing.length > 0) {
    throw new Error(
      `deps.json có gói chưa khai ở dependencies của package.json: ${missing.join(", ")}`,
    );
  }
}

/**
 * Thay toàn bộ targetDir bằng bản Pro ở proDir. Kiểm hết TRƯỚC khi đụng vào targetDir (lỗi ⇒ stub còn nguyên).
 * Chỉ ĐỌC proDir (không bao giờ chép .git/.github) ⇒ dùng được với bản clone local; release.yml tự xoá cả .pro sau đó.
 * Trả về danh sách tệp đã chép (tương đối với targetDir).
 */
export function applyOverlay(proDir, targetDir, pkg) {
  const srcDir = join(proDir, "src");
  if (!existsSync(join(srcDir, "index.ts"))) {
    throw new Error("repo Pro thiếu src/index.ts");
  }
  for (const f of PINNED_FILES) {
    if (!existsSync(join(proDir, f))) throw new Error(`repo Pro thiếu ${f}`);
  }
  assertDeps(join(proDir, "deps.json"), pkg);

  const plan = listFiles(srcDir).map((f) => ({ from: join(srcDir, f), to: f }));
  const testsDir = join(proDir, "tests");
  if (existsSync(testsDir)) {
    for (const f of listFiles(testsDir)) {
      plan.push({ from: join(testsDir, f), to: `tests/${f}` });
    }
  }
  const unmarked = plan
    .filter(({ to }) => CODE_EXT.test(to))
    .filter(({ from }) => !readFileSync(from, "utf8").includes(PRO_MARKER))
    .map(({ to }) => to);
  if (unmarked.length > 0) {
    throw new Error(
      `tệp Pro thiếu dấu SPDX ${PRO_MARKER}: ${unmarked.join(", ")}`,
    );
  }
  for (const f of PINNED_FILES) plan.push({ from: join(proDir, f), to: f });

  // Dựng ở thư mục tạm cạnh đích rồi mới thay ⇒ không để lại stub nửa vời nếu chép lỗi giữa chừng.
  const parent = dirname(resolve(targetDir));
  const staging = mkdtempSync(join(parent, ".pro-staging-"));
  try {
    for (const { from, to } of plan) cpSync(from, join(staging, to));
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(staging, targetDir, { recursive: true });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  return plan.map(({ to }) => to);
}

function readPkg(cwd) {
  return JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
}

/** Trả mã thoát: 0 ổn · 1 kiểm tra thất bại · 2 dùng sai lệnh. */
export function runCli(
  argv,
  { cwd = process.cwd(), log = console.error } = {},
) {
  const [cmd, arg] = argv;
  const stubDir = join(cwd, STUB_DIR);
  try {
    if (cmd === "check-stub") {
      const marked = checkStub(stubDir);
      if (marked.length > 0) {
        log(
          `${STUB_DIR} của repo public chứa mã Pro (${PRO_MARKER}): ${marked.join(", ")}. ` +
            "Khôi phục stub: git checkout -- src/main/pro && git clean -fd src/main/pro",
        );
        return 1;
      }
      assertDeps(join(stubDir, "deps.json"), readPkg(cwd));
      log(`${STUB_DIR}: stub hợp lệ`);
      return 0;
    }
    if (cmd === "apply" && arg) {
      const copied = applyOverlay(resolve(cwd, arg), stubDir, readPkg(cwd));
      log(`Đã chép đè ${STUB_DIR} bằng bản Pro (${copied.length} tệp)`);
      return 0;
    }
  } catch (e) {
    log(e instanceof Error ? e.message : String(e));
    return 1;
  }
  log("Usage: pro-overlay.mjs check-stub | apply <proDir>");
  return 2;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exit(runCli(process.argv.slice(2)));
}
