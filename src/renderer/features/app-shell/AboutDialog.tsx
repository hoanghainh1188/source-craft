import { useRef } from "react";
import { useModalA11y } from "../../shared/useModalA11y";
import { IconClose } from "../../shared/icons";
import { useT } from "../../shared/i18n/i18n-context";
import type { AppInfo } from "@shared/ipc/types";

export interface AboutDialogProps {
  appInfo: AppInfo | null;
  onClose: () => void;
}

// Clean, ultra-readable slant ALL-CAPS ASCII banner for SourceCraft
export const SOURCECRAFT_ASCII_ART = `   _____ ____  __  ______  ____________  __________  ___    ____________
  / ___// __ \\/ / / / __ \\/ ____/ ____/ / ____/ __ \\/   |  / ____/_  __/
  \\__ \\/ / / / / / / /_/ / /   / __/   / /   / /_/ / /| | / /_    / /   
 ___/ / /_/ / /_/ / _, _/ /___/ /___  / /___/ _, _/ ___ |/ __/   / /    
/____/\\____/\\____/_/ |_|\\____/_____/  \\____/_/ |_/_/  |_/_/     /_/     `;

export function AboutDialog({
  appInfo,
  onClose,
}: AboutDialogProps): JSX.Element {
  const t = useT();
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y({ active: true, onClose, containerRef: modalRef });

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="about-dialog"
    >
      <div className="nb-modal about-modal" ref={modalRef}>
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          aria-label={t.t("common.close")}
          data-testid="about-modal-close"
        >
          <IconClose size={16} />
        </button>

        {/* Colorful ASCII Art Banner */}
        <pre
          className="about-ascii-banner"
          aria-label="SourceCraft ASCII Banner"
        >
          {SOURCECRAFT_ASCII_ART}
        </pre>

        <div className="about-header-info">
          <h3 className="about-app-title">
            {appInfo?.name ?? "SourceCraft"}{" "}
            <span className="about-version-tag">
              v{appInfo?.version ?? "0.3.0"}
            </span>
          </h3>
          <p className="about-tagline">{t.t("app.header.tagline")}</p>
        </div>

        <div className="about-body">
          <div className="about-privacy-box">
            <div className="about-privacy-badge">
              <span className="dot" />
              <span>{t.t("app.privacy.localFull")}</span>
            </div>
            <p className="about-privacy-desc">{t.t("about.privacy")}</p>
          </div>

          <div className="about-meta-row">
            <span>
              {t.t("about.license", {
                license: "MIT",
                author: "hoanghainh1188",
              })}
            </span>
            <span className="about-dot-sep">·</span>
            <span>© 2026 hoanghainh1188</span>
          </div>

          <div className="about-repo-link">
            <a
              href="https://github.com/hoanghainh1188/source-craft"
              target="_blank"
              rel="noreferrer"
            >
              github.com/hoanghainh1188/source-craft
            </a>
          </div>
        </div>

        <div className="nb-modal-actions">
          <button
            type="button"
            className="btn-primary-sm"
            onClick={onClose}
            autoFocus
          >
            {t.t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
