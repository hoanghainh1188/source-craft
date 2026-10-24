import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Notebook } from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { useNotebooks } from "./useNotebooks";
import { NotebookCard } from "./NotebookCard";
import { useRecoverableCounts } from "../meeting-capture/useRecoverableCounts";
import { NotebookModal } from "./NotebookModal";
import { DeleteConfirm } from "./DeleteConfirm";
import { IconSearch, IconPlus } from "../../shared/icons";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";

type ModalState =
  { kind: "create" } | { kind: "edit"; notebook: Notebook } | null;

// Màn Notebooks (S1): lưới card + ô tìm kiếm client-side (A5) + tạo/sửa/xoá qua modal.
// 123: lỗi xoá lưu ParsedIpcError (không lưu chuỗi đã dịch), dịch lúc render.
export function NotebooksGrid(): JSX.Element {
  const t = useT();
  const recoverable = useRecoverableCounts();
  const { notebooks, create, rename, setColor, remove } = useNotebooks();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingDelete, setPendingDelete] = useState<Notebook | null>(null);
  const [deleteError, setDeleteError] = useState<ParsedIpcError | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLInputElement>(null);
  const now = Date.now();

  // Phím tắt (043): Cmd+N → mở modal tạo; Cmd+K → focus ô tìm (ý định qua navigation state).
  useEffect(() => {
    const s = (location.state as { shortcut?: string } | null)?.shortcut;
    if (s === "create") setModal({ kind: "create" });
    else if (s === "focus") searchRef.current?.focus();
  }, [location.state]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? notebooks.filter((n) => n.name.toLowerCase().includes(q))
      : notebooks;
  }, [notebooks, query]);

  return (
    <section className="notebooks" data-testid="placeholder-notebooks">
      <div className="notebooks-head">
        <div>
          <h2>{t.t("notebooks.grid.title")}</h2>
          <p className="notebooks-sub">{t.t("notebooks.grid.subtitle")}</p>
        </div>
        <div className="nb-search">
          <IconSearch size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.t("notebooks.grid.searchPlaceholder")}
            aria-label={t.t("notebooks.grid.searchLabel")}
            data-testid="notebook-search"
          />
        </div>
        <button
          type="button"
          className="btn-secondary-sm border border-border px-3 py-1 text-xs rounded hover:bg-muted"
          onClick={async () => {
            try {
              await window.api.importNotebookPackage();
              window.location.reload();
            } catch (err) {
              setDeleteError(toParsedError(err));
            }
          }}
          title={t.t("notebooks.grid.importPackage")}
          data-testid="notebook-import"
        >
          📥 {t.t("notebooks.grid.importPackage")}
        </button>
        <button
          type="button"
          className="btn-primary-sm"
          onClick={() => setModal({ kind: "create" })}
          data-testid="notebook-new"
        >
          <IconPlus size={15} />
          {t.t("notebooks.new")}
        </button>
      </div>

      {notebooks.length === 0 ? (
        <div className="nb-empty" data-testid="notebooks-empty">
          <p className="nb-empty-title">{t.t("notebooks.grid.emptyTitle")}</p>
          <p className="nb-empty-sub">{t.t("notebooks.grid.emptySub")}</p>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => setModal({ kind: "create" })}
            data-testid="notebook-create-card"
          >
            <IconPlus size={15} />
            {t.t("notebooks.grid.create")}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="nb-empty" data-testid="notebooks-no-result">
          <p className="nb-empty-title">
            {t.t("notebooks.grid.noResultTitle")}
          </p>
          <p className="nb-empty-sub">
            {t.t("notebooks.grid.noResultSub", { query })}
          </p>
        </div>
      ) : (
        <div className="nb-grid">
          {filtered.map((n) => (
            <NotebookCard
              key={n.id}
              notebook={n}
              now={now}
              onOpen={() => navigate(`/workspace/${n.id}`)}
              onEdit={() => setModal({ kind: "edit", notebook: n })}
              onDelete={() => setPendingDelete(n)}
              onExport={async () => {
                try {
                  await window.api.exportNotebookPackage(n.id);
                } catch (err) {
                  setDeleteError(toParsedError(err));
                }
              }}
              recoverable={recoverable.get(n.id) ?? 0}
            />
          ))}
          <button
            type="button"
            className="nb-card-new"
            onClick={() => setModal({ kind: "create" })}
            data-testid="notebook-create-card"
          >
            <IconPlus size={22} />
            {t.t("notebooks.grid.create")}
          </button>
        </div>
      )}

      {modal?.kind === "create" && (
        <NotebookModal
          mode="create"
          onSubmit={(name, color) => create({ name, color })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "edit" && (
        <NotebookModal
          mode="edit"
          initialName={modal.notebook.name}
          initialColor={modal.notebook.color}
          onSubmit={async (name, color) => {
            if (name !== modal.notebook.name)
              await rename({ id: modal.notebook.id, name });
            if (color !== modal.notebook.color)
              await setColor({ id: modal.notebook.id, color });
          }}
          onClose={() => setModal(null)}
        />
      )}
      {pendingDelete && (
        <DeleteConfirm
          name={pendingDelete.name}
          error={deleteError ? describeIpcError(deleteError, t) : null}
          onConfirm={() => {
            remove(pendingDelete.id)
              .then(() => {
                setPendingDelete(null);
                setDeleteError(null);
              })
              .catch((e: unknown) => setDeleteError(toParsedError(e)));
          }}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
        />
      )}
    </section>
  );
}
