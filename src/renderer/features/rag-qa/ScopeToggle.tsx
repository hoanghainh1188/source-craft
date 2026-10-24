import type { RagSearchScope } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

export function ScopeToggle({
  scope,
  onChange,
  disabled,
}: {
  scope: RagSearchScope;
  onChange: (s: RagSearchScope) => void;
  disabled?: boolean;
}): JSX.Element {
  const t = useT();

  return (
    <div
      className="segmode segscope"
      role="group"
      aria-label={t.t("chat.scope.groupLabel")}
      data-scope={scope}
    >
      <button
        type="button"
        className={scope === "current" ? "seg active" : "seg"}
        onClick={() => onChange("current")}
        disabled={disabled}
        aria-pressed={scope === "current"}
        data-testid="scope-current"
      >
        {t.t("chat.scope.current")}
      </button>
      <button
        type="button"
        className={scope === "all" ? "seg active" : "seg"}
        onClick={() => onChange("all")}
        disabled={disabled}
        aria-pressed={scope === "all"}
        data-testid="scope-all"
        title={t.t("chat.scope.proTooltip")}
      >
        <span>{t.t("chat.scope.all")}</span>
        <span
          className="badge-pro"
          style={{
            marginLeft: "4px",
            fontSize: "10px",
            padding: "1px 4px",
            borderRadius: "4px",
            backgroundColor: "var(--color-primary-subtle, #e0e7ff)",
            color: "var(--color-primary, #3b82f6)",
            fontWeight: "bold",
          }}
        >
          {t.t("chat.scope.proBadge")}
        </span>
      </button>
    </div>
  );
}
