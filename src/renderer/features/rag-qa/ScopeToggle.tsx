import type { RagSearchScope } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// 231 — chọn phạm vi hỏi đáp: sổ tay hiện tại hoặc toàn bộ kho (Pro/Enterprise). locked = bản quyền không có
// crossNotebookSearch ⇒ nút "Toàn bộ" vẫn bấm được (để mời nâng cấp qua onLockedClick) nhưng KHÔNG đổi phạm vi.

interface ScopeToggleProps {
  scope: RagSearchScope;
  onChange: (s: RagSearchScope) => void;
  disabled?: boolean;
  locked?: boolean;
  onLockedClick?: () => void;
}

export function ScopeToggle({
  scope,
  onChange,
  disabled,
  locked = false,
  onLockedClick,
}: ScopeToggleProps): JSX.Element {
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
        className={
          scope === "all" ? "seg active" : locked ? "seg locked" : "seg"
        }
        onClick={() => (locked ? onLockedClick?.() : onChange("all"))}
        disabled={disabled}
        aria-pressed={scope === "all"}
        aria-disabled={locked || undefined}
        data-testid="scope-all"
        title={
          locked
            ? t.t("chat.scope.lockedTooltip")
            : t.t("chat.scope.proTooltip")
        }
      >
        <span>{t.t("chat.scope.all")}</span>
        <span className="scope-pro-badge" data-testid="scope-pro-badge">
          {t.t("chat.scope.proBadge")}
        </span>
      </button>
    </div>
  );
}
