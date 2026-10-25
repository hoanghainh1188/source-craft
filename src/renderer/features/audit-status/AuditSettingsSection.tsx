import { useT } from "../../shared/i18n/i18n-context";
import { auditStatusLabel } from "./audit-status-label";
import { useAuditStatus } from "./useAuditStatus";
import "./audit-status.css";

// 236 (PR C, FR-020) — Cài đặt › Nhật ký kiểm toán: CHỈ ĐỌC. Trạng thái, lý do, tổ chức, nhãn vị trí (không bao giờ
// hiện đường dẫn). Không nút, không ô nhập — bộ phận IT quản lý qua tệp chính sách hệ thống.
export function AuditSettingsSection(): JSX.Element | null {
  const t = useT();
  const view = auditStatusLabel(useAuditStatus());
  if (!view.showSettings || !view.stateKey) return null;

  return (
    <section
      className="settings-ai settings-audit"
      data-testid="settings-audit-section"
      aria-labelledby="settings-audit-title"
    >
      <div className="settings-ai-head">
        <h3 id="settings-audit-title">{t.t("audit.status.section.title")}</h3>
        <span className="audit-managed">
          {t.t("audit.status.section.managed")}
        </span>
      </div>
      <p className="storage-meta audit-description">
        {t.t("audit.status.section.description")}
      </p>
      <dl className="audit-facts">
        <dt>{t.t("audit.status.section.state")}</dt>
        <dd
          data-testid="settings-audit-state"
          className={view.stateWarn ? "audit-facts__warn" : undefined}
        >
          {t.t(view.stateKey)}
        </dd>
        {view.reasonKey && (
          <>
            <dt>{t.t("audit.status.section.reason")}</dt>
            <dd data-testid="settings-audit-reason">{t.t(view.reasonKey)}</dd>
          </>
        )}
        {view.organization && (
          <>
            <dt>{t.t("audit.status.section.organization")}</dt>
            <dd data-testid="settings-audit-org">{view.organization}</dd>
          </>
        )}
        {view.directoryKey && (
          <>
            <dt>{t.t("audit.status.section.directory")}</dt>
            <dd data-testid="settings-audit-directory">
              {t.t(view.directoryKey)}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
