import { useRef, useState } from "react";
import type { NotebookColor } from "@shared/ipc/types";
import { PALETTE, DEFAULT_COLOR } from "@shared/notebook-palette";
import { useModalA11y } from "../../shared/useModalA11y";
import { IconClose } from "../../shared/icons";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";
import { UpgradePrompt } from "../license-upsell/UpgradePrompt";

// Modal tạo/sửa notebook (A8): nhập tên + chọn màu từ palette. onSubmit ném lỗi → hiện message.
// 123: lưu ParsedIpcError, dịch lúc render (đổi ngôn ngữ thì thông báo lỗi đổi theo).
export interface NotebookModalProps {
  mode: "create" | "edit";
  initialName?: string;
  initialColor?: NotebookColor;
  onSubmit: (name: string, color: NotebookColor) => Promise<void>;
  onClose: () => void;
}

export function NotebookModal({
  mode,
  initialName = "",
  initialColor = DEFAULT_COLOR,
  onSubmit,
  onClose,
}: NotebookModalProps): JSX.Element {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<NotebookColor>(initialColor);
  const [error, setError] = useState<ParsedIpcError | null>(null);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  useModalA11y({ active: true, onClose, containerRef: modalRef });

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name, color);
      onClose();
    } catch (e) {
      setError(toParsedError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      data-testid="notebook-modal"
    >
      <div className="nb-modal" ref={modalRef}>
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          aria-label={t.t("common.close")}
          data-testid="modal-close"
        >
          <IconClose size={16} />
        </button>
        <h3>
          {mode === "create"
            ? t.t("notebooks.new")
            : t.t("notebooks.modal.editTitle")}
        </h3>
        <label className="nb-field-label" htmlFor="nb-name">
          {t.t("notebooks.modal.name")}
        </label>
        <input
          id="nb-name"
          className="nb-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.t("notebooks.modal.namePlaceholder")}
          data-testid="notebook-name-input"
          autoFocus
        />
        <div className="nb-field-label">{t.t("notebooks.modal.color")}</div>
        <div className="nb-palette" data-testid="notebook-palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`nb-swatch${color === c ? " sel" : ""}`}
              style={{ background: c }}
              aria-label={t.t("notebooks.modal.swatch", { color: c })}
              onClick={() => setColor(c)}
              data-testid={`swatch-${c}`}
            />
          ))}
        </div>
        {error && (
          <div className="nb-error" data-testid="notebook-error">
            {describeIpcError(error, t)}
          </div>
        )}
        <UpgradePrompt error={error} />
        <div className="nb-modal-actions">
          <button type="button" className="btn-sm" onClick={onClose}>
            {t.t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={submit}
            disabled={busy}
            data-testid="notebook-submit"
          >
            {mode === "create"
              ? t.t("notebooks.modal.create")
              : t.t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
