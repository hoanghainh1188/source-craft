import { describe, it, expect } from "vitest";
import { CHANNELS, isWhitelisted } from "../../src/shared/ipc/channels";

// 236 (PR C, contracts/audit-ipc.md): 1 kênh đọc + 1 kênh push; không kênh ghi/xoá/bật/tắt/đọc nội dung nhật ký.

describe("audit IPC whitelist", () => {
  it("kênh đọc trạng thái whitelisted; sự kiện đổi có tên cố định", () => {
    expect(CHANNELS.auditGetStatus).toBe("audit:getStatus");
    expect(CHANNELS.auditStatusChanged).toBe("audit:statusChanged");
    expect(isWhitelisted("audit:getStatus")).toBe(true);
  });

  it("không có kênh thay đổi hay đọc nội dung nhật ký", () => {
    const auditChannels = Object.values(CHANNELS).filter((c) =>
      c.startsWith("audit:"),
    );
    expect(auditChannels.sort()).toEqual([
      "audit:getStatus",
      "audit:statusChanged",
    ]);
    for (const c of [
      "audit:enable",
      "audit:disable",
      "audit:read",
      "audit:delete",
      "audit:export",
      "audit:getDirectory",
    ]) {
      expect(isWhitelisted(c)).toBe(false);
    }
  });
});
