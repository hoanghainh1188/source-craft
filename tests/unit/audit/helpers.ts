import { generateKeyPairSync } from "node:crypto";
import { join } from "node:path";
import type { AuditFs } from "../../../src/main/services/audit/audit-types";
import type { KeytarLike } from "../../../src/main/services/ai-runtime/online/secret-store";

// 236 — dụng cụ test nhật ký kiểm toán: khoá sinh lúc chạy (không commit khoá bí mật), fs/keystore/đồng hồ trong bộ nhớ.

export interface PemPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

function pair(kind: "ed25519" | "x25519"): PemPair {
  const { privateKey, publicKey } = generateKeyPairSync(kind as "ed25519");
  return {
    privateKeyPem: privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) as string,
  };
}

export const deviceKeyPair = (): PemPair => pair("ed25519");
export const orgKeyPair = (): PemPair => pair("x25519");

/** fs trong bộ nhớ thoả AuditFs. `failAppend` tiêm lỗi (vd ENOSPC) cho lần ghi kế tiếp / mọi lần. */
export interface MemoryAuditFs extends AuditFs {
  files: Map<string, Buffer>;
  dirs: Set<string>;
  fsyncCount: number;
  failAppend: { code: string; once?: boolean } | null;
  text(path: string): string;
  linesIn(dir: string): string[];
}

export function memoryAuditFs(): MemoryAuditFs {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  const fsObj: MemoryAuditFs = {
    files,
    dirs,
    fsyncCount: 0,
    failAppend: null,
    mkdirp(dir) {
      dirs.add(dir);
    },
    list(dir) {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      return [...files.keys()]
        .filter(
          (p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"),
        )
        .map((p) => p.slice(prefix.length));
    },
    readFile(path) {
      const b = files.get(path);
      if (!b) {
        const e = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
        e.code = "ENOENT";
        throw e;
      }
      return b;
    },
    size(path) {
      return files.get(path)?.length ?? 0;
    },
    appendDurable(path, data) {
      if (fsObj.failAppend) {
        const f = fsObj.failAppend;
        if (f.once) fsObj.failAppend = null;
        const e = new Error(f.code) as NodeJS.ErrnoException;
        e.code = f.code;
        throw e;
      }
      const prev = files.get(path) ?? Buffer.alloc(0);
      files.set(path, Buffer.concat([prev, Buffer.from(data, "utf8")]));
      fsObj.fsyncCount += 1;
    },
    text(path) {
      return (files.get(path) ?? Buffer.alloc(0)).toString("utf8");
    },
    linesIn(dir) {
      return fsObj
        .list(dir)
        .sort()
        .flatMap((n) =>
          fsObj
            .text(join(dir, n))
            .split("\n")
            .filter((l) => l.length > 0),
        );
    },
  };
  return fsObj;
}

/** keystore trong bộ nhớ thoả KeytarLike; `failing` ⇒ mọi lời gọi ném. */
export function memoryKeystore(): KeytarLike & {
  store: Map<string, string>;
  failing: boolean;
} {
  const store = new Map<string, string>();
  const ks = {
    store,
    failing: false,
    async getPassword(service: string, account: string) {
      if (ks.failing) throw new Error("keychain locked");
      return store.get(`${service}/${account}`) ?? null;
    },
    async setPassword(service: string, account: string, password: string) {
      if (ks.failing) throw new Error("keychain locked");
      store.set(`${service}/${account}`, password);
    },
    async deletePassword(service: string, account: string) {
      if (ks.failing) throw new Error("keychain locked");
      return store.delete(`${service}/${account}`);
    },
  };
  return ks;
}

/** Đồng hồ giả: mỗi lần đọc tăng `step` ms (mặc định 1 ms) — ts tăng dần tất định. */
export function fakeClock(startMs = Date.UTC(2026, 9, 25, 2, 0, 0), step = 1) {
  let now = startMs;
  const clock = () => {
    const v = now;
    now += step;
    return v;
  };
  clock.set = (ms: number) => {
    now = ms;
  };
  return clock;
}

/** randomId tất định: id-1, id-2, … */
export function seqIds(prefix = "id") {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export const AUDIT_DIR = "/data/audit";
