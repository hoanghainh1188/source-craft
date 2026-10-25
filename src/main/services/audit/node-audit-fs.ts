import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  writeSync,
} from "node:fs";
import type { AuditFs } from "./audit-types";

// 236 — I/O mỏng cho nhật ký kiểm toán (loại khỏi coverage như app-log/log-fs.ts). Ghi thêm + fsync trước khi trả (write-ahead).

export function createNodeAuditFs(): AuditFs {
  return {
    mkdirp: (dir) => {
      mkdirSync(dir, { recursive: true, mode: 0o700 }); // review S6: chỉ chủ sở hữu liệt kê được
    },
    list: (dir) => {
      try {
        return readdirSync(dir);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw e;
      }
    },
    readFile: (path) => readFileSync(path),
    size: (path) => {
      try {
        return statSync(path).size;
      } catch {
        return 0;
      }
    },
    appendDurable: (path, data) => {
      const fd = openSync(path, "a", 0o600);
      try {
        writeSync(fd, data);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    },
  };
}
