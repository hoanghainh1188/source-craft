import { useId, useState } from "react";
import { useT } from "../../shared/i18n/i18n-context";
import { auditStatusLabel } from "./audit-status-label";
import { useAuditStatus } from "./useAuditStatus";
import "./audit-status.css";

// 236 (PR C, FR-019) — chip cạnh chỉ báo riêng tư khi tổ chức đang ghi nhật ký kiểm toán (hoặc ghi lỗi ⇒ AI tạm
// khoá). Chỉ báo, không điều khiển: focus được bằng bàn phím để đọc giải thích (tooltip gắn aria-describedby).
// WCAG 1.4.13: tooltip di chuột vào được (là con của chip) và tắt được bằng Esc; hiện lại khi blur / rời chuột.
export function AuditStatusChip(): JSX.Element | null {
  const t = useT();
  const tooltipId = useId();
  const view = auditStatusLabel(useAuditStatus());
  const [dismissed, setDismissed] = useState(false);
  if (!view.showChip || !view.chipKey || !view.tooltipKey) return null;

  return (
    <span
      className={`audit-chip audit-chip--${view.tone}${dismissed ? " is-dismissed" : ""}`}
      data-testid="audit-status-chip"
      data-state={view.tone === "warn" ? "blocked" : "active"}
      role="note"
      tabIndex={0}
      aria-describedby={tooltipId}
      onKeyDown={(e) => {
        if (e.key === "Escape") setDismissed(true);
      }}
      onBlur={() => setDismissed(false)}
      onMouseLeave={() => setDismissed(false)}
    >
      <span className="audit-chip__icon" aria-hidden="true" />
      {t.t(view.chipKey)}
      <span role="tooltip" id={tooltipId} className="audit-chip__tooltip">
        {t.t(view.tooltipKey)}
      </span>
    </span>
  );
}
