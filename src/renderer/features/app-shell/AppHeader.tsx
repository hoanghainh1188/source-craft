import { useEffect, useState } from "react";
import type { AppInfo, LicenseStatus } from "@shared/ipc/types";
import { PrivacyBadge } from "./PrivacyBadge";
import { AboutDialog } from "./AboutDialog";
import { AuditStatusChip } from "../audit-status/AuditStatusChip";
import { useT } from "../../shared/i18n/i18n-context";

// Header in-app (dưới khung native OS — clarify A3): tên app + privacy badge + About dialog trigger.
export function AppHeader(): JSX.Element {
  const t = useT();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    let alive = true;
    window.api
      .getAppInfo()
      .then((i) => {
        if (alive) setInfo(i);
      })
      .catch(() => {
        // Giữ fallback tên app mặc định trong render (không kẹt, không unhandled rejection).
      });
    if (typeof window.api?.getLicenseStatus === "function") {
      window.api
        .getLicenseStatus()
        .then((st) => {
          if (alive) setLicense(st);
        })
        .catch(() => {});
    }
    const unsubLicense =
      typeof window.api?.onLicenseChanged === "function"
        ? window.api.onLicenseChanged((st) => {
            if (alive) setLicense(st);
          })
        : () => {};
    return () => {
      alive = false;
      unsubLicense();
    };
  }, []);

  return (
    <header className="app-header">
      <button
        type="button"
        className="app-name-btn"
        onClick={() => setShowAbout(true)}
        title={t.t("about.dialogTitle")}
        aria-haspopup="dialog"
      >
        <span className="app-name" data-testid="app-name">
          {info?.name ?? "SourceCraft"}
        </span>
      </button>
      {license?.state === "valid" && license.tier === "enterprise" && (
        <span
          className="privacy-badge"
          data-testid="header-license-badge"
          title={license.orgName ?? ""}
        >
          {t.t("settings.license.badgeEnterprise", {
            org: license.orgName ?? "",
          })}
        </span>
      )}
      {license?.state === "valid" && license.tier === "pro" && (
        <span className="privacy-badge" data-testid="header-license-badge">
          {t.t("settings.license.badgePro")}
        </span>
      )}
      <span className="app-tagline">{t.t("app.header.tagline")}</span>
      {/* 236: chip nhật ký kiểm toán đứng ngay trước huy hiệu riêng tư (chỉ khi tổ chức bật ghi). */}
      <AuditStatusChip />
      <PrivacyBadge />
      {showAbout && (
        <AboutDialog appInfo={info} onClose={() => setShowAbout(false)} />
      )}
    </header>
  );
}
