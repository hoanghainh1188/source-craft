import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 236 (SC-006, FR-022): mô-đun nhật ký kiểm toán KHÔNG có đường mạng nào — chặn tĩnh mọi import/gọi mạng.

const DIR = join(process.cwd(), "src/main/services/audit");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? files(join(dir, e.name))
      : e.name.endsWith(".ts")
        ? [join(dir, e.name)]
        : [],
  );

describe("audit module không có egress", () => {
  it.each(files(DIR).map((f) => [f.slice(DIR.length + 1), f]))(
    "%s",
    (_n, f) => {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(
        /from\s+["'](node:)?(http|https|net|tls|dgram|dns)["']/,
      );
      expect(src).not.toMatch(/\bfetch\s*\(/);
      expect(src).not.toMatch(/from\s+["']electron["']/);
    },
  );
});
