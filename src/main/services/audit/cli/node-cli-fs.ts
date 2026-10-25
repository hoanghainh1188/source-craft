import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import type { CliFs } from "./run-cli";

// 236 (PR B) — I/O mỏng cho chế độ dòng lệnh (loại khỏi coverage như node-audit-fs.ts). Đọc nhật ký; ghi CHỈ tệp đích
// do IT chỉ định (--out, --out-dir) với cờ "wx" (không ghi đè) — không bao giờ ghi vào thư mục nhật ký.

export function createNodeCliFs(): CliFs {
  return {
    list: (dir) => readdirSync(dir),
    readFile: (path) => readFileSync(path),
    exists: (path) => existsSync(path),
    realpath: (path) => {
      try {
        return realpathSync.native(path);
      } catch {
        return path;
      }
    },
    mkdirp: (dir) => {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    },
    writeFile: (path, data, mode) => {
      writeFileSync(path, data, {
        flag: "wx",
        ...(mode !== undefined ? { mode } : {}),
      });
    },
  };
}
