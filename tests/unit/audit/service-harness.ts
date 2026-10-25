import { createAuditService } from "../../../src/main/services/audit/audit-service";
import type {
  AuditPolicyState,
  AuditRecord,
} from "../../../src/main/services/audit/audit-types";
import { keyIdOf } from "../../../src/main/services/audit/record-chain";
import {
  AUDIT_DIR,
  fakeClock,
  memoryAuditFs,
  memoryKeystore,
  orgKeyPair,
  seqIds,
  type MemoryAuditFs,
} from "./helpers";

// 236 — dựng AuditService với mọi dep trong bộ nhớ; policy/license đổi được giữa các lượt (FR-002).

export const ORG = orgKeyPair();

export function configuredPolicy(
  directory: string | null = AUDIT_DIR,
): AuditPolicyState {
  return {
    status: "configured",
    organization: "Ngân hàng X",
    policyId: "pol-1",
    orgPublicKeyPem: ORG.publicKeyPem,
    orgKeyId: keyIdOf(ORG.publicKeyPem),
    directory,
  };
}

export interface Harness {
  service: ReturnType<typeof createAuditService>;
  fs: MemoryAuditFs;
  keyStore: ReturnType<typeof memoryKeystore>;
  env: {
    policy: AuditPolicyState;
    license: { valid: boolean; itPolicy: boolean; licenseId?: string };
  };
  events: { event: string; meta?: Record<string, unknown> }[];
  records(): AuditRecord[];
  types(): string[];
}

export function harness(
  opts: {
    policy?: AuditPolicyState;
    license?: { valid: boolean; itPolicy: boolean; licenseId?: string };
    fs?: MemoryAuditFs;
    keyStore?: ReturnType<typeof memoryKeystore>;
  } = {},
): Harness {
  const fs = opts.fs ?? memoryAuditFs();
  const keyStore = opts.keyStore ?? memoryKeystore();
  const env = {
    policy: opts.policy ?? configuredPolicy(),
    license: opts.license ?? {
      valid: true,
      itPolicy: true,
      licenseId: "lic-1",
    },
  };
  const events: Harness["events"] = [];
  const service = createAuditService({
    fs,
    keyStore,
    clock: fakeClock(),
    randomId: seqIds("int"),
    policy: () => env.policy,
    license: () => env.license,
    identity: () => ({ osUser: "CORP\\nguyen.an", host: "BANK-LT-0142" }),
    appVersion: "0.3.0",
    defaultDirectory: "/userData/audit",
    notebookName: (id) => (id === "nb_7" ? "Hợp đồng 2026" : null),
    logEvent: (event, meta) =>
      events.push({ event, ...(meta ? { meta } : {}) }),
  });
  const records = () =>
    fs.linesIn(AUDIT_DIR).flatMap((l) => {
      try {
        return [JSON.parse(l) as AuditRecord];
      } catch {
        return []; // dòng dở cố ý (test sửa đuôi)
      }
    });
  return {
    service,
    fs,
    keyStore,
    env,
    events,
    records,
    types: () => records().map((r) => r.type),
  };
}
