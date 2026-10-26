import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { VI_LITERAL_ALLOWLIST } from "./i18n-allowlist";

// 123 (FR-011, SC-002): không còn chuỗi tiếng Việt viết cứng trong src/ ngoài tệp dịch. Quét literal ("…", '…',
// `…`) và chữ JSX giữa thẻ; bỏ chú thích. Tệp dịch (src/shared/i18n/vi.ts, domains/*) và allowlist có lý do được miễn.

const ROOT = join(__dirname, "..", "..");
const VI =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const STR = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
/** Chữ JSX giữa thẻ — kể cả nhiều dòng (review 123). */
const JSX_TEXT = />([^<>{}]*[A-Za-zÀ-ỹ][^<>{}]*)</g;
/** Regex literal (review 123): `/…/flags` đứng sau ký tự mở biểu thức. */
const REGEX_LITERAL =
  /(?<=[=(:,\[!&|?;{}]\s*)\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuy]*/g;
/** Key object không nháy chứa chữ Việt (review 123): `Lỗi: …`. */
const BARE_KEY = /(?:^|[{,]\s*)([\p{L}_$][\p{L}\p{N}_$]*)\s*:/gmu;

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listSources(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Bỏ chú thích nhưng KHÔNG đụng nội dung chuỗi (review 123: "a//b" trong chuỗi không bị cắt). */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (
      c === "/" &&
      src[i + 1] !== "/" &&
      src[i + 1] !== "*" &&
      /[=(:,[!&|?;{}]\s*$/.test(out.slice(-20))
    ) {
      // Regex literal: giữ nguyên, bỏ qua dấu nháy bên trong (không nhầm là chuỗi).
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== "\n") {
        if (src[j] === "\\") j += 2;
        else {
          if (src[j] === "[") inClass = true;
          else if (src[j] === "]") inClass = false;
          else if (src[j] === "/" && !inClass) break;
          j += 1;
        }
      }
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      out += src.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Trả danh sách vi phạm "tệp:dòng: chuỗi" trong một mã nguồn. */
export function findViLiterals(file: string, src: string): string[] {
  const code = stripComments(src);
  const hits: string[] = [];
  const patterns = file.endsWith(".tsx")
    ? [STR, JSX_TEXT, REGEX_LITERAL, BARE_KEY]
    : [STR, REGEX_LITERAL, BARE_KEY];
  for (const re of patterns) {
    for (const m of code.matchAll(re)) {
      if (!VI.test(m[0])) continue;
      const line = code.slice(0, m.index).split("\n").length;
      hits.push(`${file}:${line}: ${m[0].slice(0, 80)}`);
    }
  }
  return hits;
}

const EXEMPT = (rel: string): boolean =>
  rel === "src/shared/i18n/vi.ts" ||
  rel.startsWith("src/shared/i18n/domains/") ||
  // 248: module Pro (src/main/pro/, bản thật chép đè từ repo source-craft-pro) KHÔNG có chữ giao diện (§4.1: UI, i18n ở lại
  // repo public) — chỉ có nội dung gửi model (nhãn trong lời nhắc theo ngôn ngữ đầu ra) và tên test. Tệp ở đó không nằm
  // trong allowlist được vì không tồn tại ở repo public.
  rel.startsWith("src/main/pro/") ||
  VI_LITERAL_ALLOWLIST.some((a) => a.file === rel);

describe("không có chuỗi tiếng Việt viết cứng ngoài tệp dịch", () => {
  it("src/**/*.ts(x)", () => {
    const violations = listSources(join(ROOT, "src"))
      .map((p) => relative(ROOT, p).split("\\").join("/"))
      .filter((rel) => !EXEMPT(rel))
      .flatMap((rel) =>
        findViLiterals(rel, readFileSync(join(ROOT, rel), "utf8")),
      );
    expect(violations).toEqual([]);
  });

  it("tự kiểm: bộ quét bắt được chuỗi cứng (literal, template, JSX) và bỏ qua chú thích", () => {
    const sample = [
      'const a = "Xin chào";',
      "const b = `Đang tải ${x}`;",
      "const c = <p>Lưu lại</p>;",
      "const d = (",
      "  <p>",
      "    Dòng thứ hai",
      "  </p>",
      ");",
      "const e = /đ+/u;",
      "const f = { Lỗi: 1 };",
      'const g = "a//b" + "không phải chú thích";',
      "// chú thích tiếng Việt không tính",
      "/* khối chú thích: Đã xong */",
      'const ok = "Hello";',
    ].join("\n");
    const hits = findViLiterals("x.tsx", sample);
    expect(hits).toHaveLength(7);
    expect(hits[0]).toContain("x.tsx:1");
  });

  it("allowlist chỉ chứa tệp tồn tại, có lý do", () => {
    for (const a of VI_LITERAL_ALLOWLIST) {
      expect(statSync(join(ROOT, a.file)).isFile()).toBe(true);
      expect(a.reason.length).toBeGreaterThan(10);
    }
  });
});
