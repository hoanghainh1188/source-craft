import { join } from "node:path";
import { createAuditWriter } from "../../../../src/main/services/audit/audit-writer";
import type {
  AuditRecord,
  AuditRecordBody,
} from "../../../../src/main/services/audit/audit-types";
import {
  encryptQuestion,
  questionAad,
} from "../../../../src/main/services/audit/question-cipher";
import { keyIdOf } from "../../../../src/main/services/audit/record-chain";
import { sortAuditFiles } from "../../../../src/main/services/audit/rotation";
import {
  deviceKeyPair,
  fakeClock,
  memoryAuditFs,
  orgKeyPair,
  type MemoryAuditFs,
  type PemPair,
} from "../helpers";

// T053 (236) — nhật ký mẫu cho CLI kiểm tra/giải mã, sinh LÚC CHẠY bằng chính writer của app (không commit khoá bí mật).
// Chuẩn: ~50 bản ghi qua ≥ 2 tệp xoay vòng. Biến thể can thiệp sửa trực tiếp nội dung tệp.

export const DIR = "/audit";

export interface Fixture {
  fs: MemoryAuditFs;
  device: PemPair;
  org: PemPair;
  questions: string[];
  files(): string[];
  lines(file: string): string[];
  setLines(file: string, lines: string[]): void;
}

const started = (deviceKeyId: string, orgKeyId: string): AuditRecordBody => ({
  type: "audit.started",
  osUser: "CORP\\nguyen.an",
  host: "BANK-LT-0142",
  appVersion: "0.3.0",
  policyId: "pol-1",
  organization: "Ngân hàng X",
  deviceKeyId,
  orgKeyId,
});

export function buildStandard(
  opts: { maxFileBytes?: number; closeSession?: boolean } = {},
): Fixture {
  const fs = memoryAuditFs();
  const device = deviceKeyPair();
  const org = orgKeyPair();
  const deviceKeyId = keyIdOf(device.publicKeyPem);
  const orgKeyId = keyIdOf(org.publicKeyPem);
  const w = createAuditWriter({
    fs,
    dir: DIR,
    clock: fakeClock(),
    maxFileBytes: opts.maxFileBytes ?? 9000,
  });
  w.open();
  const add = (b: (seq: number) => AuditRecordBody) =>
    w.append(b, device.privateKeyPem);
  add(() => ({
    type: "audit.chainStarted",
    devicePublicKey: device.publicKeyPem,
    deviceKeyId,
    orgKeyId,
  }));
  add(() => started(deviceKeyId, orgKeyId));
  const questions: string[] = [];
  for (let i = 0; i < 22; i++) {
    const id = `int-${i}`;
    const q = `Câu hỏi số ${i}: điều khoản phạt?`;
    questions.push(q);
    add((seq) => ({
      type: "interaction.start",
      interactionId: id,
      osUser: "CORP\\nguyen.an",
      host: "BANK-LT-0142",
      channel: "rag",
      scope: {
        kind: "notebook",
        notebookId: "nb_7",
        notebookName: "Hợp đồng 2026",
      },
      question: encryptQuestion(
        q,
        org.publicKeyPem,
        orgKeyId,
        questionAad(seq, id),
      ),
      model: { category: "local", providerId: "ollama", model: "qwen2.5:7b" },
    }));
    add(() => ({
      type: "interaction.end",
      interactionId: id,
      status: "completed",
      model: { category: "local", providerId: "ollama", model: "qwen2.5:7b" },
      citations: [],
    }));
  }
  if (opts.closeSession !== false)
    add(() => ({ type: "audit.stopped", reason: "appQuit" }));
  return wrap(fs, device, org, questions);
}

export function wrap(
  fs: MemoryAuditFs,
  device: PemPair,
  org: PemPair,
  questions: string[],
): Fixture {
  return {
    fs,
    device,
    org,
    questions,
    files: () => sortAuditFiles(fs.list(DIR)),
    lines: (f) =>
      fs
        .text(join(DIR, f))
        .split("\n")
        .filter((l) => l.length > 0),
    setLines: (f, ls) =>
      fs.files.set(
        join(DIR, f),
        Buffer.from(ls.map((l) => `${l}\n`).join(""), "utf8"),
      ),
  };
}

export const rec = (line: string) => JSON.parse(line) as AuditRecord;
