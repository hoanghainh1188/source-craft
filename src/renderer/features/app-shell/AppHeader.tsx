import { useEffect, useState } from "react";
import type { AppInfo } from "@shared/ipc/types";
import { PrivacyBadge } from "./PrivacyBadge";
import { AboutDialog } from "./AboutDialog";
import { useT } from "../../shared/i18n/i18n-context";

// Header in-app (dưới khung native OS — clarify A3): tên app + privacy badge + About dialog trigger.
export function AppHeader(): JSX.Element {
  const t = useT();
  const [info, setInfo] = useState<AppInfo | null>(null);
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
    return () => {
      alive = false;
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
      <span className="app-tagline">{t.t("app.header.tagline")}</span>
      <PrivacyBadge />
      {showAbout && (
        <AboutDialog appInfo={info} onClose={() => setShowAbout(false)} />
      )}
    </header>
  );
}
