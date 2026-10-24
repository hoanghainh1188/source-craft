import { useEffect, useState } from "react";
import type {
  LicenseActivationErrorCode,
  LicenseStatus,
} from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// 226 — Settings section for offline Ed25519 license activation (.sclicense) and tier display.
export function SettingsLicenseSection(): JSX.Element {
  const t = useT();
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<LicenseActivationErrorCode | null>(
    null,
  );
  const [notice, setNotice] = useState<"activated" | "deactivated" | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    if (typeof window.api?.getLicenseStatus === "function") {
      window.api
        .getLicenseStatus()
        .then((st) => {
          if (alive) setStatus(st);
        })
        .catch(() => {});
    }
    const unsub =
      typeof window.api?.onLicenseChanged === "function"
        ? window.api.onLicenseChanged((st) => {
            if (alive) setStatus(st);
          })
        : () => {};
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const handleActivate = async () => {
    setBusy(true);
    setErrorCode(null);
    setNotice(null);
    try {
      const res = await window.api.activateLicenseFile();
      if (res.status === "ok") {
        setStatus(res.license);
        setNotice("activated");
      } else if (res.status === "error") {
        setErrorCode(res.code);
      }
    } catch {
      setErrorCode("ioError");
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async () => {
    setBusy(true);
    setErrorCode(null);
    setNotice(null);
    try {
      const st = await window.api.deactivateLicense();
      setStatus(st);
      setNotice("deactivated");
    } catch {
      setErrorCode("ioError");
    } finally {
      setBusy(false);
    }
  };

  const tierLabel =
    status?.tier === "enterprise"
      ? t.t("settings.license.tierEnterprise")
      : status?.tier === "pro"
        ? t.t("settings.license.tierPro")
        : t.t("settings.license.tierFree");

  const errorMessage = (code: LicenseActivationErrorCode): string => {
    switch (code) {
      case "invalidFormat":
        return t.t("settings.license.errInvalidFormat");
      case "invalidSignature":
        return t.t("settings.license.errInvalidSignature");
      case "expired":
        return t.t("settings.license.errExpired");
      case "clockTampered":
        return t.t("settings.license.errClockTampered");
      case "ioError":
        return t.t("settings.license.errIo");
    }
  };

  const formatExpiry = (st: LicenseStatus): string => {
    if (!st.expiresAt) return t.t("settings.license.perpetual");
    const dateStr = st.expiresAt.slice(0, 10);
    if (st.state === "expired") {
      return t.t("settings.license.expiredBadge", { date: dateStr });
    }
    return t.t("settings.license.daysRemaining", {
      days: st.daysRemaining ?? 0,
      date: dateStr,
    });
  };

  return (
    <section
      className="settings-ai settings-license"
      data-testid="settings-license"
    >
      <div className="settings-ai-head">
        <h3>{t.t("settings.license.title")}</h3>
      </div>
      <p className="ai-note">{t.t("settings.license.description")}</p>

      {status && (
        <div className="license-summary" data-testid="license-summary">
          <p className="storage-meta">
            <strong>{tierLabel}</strong>
            {status.orgName ? ` — ${status.orgName}` : ""}
            {status.seats !== null
              ? ` · ${t.t("settings.license.seatsLabel")}: ${status.seats}`
              : ""}
          </p>
          {(status.state === "valid" || status.state === "expired") && (
            <p className="storage-meta" data-testid="license-expiry">
              {t.t("settings.license.expiresLabel")}: {formatExpiry(status)}
            </p>
          )}
          {status.state === "clockTampered" && (
            <div
              className="ai-note"
              role="alert"
              data-testid="license-clock-warning"
            >
              {t.t("settings.license.clockTamperedBadge")}
            </div>
          )}
          {status.state === "invalid" && (
            <div
              className="ai-note"
              role="alert"
              data-testid="license-invalid-warning"
            >
              {t.t("settings.license.invalidBadge")}
            </div>
          )}
          <p className="ai-note" data-testid="license-tier-hint">
            {status.tier === "free"
              ? t.t("settings.license.freeLimitsHint")
              : t.t("settings.license.proUnlockedHint")}
          </p>
        </div>
      )}

      <div
        className="license-actions"
        style={{ display: "flex", gap: "8px", marginTop: "8px" }}
      >
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void handleActivate()}
          data-testid="license-activate-btn"
        >
          {busy
            ? t.t("settings.license.activatingBtn")
            : t.t("settings.license.activateBtn")}
        </button>
        {status && status.state !== "free" && (
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => void handleDeactivate()}
            data-testid="license-deactivate-btn"
          >
            {t.t("settings.license.deactivateBtn")}
          </button>
        )}
      </div>

      {errorCode && (
        <div
          className="ai-note"
          role="alert"
          data-testid="license-error-banner"
        >
          {errorMessage(errorCode)}
        </div>
      )}
      {notice && (
        <div
          className="ai-note"
          role="status"
          data-testid="license-notice-banner"
        >
          {notice === "activated"
            ? t.t("settings.license.activatedSuccess")
            : t.t("settings.license.deactivatedSuccess")}
        </div>
      )}
    </section>
  );
}
