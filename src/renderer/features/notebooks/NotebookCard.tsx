import type { Notebook } from "@shared/ipc/types";
import { formatRelativeTime } from "./relative-time";
import { useT } from "../../shared/i18n/i18n-context";

// Thẻ notebook (prototype S1): stripe màu + tên + "N nguồn · Sửa <thời gian>" + nút sửa/xoá.
// Bấm thân thẻ → mở Workspace (FR-013).
export function NotebookCard({
  notebook,
  now,
  onOpen,
  onEdit,
  onDelete,
  onExport,
  recoverable = 0,
}: {
  notebook: Notebook;
  /** 186 PR C1 (T120): số bản ghi cuộc họp bị gián đoạn cần phục hồi trong notebook. */
  recoverable?: number;
  now: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport?: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <div className="nb-card" data-testid={`notebook-${notebook.id}`}>
      <button
        type="button"
        className="nb-card-open"
        onClick={onOpen}
        data-testid="notebook-open"
      >
        <div className="nb-stripe" style={{ background: notebook.color }} />
        <div className="nb-card-in">
          <h3 className="nb-card-name">{notebook.name}</h3>
          <div className="nb-card-meta">
            <span className="mono">
              {t.plural("notebooks.card.sources", notebook.sourceCount)}
            </span>
            <span>
              {t.t("notebooks.card.edited", {
                time: formatRelativeTime(notebook.updatedAt, now, t),
              })}
            </span>
          </div>
          {recoverable > 0 && (
            <span
              className="nb-recover-badge"
              data-testid="notebook-recover-badge"
            >
              {t.plural("meeting.recovery.badge", recoverable)}
            </span>
          )}
          {notebook.readOnly && (
            <span
              className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border inline-block mt-1"
              data-testid="notebook-readonly-badge"
            >
              🔒 {t.t("notebooks.grid.readOnlyBadge")}
            </span>
          )}
        </div>
      </button>
      <div className="nb-card-actions">
        {onExport && (
          <button
            type="button"
            className="nb-icon-btn"
            onClick={onExport}
            title={t.t("notebooks.grid.exportPackage")}
            data-testid="notebook-export"
          >
            📦
          </button>
        )}
        <button
          type="button"
          className="nb-icon-btn"
          onClick={onEdit}
          disabled={Boolean(notebook.readOnly)}
          data-testid="notebook-edit"
        >
          {t.t("notebooks.card.edit")}
        </button>
        <button
          type="button"
          className="nb-icon-btn danger"
          onClick={onDelete}
          data-testid="notebook-delete"
        >
          {t.t("common.delete")}
        </button>
      </div>
    </div>
  );
}
