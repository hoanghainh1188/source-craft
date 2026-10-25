import { describe, expect, it } from "vitest";
import { createAuditWriter } from "../../../../src/main/services/audit/audit-writer";
import { verifyAuditDir } from "../../../../src/main/services/audit/cli/verify";
import { keyIdOf } from "../../../../src/main/services/audit/record-chain";
import { DIR } from "./fixtures";
import { deviceKeyPair, fakeClock, memoryAuditFs } from "../helpers";

// T056 (236) — SC-004: kiểm tra 10 000 bản ghi < 10 s, không cần mạng.

describe("verifyAuditDir — hiệu năng", () => {
  it("10 000 bản ghi < 10 s", () => {
    const fs = memoryAuditFs();
    const d = deviceKeyPair();
    const w = createAuditWriter({ fs, dir: DIR, clock: fakeClock() });
    w.open();
    w.append(
      () => ({
        type: "audit.chainStarted",
        devicePublicKey: d.publicKeyPem,
        deviceKeyId: keyIdOf(d.publicKeyPem),
        orgKeyId: "k",
      }),
      d.privateKeyPem,
    );
    for (let i = 1; i < 10_000; i++) {
      w.append(
        () => ({
          type: "interaction.end",
          interactionId: `i-${i}`,
          status: "completed",
          model: { category: "local", providerId: "ollama", model: "m" },
          citations: [],
        }),
        d.privateKeyPem,
      );
    }
    const t = performance.now();
    const r = verifyAuditDir(fs, DIR);
    const ms = performance.now() - t;
    expect(r.records).toBe(10_000);
    expect(r.result).toBe("intact");
    expect(ms).toBeLessThan(10_000);
  }, 60_000);
});
