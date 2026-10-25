import { describe, expect, it } from "vitest";
import {
  loadStrictKeytar,
  memoryKeystore,
  unavailableKeystore,
} from "../../../src/main/services/audit/audit-keystore";

// 236 — kho khoá nghiêm ngặt: không có keychain ⇒ luôn ném (fail-closed), không rơi về no-op như AI online.

describe("loadStrictKeytar", () => {
  it("require ném ⇒ kho luôn ném", async () => {
    const ks = loadStrictKeytar(() => {
      throw new Error("no libsecret");
    });
    expect(ks).toBe(unavailableKeystore);
    await expect(ks.getPassword("s", "a")).rejects.toThrow();
    await expect(ks.setPassword("s", "a", "p")).rejects.toThrow();
    await expect(ks.deletePassword("s", "a")).rejects.toThrow();
  });
  it("module thiếu hàm ⇒ kho luôn ném", () => {
    expect(loadStrictKeytar(() => ({}))).toBe(unavailableKeystore);
    expect(loadStrictKeytar(() => null)).toBe(unavailableKeystore);
  });
  it("module hợp lệ ⇒ trả nguyên module", () => {
    const k = memoryKeystore();
    expect(loadStrictKeytar(() => k)).toBe(k);
  });
});

describe("memoryKeystore", () => {
  it("lưu / đọc / xoá trong bộ nhớ", async () => {
    const k = memoryKeystore();
    expect(await k.getPassword("s", "a")).toBeNull();
    await k.setPassword("s", "a", "p");
    expect(await k.getPassword("s", "a")).toBe("p");
    expect(await k.deletePassword("s", "a")).toBe(true);
    expect(await k.getPassword("s", "a")).toBeNull();
  });
});
