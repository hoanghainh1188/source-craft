import { createRequire } from "node:module";
import type { KeytarLike } from "../ai-runtime/online/secret-store";

// 236 — kho khoá cho khoá ký của máy. KHÁC loadKeytar() của AI online: không có keychain thì KHÔNG được rơi về no-op
// (sẽ sinh khoá mới mỗi lần mở mà không báo) ⇒ trả kho luôn ném ⇒ audit blocked/keyUnavailable (fail-closed, Q3).

const unavailable = (): never => {
  throw new Error("Keychain unavailable.");
};

/** Kho khoá luôn ném — dùng khi không nạp được keytar. */
export const unavailableKeystore: KeytarLike = {
  getPassword: async () => unavailable(),
  setPassword: async () => unavailable(),
  deletePassword: async () => unavailable(),
};

export function loadStrictKeytar(
  load: () => unknown = () => createRequire(import.meta.url)("keytar"),
): KeytarLike {
  try {
    const k = load() as Partial<KeytarLike> | null;
    if (
      k &&
      typeof k.getPassword === "function" &&
      typeof k.setPassword === "function"
    ) {
      return k as KeytarLike;
    }
  } catch {
    /* rơi xuống kho luôn ném */
  }
  return unavailableKeystore;
}

/** Seam e2e (IV_E2E_AUDIT_KEYSTORE=memory, chỉ bản chưa đóng gói): khoá trong bộ nhớ tiến trình. */
export function memoryKeystore(): KeytarLike {
  const m = new Map<string, string>();
  return {
    getPassword: async (s, a) => m.get(`${s}/${a}`) ?? null,
    setPassword: async (s, a, p) => {
      m.set(`${s}/${a}`, p);
    },
    deletePassword: async (s, a) => m.delete(`${s}/${a}`),
  };
}
