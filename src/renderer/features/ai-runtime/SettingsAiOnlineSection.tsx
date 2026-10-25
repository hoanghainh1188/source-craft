import type { RuntimeStatus } from "@shared/ipc/types";
import { runtimeReasonText } from "./runtime-reason";
import { useState } from "react";
import type { OnlineProviderId, OnlineProviderView } from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { useOnlineProviders } from "./useOnlineProviders";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";

// Khu vực "AI online (tùy chọn)" trong Cài đặt (031, prototype #s5). 3 hàng provider: trạng thái khóa (che),
// nhập/xoá khóa, chọn model (preset + "Khác"), bật/tắt độc quyền (confirm 1 lần khi bật), kiểm tra kết nối.
// Key CHỈ đi tới main (keytar) — không giữ ở state renderer ngoài ô nhập tạm.

const CUSTOM = "__custom__";

// 123: kết quả kiểm tra kết nối giữ dạng trạng thái + mã lý do từ main (dịch lúc render).
type TestState =
  | { kind: "testing" }
  | { kind: "ok" }
  | { kind: "failed"; status: RuntimeStatus | null };

export function SettingsAiOnlineSection(): JSX.Element {
  const t = useT();
  const { state, setKey, deleteKey, setModel, setActive, test } =
    useOnlineProviders();
  const [confirmId, setConfirmId] = useState<OnlineProviderId | null>(null);
  const [error, setError] = useState<ParsedIpcError | null>(null);

  const onError = (e: unknown): void => setError(toParsedError(e));

  const confirmProvider = state?.providers.find((p) => p.id === confirmId);
  // 228: chính sách IT forceLocalOnly — main đã chặn; UI khoá toggle/kiểm tra để không mời thao tác vô ích.
  const lockedBy = state?.cloudLockedBy ?? null;

  return (
    <section
      className="settings-ai settings-ai-online"
      data-testid="settings-ai-online"
    >
      <div className="settings-ai-head">
        <h3>{t.t("ai.online.title")}</h3>
        {state?.activeOnlineId && (
          <span className="tag warn" data-testid="online-active-tag">
            {t.t("ai.online.activeTag")}
          </span>
        )}
      </div>
      <p className="ai-note" data-testid="online-egress-note">
        {t.t("ai.online.egressNote")}
      </p>

      {lockedBy !== null && (
        <p
          className="ai-note ai-error"
          data-testid="online-policy-lock"
          role="note"
        >
          {t.t("errors.policyCloudDisabled", { org: lockedBy })}
        </p>
      )}

      {error && (
        <div
          className="ai-note ai-error"
          data-testid="online-error"
          role="alert"
        >
          {describeIpcError(error, t)}
        </div>
      )}

      {(state?.providers ?? []).map((p) => (
        <ProviderRow
          key={p.id}
          view={p}
          locked={lockedBy !== null}
          onSaveKey={(k) => setKey(p.id, k).catch(onError)}
          onDeleteKey={() => deleteKey(p.id).catch(onError)}
          onSetModel={(m) => setModel(p.id, m).catch(onError)}
          onRequestActivate={() => {
            setError(null);
            setConfirmId(p.id);
          }}
          onDeactivate={() => setActive(null).catch(onError)}
          onTest={() => test(p.id)}
        />
      ))}

      {confirmProvider && lockedBy === null && (
        <div
          className="online-confirm"
          role="alertdialog"
          data-testid="online-confirm"
        >
          <p>
            {t.t("ai.online.confirmBefore")}{" "}
            <strong>{confirmProvider.label}</strong>
            {t.t("ai.online.confirmAfter")}
          </p>
          <div className="online-confirm-actions">
            <button
              type="button"
              className="btn-sm"
              onClick={() => setConfirmId(null)}
              data-testid="online-confirm-cancel"
            >
              {t.t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-sm btn-primary"
              data-testid="online-confirm-ok"
              onClick={() => {
                const id = confirmProvider.id;
                setConfirmId(null);
                setActive(id).catch(onError);
              }}
            >
              {t.t("ai.online.confirmOk")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ProviderRow({
  view,
  locked,
  onSaveKey,
  onDeleteKey,
  onSetModel,
  onRequestActivate,
  onDeactivate,
  onTest,
}: {
  view: OnlineProviderView;
  locked: boolean;
  onSaveKey: (key: string) => void;
  onDeleteKey: () => void;
  onSetModel: (model: string | null) => void;
  onRequestActivate: () => void;
  onDeactivate: () => void;
  onTest: () => Promise<RuntimeStatus>;
}): JSX.Element {
  const t = useT();
  const [draftKey, setDraftKey] = useState("");
  const [testState, setTestState] = useState<TestState | null>(null);
  const isCustom = view.model !== null && !view.presets.includes(view.model);
  const [customMode, setCustomMode] = useState(isCustom);

  return (
    <div className="online-row" data-testid={`online-row-${view.id}`}>
      <div className="online-row-head">
        <strong>{view.label}</strong>
        <span
          className={`tag ${view.hasKey ? "ok" : "warn"}`}
          data-testid={`online-key-status-${view.id}`}
        >
          {view.hasKey
            ? t.t("ai.online.keySaved")
            : t.t("ai.online.keyMissing")}
        </span>
        <label className="online-toggle">
          <input
            type="checkbox"
            checked={view.active}
            disabled={locked || (!view.hasKey && !view.active)}
            data-testid={`online-toggle-${view.id}`}
            onChange={(e) =>
              e.target.checked ? onRequestActivate() : onDeactivate()
            }
          />
          <span>{t.t("ai.online.use")}</span>
        </label>
      </div>

      <div className="online-row-body">
        <div className="online-key-input">
          <input
            type="password"
            placeholder={
              view.hasKey
                ? t.t("ai.online.keyPlaceholderReplace")
                : t.t("ai.online.keyPlaceholder")
            }
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            data-testid={`online-key-input-${view.id}`}
          />
          <button
            type="button"
            className="btn-sm"
            disabled={draftKey.trim() === ""}
            data-testid={`online-key-save-${view.id}`}
            onClick={() => {
              onSaveKey(draftKey.trim());
              setDraftKey("");
            }}
          >
            {t.t("common.save")}
          </button>
          {view.hasKey && (
            <button
              type="button"
              className="btn-sm"
              data-testid={`online-key-delete-${view.id}`}
              onClick={onDeleteKey}
            >
              {t.t("common.delete")}
            </button>
          )}
        </div>

        <div className="online-model">
          <select
            value={customMode ? CUSTOM : (view.model ?? "")}
            data-testid={`online-model-${view.id}`}
            onChange={(e) => {
              if (e.target.value === CUSTOM) {
                setCustomMode(true);
              } else {
                setCustomMode(false);
                onSetModel(e.target.value || null);
              }
            }}
          >
            <option value="">{t.t("ai.online.modelPlaceholder")}</option>
            {view.presets.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={CUSTOM}>{t.t("ai.online.modelCustom")}</option>
          </select>
          {customMode && (
            <input
              type="text"
              placeholder={t.t("ai.online.modelNamePlaceholder")}
              defaultValue={view.model ?? ""}
              data-testid={`online-model-custom-${view.id}`}
              onBlur={(e) => onSetModel(e.target.value.trim() || null)}
            />
          )}
          <button
            type="button"
            className="btn-sm"
            disabled={locked}
            data-testid={`online-test-${view.id}`}
            onClick={() => {
              setTestState({ kind: "testing" });
              onTest()
                .then((s) =>
                  setTestState(
                    s.reachable
                      ? { kind: "ok" }
                      : { kind: "failed", status: s },
                  ),
                )
                .catch(() => setTestState({ kind: "failed", status: null }));
            }}
          >
            {t.t("ai.testConnection")}
          </button>
        </div>
        {testState && (
          <span
            className="online-test-msg"
            data-testid={`online-test-msg-${view.id}`}
          >
            {testState.kind === "testing"
              ? t.t("ai.online.testing")
              : testState.kind === "ok"
                ? t.t("ai.online.testOk")
                : ((testState.status &&
                    runtimeReasonText(testState.status, t)) ??
                  t.t("ai.online.testFailed"))}
          </span>
        )}
      </div>
    </div>
  );
}
