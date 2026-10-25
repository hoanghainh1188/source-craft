import type { DomainMode } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// 238 — Chọn chế độ AI chuyên ngành: Chung, Pháp lý & Hợp đồng, Y tế & Lâm sàng (Pro/Enterprise).
// locked = bản quyền không có specialistAiModes ⇒ nút Legal/Medical bấm để hiện UpgradePrompt.

interface DomainToggleProps {
  domainMode: DomainMode;
  onChange: (d: DomainMode) => void;
  disabled?: boolean;
  locked?: boolean;
  onLockedClick?: () => void;
}

export function DomainToggle({
  domainMode,
  onChange,
  disabled,
  locked = false,
  onLockedClick,
}: DomainToggleProps): JSX.Element {
  const t = useT();

  const handleSelect = (mode: DomainMode): void => {
    if (mode === "general") {
      onChange("general");
      return;
    }
    if (locked) {
      onLockedClick?.();
      return;
    }
    onChange(mode);
  };

  return (
    <div
      className="segmode segdomain"
      role="group"
      aria-label={t.t("chat.domain.groupLabel")}
      data-domain={domainMode}
    >
      <button
        type="button"
        className={domainMode === "general" ? "seg active" : "seg"}
        onClick={() => handleSelect("general")}
        disabled={disabled}
        aria-pressed={domainMode === "general"}
        data-testid="domain-general"
      >
        {t.t("chat.domain.general")}
      </button>
      <button
        type="button"
        className={
          domainMode === "legal" ? "seg active" : locked ? "seg locked" : "seg"
        }
        onClick={() => handleSelect("legal")}
        disabled={disabled}
        aria-pressed={domainMode === "legal"}
        aria-disabled={locked || undefined}
        data-testid="domain-legal"
        title={
          locked
            ? t.t("chat.domain.lockedTooltip")
            : t.t("chat.domain.proTooltip")
        }
      >
        <span>{t.t("chat.domain.legal")}</span>
        <span className="scope-pro-badge" data-testid="domain-legal-pro-badge">
          {t.t("chat.domain.proBadge")}
        </span>
      </button>
      <button
        type="button"
        className={
          domainMode === "medical"
            ? "seg active"
            : locked
              ? "seg locked"
              : "seg"
        }
        onClick={() => handleSelect("medical")}
        disabled={disabled}
        aria-pressed={domainMode === "medical"}
        aria-disabled={locked || undefined}
        data-testid="domain-medical"
        title={
          locked
            ? t.t("chat.domain.lockedTooltip")
            : t.t("chat.domain.proTooltip")
        }
      >
        <span>{t.t("chat.domain.medical")}</span>
        <span
          className="scope-pro-badge"
          data-testid="domain-medical-pro-badge"
        >
          {t.t("chat.domain.proBadge")}
        </span>
      </button>
    </div>
  );
}
