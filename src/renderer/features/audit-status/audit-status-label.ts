import type { AuditStatus } from "@shared/ipc/types";
import type { MessageKey } from "@shared/i18n/translate";

// 236 (PR C) — ánh xạ thuần AuditStatus ⇒ khoá i18n cho chip header + mục Cài đặt (chỉ đọc). Chip chỉ khi tổ chức
// đang ghi (active) hoặc ghi lỗi chặn AI (blocked). Lý do lạ từ main ⇒ khoá dự phòng (không ghép chuỗi tuỳ ý).

/** Mọi khoá của chip/Cài đặt nằm dưới audit.status và không có tham số ⇒ gọi được t.t(key) trực tiếp. */
export type AuditLabelKey = Extract<MessageKey, `audit.status.${string}`>;

export interface AuditStatusView {
  showChip: boolean;
  tone: "info" | "warn" | null;
  chipKey: AuditLabelKey | null;
  tooltipKey: AuditLabelKey | null;
  showSettings: boolean;
  /** Trạng thái đang chặn AI (policyError / blocked) ⇒ Cài đặt tô màu cảnh báo. */
  stateWarn: boolean;
  stateKey: AuditLabelKey | null;
  reasonKey: AuditLabelKey | null;
  directoryKey: AuditLabelKey | null;
  organization: string | null;
}

const KNOWN_REASONS = {
  writeFailed: "audit.status.reason.writeFailed",
  keyUnavailable: "audit.status.reason.keyUnavailable",
  unreadableSystemPolicy: "audit.status.reason.unreadableSystemPolicy",
  invalidAuditPublicKey: "audit.status.reason.invalidAuditPublicKey",
  invalidAuditLogDirectory: "audit.status.reason.invalidAuditLogDirectory",
} as const satisfies Record<string, AuditLabelKey>;

const STATE_KEYS = {
  off: "audit.status.state.off",
  licenseInactive: "audit.status.state.licenseInactive",
  policyError: "audit.status.state.policyError",
  active: "audit.status.state.active",
  blocked: "audit.status.state.blocked",
} as const satisfies Record<AuditStatus["state"], AuditLabelKey>;

const HIDDEN: AuditStatusView = {
  showChip: false,
  tone: null,
  chipKey: null,
  tooltipKey: null,
  showSettings: false,
  stateWarn: false,
  stateKey: null,
  reasonKey: null,
  directoryKey: null,
  organization: null,
};

function reasonKeyFor(reason: string | undefined): AuditLabelKey | null {
  if (reason === undefined) return null;
  return Object.prototype.hasOwnProperty.call(KNOWN_REASONS, reason)
    ? KNOWN_REASONS[reason as keyof typeof KNOWN_REASONS]
    : "audit.status.reason.unknown";
}

export function auditStatusLabel(status: AuditStatus | null): AuditStatusView {
  // Trạng thái lạ (main mới hơn renderer) ⇒ ẩn, không ghép khoá tuỳ ý.
  if (
    status === null ||
    !Object.prototype.hasOwnProperty.call(STATE_KEYS, status.state)
  )
    return HIDDEN;
  const organization = status.organization ?? null;
  if (status.state === "off" && organization === null) return HIDDEN;

  const chip =
    status.state === "active"
      ? ({
          showChip: true,
          tone: "info",
          chipKey: "audit.status.chip.active",
          tooltipKey: "audit.status.tooltip.active",
        } as const)
      : status.state === "blocked"
        ? ({
            showChip: true,
            tone: "warn",
            chipKey: "audit.status.chip.blocked",
            tooltipKey: "audit.status.tooltip.blocked",
          } as const)
        : ({
            showChip: false,
            tone: null,
            chipKey: null,
            tooltipKey: null,
          } as const);

  return {
    ...chip,
    showSettings: true,
    stateWarn: status.state === "blocked" || status.state === "policyError",
    stateKey: STATE_KEYS[status.state],
    reasonKey: reasonKeyFor(status.reason),
    directoryKey: status.directoryKind
      ? `audit.status.directory.${status.directoryKind}`
      : null,
    organization,
  };
}
