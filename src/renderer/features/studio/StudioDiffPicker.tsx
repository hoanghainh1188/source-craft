import { useEffect, useId, useState } from "react";
import type { Source } from "@shared/ipc/types";
import { useT } from "../../shared/i18n/i18n-context";

// 233 (FR-009, D1, D3): Bộ chọn cặp tài liệu so sánh [bản gốc, bản sửa đổi], hỗ trợ hoán đổi và kiểm tra sẵn sàng.

export interface StudioDiffPickerProps {
  sources: readonly Source[];
  scope: readonly string[];
  disabled: boolean;
  loading: boolean;
  onSubmit: (pair: readonly [string, string]) => void;
  defaultOpen?: boolean;
}

export function StudioDiffPicker({
  sources,
  scope,
  disabled,
  loading,
  onSubmit,
  defaultOpen = false,
}: StudioDiffPickerProps): JSX.Element {
  const t = useT();
  const id = useId();
  const baseSelectId = `${id}-base`;
  const revisedSelectId = `${id}-revised`;

  const [open, setOpen] = useState(defaultOpen);
  const [baseId, setBaseId] = useState<string>("");
  const [revisedId, setRevisedId] = useState<string>("");

  useEffect(() => {
    if (scope.length === 2) {
      setBaseId(scope[0]);
      setRevisedId(scope[1]);
    }
  }, [scope]);

  // review #233 lỗi 3: nguồn đã chọn bị xoá / hết ready ⇒ bỏ chọn (không gửi id cũ, main sẽ từ chối).
  useEffect(() => {
    const ids = new Set(sources.map((s) => s.id));
    setBaseId((cur) => (cur !== "" && !ids.has(cur) ? "" : cur));
    setRevisedId((cur) => (cur !== "" && !ids.has(cur) ? "" : cur));
  }, [sources]);

  const handleSwap = (): void => {
    setBaseId(revisedId);
    setRevisedId(baseId);
  };

  const canSubmit =
    !disabled &&
    !loading &&
    baseId !== "" &&
    revisedId !== "" &&
    baseId !== revisedId;

  const handleSubmit = (): void => {
    if (canSubmit) {
      onSubmit([baseId, revisedId]);
    }
  };

  return (
    <div className="studio-diff" data-testid="studio-diff">
      <button
        type="button"
        className="studio-btn studio-diff-toggle"
        data-testid="studio-diff-toggle"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
      >
        {t.t("studio.kind.documentDiff")}
      </button>

      {open && (
        <div className="studio-diff-panel" data-testid="studio-diff-panel">
          <div className="studio-diff-row">
            <div className="studio-diff-field">
              <label htmlFor={baseSelectId} className="studio-diff-label">
                {t.t("studio.diff.base")}
              </label>
              <select
                id={baseSelectId}
                className="studio-diff-select"
                data-testid="studio-diff-base-select"
                value={baseId}
                disabled={disabled || loading}
                onChange={(e) => setBaseId(e.target.value)}
              >
                <option value="">{t.t("studio.diff.pick")}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="studio-diff-swap-btn"
              data-testid="studio-diff-swap"
              title={t.t("studio.diff.swap")}
              aria-label={t.t("studio.diff.swap")}
              disabled={disabled || loading || (!baseId && !revisedId)}
              onClick={handleSwap}
            >
              ⇄
            </button>

            <div className="studio-diff-field">
              <label htmlFor={revisedSelectId} className="studio-diff-label">
                {t.t("studio.diff.revised")}
              </label>
              <select
                id={revisedSelectId}
                className="studio-diff-select"
                data-testid="studio-diff-revised-select"
                value={revisedId}
                disabled={disabled || loading}
                onChange={(e) => setRevisedId(e.target.value)}
              >
                <option value="">{t.t("studio.diff.pick")}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="studio-diff-actions">
            <button
              type="button"
              className="btn-primary-sm studio-diff-submit"
              data-testid="studio-diff-submit"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {loading ? t.t("studio.creating") : t.t("studio.diff.run")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
