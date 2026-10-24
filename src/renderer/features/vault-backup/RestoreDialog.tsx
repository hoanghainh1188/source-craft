import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BackupSummary,
  VaultBackupErrorCode,
  VaultBackupStep,
} from "@shared/ipc/types";
import { formatDateTime } from "@shared/i18n";
import { useModalA11y } from "../../shared/useModalA11y";
import { useLang, useT } from "../../shared/i18n/i18n-context";
import { errorMessage, stepLabel } from "./messages";

// 123: state giữ MÃ lỗi (dịch lúc render).
type Phase =
  | { kind: "password"; error: VaultBackupErrorCode | null }
  | { kind: "working"; step: VaultBackupStep | null }
  | { kind: "summary"; summary: BackupSummary }
  | { kind: "fatal"; code: VaultBackupErrorCode };

interface RestoreDialogProps {
  token: string;
  encrypted: boolean;
  onClose: () => void;
}

// Hộp thoại khôi phục (085 US2/US3): (mật khẩu) → giải mã + kiểm tra → tóm tắt + cảnh báo ghi đè → xác nhận
// ⇒ main tự sao lưu vault hiện tại rồi khởi động lại app. Huỷ bất kỳ lúc nào trước xác nhận ⇒ vault không đổi.
export function RestoreDialog({
  token,
  encrypted,
  onClose,
}: RestoreDialogProps): JSX.Element {
  const t = useT();
  const lang = useLang();
  const [phase, setPhase] = useState<Phase>(
    encrypted
      ? { kind: "password", error: null }
      : { kind: "working", step: null },
  );
  const [pw, setPw] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const working = phase.kind === "working";

  const cancel = useCallback(() => {
    if (working) return;
    void window.api.restoreCancel(token).finally(onClose);
  }, [working, token, onClose]);
  useModalA11y({ active: true, onClose: cancel, containerRef: ref });

  useEffect(
    () =>
      window.api.onBackupProgress((e) => {
        if (e.op === "restore") setPhase({ kind: "working", step: e.step });
      }),
    [],
  );

  const prepare = useCallback(
    async (password?: string): Promise<void> => {
      setPhase({ kind: "working", step: null });
      try {
        const r = await window.api.restorePrepare(
          password ? { token, password } : { token },
        );
        if (r.status === "ok") {
          setPhase({ kind: "summary", summary: r.summary });
        } else if (encrypted && r.code === "badPasswordOrCorrupt") {
          setPhase({ kind: "password", error: r.code });
        } else {
          setPhase({ kind: "fatal", code: r.code });
        }
      } catch {
        setPhase({ kind: "fatal", code: "ioError" });
      }
    },
    [token, encrypted],
  );

  // Chỉ chạy 1 lần kể cả khi React StrictMode gọi effect 2 lần (main cũng chặn gọi chồng).
  const started = useRef(false);
  useEffect(() => {
    if (encrypted || started.current) return;
    started.current = true;
    void prepare();
  }, [encrypted, prepare]);

  async function confirm(): Promise<void> {
    setPhase({ kind: "working", step: "preBackup" });
    try {
      const r = await window.api.restoreConfirm(token);
      // Thành công ⇒ app thoát + mở lại; chỉ còn nhánh lỗi cần xử lý ở đây.
      if (r.status === "error") setPhase({ kind: "fatal", code: r.code });
    } catch {
      // Kênh IPC đứt vì app đang khởi động lại — bình thường.
    }
  }

  function submitPassword(): void {
    const value = pw;
    setPw("");
    void prepare(value);
  }

  return (
    <div
      className="nb-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vb-restore-title"
      data-testid="restore-dialog"
    >
      <div className="nb-modal vb-modal" ref={ref}>
        <h3 id="vb-restore-title">{t.t("backup.restore.title")}</h3>

        {phase.kind === "password" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pw) submitPassword();
            }}
          >
            <p className="vb-desc">{t.t("backup.restore.passwordProtected")}</p>
            <div className="nb-field-label">
              {t.t("backup.dialog.password")}
            </div>
            <input
              className="nb-input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              data-testid="restore-password"
            />
            {phase.error && (
              <div
                className="nb-error"
                role="alert"
                data-testid="restore-error"
              >
                {errorMessage(phase.error, t)}
              </div>
            )}
            <div className="nb-modal-actions">
              <button type="button" className="btn-sm" onClick={cancel}>
                {t.t("common.cancel")}
              </button>
              <button
                type="submit"
                className="btn-primary-sm"
                disabled={!pw}
                data-testid="restore-unlock"
              >
                {t.t("backup.restore.unlock")}
              </button>
            </div>
          </form>
        )}

        {phase.kind === "working" && (
          <div
            className="vb-progress"
            role="status"
            aria-live="polite"
            data-testid="restore-progress"
          >
            <span className="vb-spinner" aria-hidden="true" />
            {phase.step
              ? stepLabel(phase.step, t)
              : t.t("backup.restore.reading")}
          </div>
        )}

        {phase.kind === "summary" && (
          <>
            <dl className="vb-summary" data-testid="restore-summary">
              <dt>{t.t("backup.restore.createdAt")}</dt>
              <dd>
                {formatDateTime(Date.parse(phase.summary.createdAt), lang)}
              </dd>
              <dt>{t.t("backup.restore.contents")}</dt>
              <dd>
                {t.plural(
                  "backup.restore.notebookCount",
                  phase.summary.notebookCount,
                )}{" "}
                ·{" "}
                {t.plural(
                  "backup.restore.sourceCount",
                  phase.summary.sourceCount,
                )}
              </dd>
              <dt>{t.t("backup.restore.version")}</dt>
              <dd>SourceCraft {phase.summary.appVersion}</dd>
              <dt>{t.t("backup.restore.encryption")}</dt>
              <dd>
                {phase.summary.encrypted
                  ? t.t("backup.restore.encrypted")
                  : t.t("backup.restore.notEncrypted")}
              </dd>
            </dl>
            {phase.summary.needsReindex && (
              <p className="vb-hint">{t.t("backup.restore.needsReindex")}</p>
            )}
            <div
              className="vb-callout danger"
              data-testid="restore-overwrite-warning"
            >
              <strong>{t.t("backup.restore.overwriteStrong")}</strong>{" "}
              {t.t("backup.restore.overwriteBefore")} <code>backups</code>
              {t.t("backup.restore.overwriteAfter")}
            </div>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={cancel}
                data-testid="restore-cancel"
              >
                {t.t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => void confirm()}
                data-testid="restore-confirm"
              >
                {t.t("backup.restore.confirm")}
              </button>
            </div>
          </>
        )}

        {phase.kind === "fatal" && (
          <>
            <div className="nb-error" role="alert" data-testid="restore-error">
              {errorMessage(phase.code, t)}
            </div>
            <div className="nb-modal-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={cancel}
                autoFocus
              >
                {t.t("common.close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
