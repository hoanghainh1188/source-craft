import { describe, it, expect } from "vitest";
import { resolveLegacyUserDataPath } from "../../src/main/services/app-shell/user-data-path";

const base = {
  isPackaged: true,
  hasUserDataSwitch: false,
  appData: "/Users/u/Library/Application Support",
};

describe("resolveLegacyUserDataPath (đổi tên → SourceCraft)", () => {
  it("bản cài có thư mục Quillhold cũ → ghim lại để giữ dữ liệu", () => {
    expect(
      resolveLegacyUserDataPath({
        ...base,
        exists: (p) => p.endsWith("/Quillhold"),
      }),
    ).toBe("/Users/u/Library/Application Support/Quillhold");
  });

  it("bản cài có thư mục InsightVault cũ (chưa qua Quillhold) → ghim lại để giữ dữ liệu", () => {
    expect(
      resolveLegacyUserDataPath({
        ...base,
        exists: (p) => p.endsWith("/InsightVault"),
      }),
    ).toBe("/Users/u/Library/Application Support/InsightVault");
  });

  it("cài mới (không có thư mục cũ) → mặc định theo tên mới", () => {
    expect(
      resolveLegacyUserDataPath({ ...base, exists: () => false }),
    ).toBeNull();
  });

  it("có --user-data-dir → tôn trọng, không ghim", () => {
    expect(
      resolveLegacyUserDataPath({
        ...base,
        hasUserDataSwitch: true,
        exists: () => true,
      }),
    ).toBeNull();
  });

  it("dev (chưa đóng gói) → không ghim", () => {
    expect(
      resolveLegacyUserDataPath({
        ...base,
        isPackaged: false,
        exists: () => true,
      }),
    ).toBeNull();
  });
});
