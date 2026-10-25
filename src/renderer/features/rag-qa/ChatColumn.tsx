import { useEffect, useRef, useState } from "react";
import type { Citation } from "@shared/ipc/types";
import { describeChatError, useChat } from "./useChat";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle, MODE_HINTS } from "./ModeToggle";
import { ScopeToggle } from "./ScopeToggle";
import { CROSS_SEARCH_UPSELL, useScopeGate } from "./useScopeGate";
import { DomainToggle } from "./DomainToggle";
import { SPECIALIST_MODES_UPSELL, useDomainGate } from "./useDomainGate";
import { UpgradePrompt } from "../license-upsell/UpgradePrompt";
import { IconSend } from "../../shared/icons";
import { useT } from "../../shared/i18n/i18n-context";

// Cột Chat của Workspace (prototype S2 cột giữa). 013-rag-qa + đánh bóng 023-ui-polish (composer .cbox +
// model chip + nút gửi icon + skeleton). `onCite` (019): bấm chip [n] → mở trình xem nguồn.
// Model chip CHỈ hiển thị (đọc aiGetSelectedModels) — KHÔNG đổi logic gửi (useChat/send giữ nguyên).
export function ChatColumn({
  notebookId,
  onCite,
}: {
  notebookId: string;
  onCite?: (c: Citation) => void;
}): JSX.Element {
  const {
    messages,
    mode,
    setMode,
    scope,
    setScope,
    domainMode,
    setDomainMode,
    loading,
    error,
    failedTurn,
    retryFailed,
    runtimeReady,
    runtimeBlockKey,
    hasReadySources,
    canSend,
    streamingId,
    send,
    stop,
    clearHistory,
  } = useChat(notebookId);
  // 231: gói Free ⇒ khoá "Toàn bộ kho" + mời nâng cấp ngay tại composer.
  const scopeGate = useScopeGate(scope, setScope);
  // 238: gói Free ⇒ khoá Chế độ Chuyên gia (Pháp lý / Y tế) + mời nâng cấp.
  const domainGate = useDomainGate(domainMode, setDomainMode);
  const t = useT();
  const [draft, setDraft] = useState("");
  // 098: khối lỗi (chứa nút vừa bấm) biến mất khi hỏi lại ⇒ đưa focus về vùng hội thoại, không để rơi ra <body>.
  const threadRef = useRef<HTMLDivElement>(null);
  const retry = (target: "local" | "active"): void => {
    threadRef.current?.focus();
    void retryFailed(target);
  };
  const [chatModel, setChatModel] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .aiGetSelectedModels()
      .then((s) => setChatModel(s.chatModel))
      .catch(() => setChatModel(null));
  }, [runtimeReady]);

  const submit = (): void => {
    if (!canSend || draft.trim() === "") return;
    void send(draft);
    setDraft("");
  };

  const blockReason = runtimeBlockKey
    ? t.t(runtimeBlockKey)
    : !hasReadySources
      ? t.t("chat.blockNoSources")
      : null;

  return (
    <section
      className="chat-col"
      aria-label={t.t("chat.title")}
      data-testid="chat-column"
    >
      <header className="chat-head">
        <h2>{t.t("chat.title")}</h2>
        {messages.length > 0 && (
          <button
            type="button"
            className="chat-clear"
            onClick={clearHistory}
            data-testid="chat-clear"
          >
            {t.t("chat.clear")}
          </button>
        )}
      </header>

      <div
        className="chat-thread"
        data-testid="chat-thread"
        ref={threadRef}
        tabIndex={-1}
        aria-label={t.t("chat.threadLabel")}
      >
        {messages.length === 0 && !loading && (
          <p className="chat-empty">{t.t("chat.empty")}</p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} onCite={onCite} />
        ))}
        {loading && !streamingId && (
          <div
            className="bubble-skeleton"
            data-testid="chat-skeleton"
            aria-hidden="true"
          >
            <span className="sk-line" />
            <span className="sk-line short" />
          </div>
        )}
      </div>

      {error && (
        <div className="form-error chat-error">
          <p role="alert">{describeChatError(error, t)}</p>
          {/* 237/231: main từ chối vì bản quyền (vd gửi "all" khi trạng thái chưa kịp đọc) ⇒ mời nâng cấp. */}
          {error.kind === "ipc" && <UpgradePrompt error={error.error} />}
          {/* 098 (ADR online-fallback-clarify): lỗi AI online ⇒ người dùng CHỌN trả lời lượt này bằng AI cục bộ
              hoặc thử lại — không tự đổi provider. */}
          {failedTurn && (
            <div className="fallback-actions">
              <button
                type="button"
                className="btn-primary-sm"
                disabled={loading}
                onClick={() => retry("local")}
                data-testid="chat-local-retry"
              >
                {t.t("chat.localRetry")}
              </button>
              <button
                type="button"
                className="btn-outline-sm"
                disabled={loading}
                onClick={() => retry("active")}
                data-testid="chat-retry"
              >
                {t.t("common.retry")}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="chat-composer">
        {blockReason ? (
          <p className="chat-block" data-testid="chat-block">
            {blockReason}
          </p>
        ) : (
          <>
            <div className="cbox">
              <textarea
                className="composer-input"
                placeholder={t.t("chat.placeholder")}
                value={draft}
                maxLength={2000}
                rows={2}
                disabled={!canSend}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                data-testid="chat-input"
              />
              <div className="cbar">
                <ModeToggle mode={mode} onChange={setMode} disabled={loading} />
                <ScopeToggle
                  scope={scope}
                  onChange={scopeGate.changeScope}
                  disabled={loading}
                  locked={scopeGate.locked}
                  onLockedClick={scopeGate.showUpsell}
                />
                <DomainToggle
                  domainMode={domainMode}
                  onChange={domainGate.changeDomain}
                  disabled={loading}
                  locked={domainGate.locked}
                  onLockedClick={domainGate.showUpsell}
                />
                <span
                  className="model-chip"
                  title={t.t("chat.modelChipTitle")}
                  data-testid="composer-model"
                >
                  {t.t("chat.modelChip", {
                    model: chatModel ?? t.t("chat.modelNone"),
                  })}
                </span>
                {streamingId ? (
                  <button
                    type="button"
                    className="send-btn stop-btn"
                    onClick={stop}
                    aria-label={t.t("chat.stop")}
                    data-testid="chat-stop"
                  >
                    <span className="stop-square" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="send-btn"
                    onClick={submit}
                    disabled={!canSend || draft.trim() === ""}
                    aria-label={t.t("chat.send")}
                    data-testid="chat-send"
                  >
                    <IconSend size={16} />
                  </button>
                )}
              </div>
            </div>
            {scopeGate.upsellVisible && (
              <UpgradePrompt error={CROSS_SEARCH_UPSELL} />
            )}
            {domainGate.upsellVisible && (
              <UpgradePrompt error={SPECIALIST_MODES_UPSELL} />
            )}
            <p className="modehint" data-testid="mode-hint">
              {t.t(MODE_HINTS[mode])}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
