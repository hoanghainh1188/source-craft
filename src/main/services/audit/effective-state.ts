import type { AuditState } from "@shared/ipc/types";
import type { AuditPolicyState } from "./audit-types";

// 236 — trạng thái hiệu lực (data-model §2, R10). Thuần; đánh giá lại ở mỗi lượt AI (FR-002).

export type WriterHealth =
  | { healthy: true }
  | { healthy: false; reason: "writeFailed" | "keyUnavailable" };

export interface AuditStateInput {
  policy: AuditPolicyState;
  license: { valid: boolean; itPolicy: boolean };
  writer: WriterHealth;
}

export function computeAuditState(input: AuditStateInput): {
  state: AuditState;
  reason?: string;
} {
  const { policy, license, writer } = input;
  if (policy.status === "notConfigured") return { state: "off" };
  // Không có bản quyền đủ điều kiện ⇒ chính sách audit KHÔNG có hiệu lực, kể cả khi tệp policy hỏng (FR-001, FR-004).
  if (!license.valid || !license.itPolicy) return { state: "licenseInactive" };
  if (policy.status === "policyError") {
    return { state: "policyError", reason: policy.reason };
  }
  if (!writer.healthy) return { state: "blocked", reason: writer.reason };
  return { state: "active" };
}

/** Chính sách đã yêu cầu audit mà không ghi được ⇒ chặn lượt AI (fail-closed, Q3). */
export function blocksAi(state: AuditState): boolean {
  return state === "policyError" || state === "blocked";
}
