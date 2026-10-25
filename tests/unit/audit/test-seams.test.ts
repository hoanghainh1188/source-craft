import { describe, expect, it } from "vitest";
import { readAuditTestSeams } from "../../../src/main/services/audit/test-seams";

// T021 (236) — seam e2e CHỈ có hiệu lực ở bản chưa đóng gói (R18a).

const env = {
  IV_E2E_POLICY_SYSTEM_PATH: "/tmp/policy.json",
  IV_E2E_AUDIT_KEYSTORE: "memory",
};

describe("readAuditTestSeams", () => {
  it("bản đóng gói ⇒ luôn rỗng dù có biến môi trường", () => {
    expect(readAuditTestSeams({ isPackaged: true, env })).toEqual({});
  });
  it("bản dev ⇒ đọc cả hai seam", () => {
    expect(readAuditTestSeams({ isPackaged: false, env })).toEqual({
      systemPolicyPath: "/tmp/policy.json",
      memoryKeystore: true,
    });
  });
  it("giá trị lạ / rỗng ⇒ bỏ qua", () => {
    expect(
      readAuditTestSeams({
        isPackaged: false,
        env: { IV_E2E_POLICY_SYSTEM_PATH: "  ", IV_E2E_AUDIT_KEYSTORE: "disk" },
      }),
    ).toEqual({});
  });
});
