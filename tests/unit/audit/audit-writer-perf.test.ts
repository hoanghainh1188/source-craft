import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuditWriter } from "../../../src/main/services/audit/audit-writer";
import { createNodeAuditFs } from "../../../src/main/services/audit/node-audit-fs";
import type { InteractionStartBody } from "../../../src/main/services/audit/audit-types";
import { deviceKeyPair } from "./helpers";

// T016 (236) — chi phí ghi write-ahead trên đĩa thật: append + fsync ~1 KB, p95 ≤ 20 ms (plan › Performance Goals).
// IV_PERF_SKIP=1 bỏ qua trên runner chậm/ổ mạng (ghi lý do trong log CI).

const skip = process.env["IV_PERF_SKIP"] === "1";

describe.skipIf(skip)("audit-writer trên fs thật", () => {
  it("100 lần ghi interaction.start ⇒ p95 ≤ 20 ms", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "sc-audit-perf-")), "audit");
    const key = deviceKeyPair();
    const w = createAuditWriter({
      fs: createNodeAuditFs(),
      dir,
      clock: Date.now,
    });
    w.open();
    const body = (id: number): InteractionStartBody => ({
      type: "interaction.start",
      interactionId: `int-${id}`,
      osUser: "CORP\\nguyen.an",
      host: "BANK-LT-0142",
      channel: "rag",
      scope: {
        kind: "notebook",
        notebookId: "nb_7",
        notebookName: "Hợp đồng 2026",
      },
      model: { category: "local", providerId: "ollama", model: "qwen2.5:7b" },
      question: {
        alg: "x25519-hkdf-sha256-aes256gcm",
        orgKeyId: "a".repeat(32),
        epk: "b".repeat(60),
        nonce: "c".repeat(16),
        ct: "d".repeat(400),
        tag: "e".repeat(24),
        len: 300,
      },
    });
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const t = performance.now();
      w.append(() => body(i), key.privateKeyPem);
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    expect(times[94]).toBeLessThanOrEqual(20);
  });
});
