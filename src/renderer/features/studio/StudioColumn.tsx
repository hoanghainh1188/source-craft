import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { AiTarget, Citation, StudioKind } from "@shared/ipc/types";
import { useStudio } from "./useStudio";
import { StudioResultCard } from "./StudioResultCard";
import { StudioProgress } from "./StudioProgress";
import { StudioCancel } from "./StudioCancel";
import { StudioVersionPicker } from "./StudioVersionPicker";
import { StudioCustomRequest } from "./StudioCustomRequest";
import { StudioScopePicker } from "./StudioScopePicker";
import { StudioStreamPreview } from "./StudioStreamPreview";
import { pruneScope } from "./scope-prune";
import { cancelFocusTarget } from "./studio-generation";
import { studioCancelledMessage } from "../../shared/a11y/messages";
import {
  progressAnnouncement,
  type StudioProgressMap,
} from "./studio-progress";
import { announce } from "../../shared/a11y/announcer";
import { studioMessage } from "../../shared/a11y/messages";
import { useT } from "../../shared/i18n/i18n-context";
import { describeIpcError } from "../../shared/i18n/describe-error";
import { UpgradePrompt } from "../license-upsell/UpgradePrompt";
import "./studio.css";

// Cột Studio (prototype S2, cột 3). Nút "Tạo nhanh" (178: 8 loại, lưới 2×4) → sinh bản tổng hợp toàn notebook. Nút vô hiệu khi
// chưa có nguồn ready hoặc model chưa sẵn sàng (FR-010/011). Kết quả hiển thị card + chip [n] (kiểm chứng).

// 123: nhãn loại lấy từ MỘT chỗ — khoá `studio.kind.<kind>` (dịch lúc render).
// 178 (FR-014): thứ tự hiển thị = thứ tự Tab — 4 loại cũ rồi 4 loại mới.
const KINDS: readonly StudioKind[] = [
  "summary",
  "keyPoints",
  "faq",
  "outline",
  "studyGuide",
  "briefing",
  "timeline",
  "keyTerms",
];
// 178 (PR 3): loại có thẻ kết quả = 8 loại có nút + "custom" (nhập ở hàng riêng dưới lưới).
const RESULT_KINDS: readonly StudioKind[] = [...KINDS, "custom"];

/** Nút "khởi tạo" của một loại (đích focus): nút loại, hoặc nút Tạo của hàng yêu cầu tuỳ chỉnh. */
const startSelector = (kind: StudioKind): string =>
  kind === "custom"
    ? "[data-testid=studio-custom-submit]"
    : `[data-testid=studio-btn-${kind}]`;

interface StudioColumnProps {
  notebookId: string;
  onCite?: (c: Citation) => void;
}

export function StudioColumn({
  notebookId,
  onCite,
}: StudioColumnProps): JSX.Element {
  const {
    results,
    versions,
    select,
    deleteVersion,
    loading,
    errors,
    onlineFailed,
    progress,
    streamText,
    cancelling,
    generate,
    cancel,
    ollamaReady,
    hasReadySources,
    readySources,
    sources,
  } = useStudio(notebookId);
  const t = useT();
  // 123: translator HIỆN TẠI cho câu báo xong (về sau await — người dùng có thể đã đổi ngôn ngữ).
  const trRef = useRef(t);
  trRef.current = t;
  // 146 (clarify #5): báo trình đọc màn hình khi tiến độ của một loại đổi pha / tới mốc giữa (polite, có tên loại).
  const prevProgress = useRef<StudioProgressMap>({});
  useEffect(() => {
    const tr = trRef.current;
    for (const kind of RESULT_KINDS) {
      const next = progress[kind];
      const prev = prevProgress.current[kind];
      if (next && next !== prev) {
        const msg = progressAnnouncement(
          prev,
          next,
          tr.t(`studio.kind.${kind}`),
          tr,
        );
        if (msg) announce(msg);
      }
    }
    prevProgress.current = progress;
  }, [progress]);
  // Phạm vi tổng hợp (178 PR 4): [] = tất cả nguồn; else các id được chọn. Đổi notebook ⇒ về "tất cả".
  // Review: nguồn đã chọn hết ready ⇒ bỏ khỏi phạm vi VÀ báo trình đọc màn hình (bộ chọn hiện phạm vi mới) — không nới âm thầm.
  const [scope, setScope] = useState<readonly string[]>([]);
  useEffect(() => setScope([]), [notebookId]);
  useEffect(() => {
    const next = pruneScope(scope, readySources);
    if (next === scope) return;
    setScope(next);
    announce(trRef.current.t("studio.scope.changed"));
  }, [scope, readySources]);
  const knownSourceIds = useMemo(
    () => new Set(sources.map((s) => s.id)),
    [sources],
  );

  const blockReason =
    ollamaReady === false
      ? t.t("studio.blockModel")
      : !hasReadySources
        ? t.t("studio.blockNoSources")
        : null;
  const disabled = blockReason !== null;
  // 098: khối lỗi (chứa nút vừa bấm) biến mất khi tạo lại ⇒ đưa focus về tiêu đề cột Studio.
  const titleRef = useRef<HTMLHeadingElement>(null);

  // 091: báo trình đọc màn hình lúc bắt đầu/xong (Studio chờ trọn kết quả — có thể mất vài chục giây).
  // 098: target "local" = tạo lại bằng AI cục bộ sau lỗi online (nút trong khối lỗi).
  // 149: vùng cột — tìm nút để trả focus sau khi huỷ (nút Huỷ biến mất).
  const colRef = useRef<HTMLElement>(null);
  // 149: loại có nút Huỷ đang giữ focus lúc bấm ⇒ sau khi huỷ mới trả focus (không cướp focus nếu người dùng đã đi nơi khác).
  const cancelFocused = useRef<Partial<Record<StudioKind, HTMLElement>>>({});

  const onCancel = (kind: StudioKind, el: HTMLElement | null): void => {
    if (el && document.activeElement === el) cancelFocused.current[kind] = el;
    cancel(kind);
  };

  // 149 (review B1): trả focus SAU KHI React commit trạng thái nghỉ (nút đích hết disabled, nút Huỷ đã gỡ) — không dựa vào microtask.
  const [pendingFocus, setPendingFocus] = useState<StudioKind | null>(null);
  useEffect(() => {
    if (!pendingFocus || loading[pendingFocus]) return;
    const kind = pendingFocus;
    setPendingFocus(null);
    // Nút Huỷ đã gỡ ⇒ focus rơi về body; người dùng đã sang chỗ khác ⇒ không cướp focus.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const target =
      cancelFocusTarget(results[kind] !== undefined) === "regenerate"
        ? `[data-testid=studio-regen-${kind}]`
        : startSelector(kind);
    colRef.current?.querySelector<HTMLElement>(target)?.focus();
  }, [pendingFocus, loading, results]);

  // 178: xoá phiên bản cuối của loại ⇒ thẻ biến mất ⇒ focus về nút loại (đang tạo ⇒ nút bị khoá ⇒ về tiêu đề cột).
  const focusKind = (kind: StudioKind): void => {
    const btn = colRef.current?.querySelector<HTMLButtonElement>(
      startSelector(kind),
    );
    if (btn && !btn.disabled) btn.focus();
    else titleRef.current?.focus();
  };

  // 091: báo trình đọc màn hình lúc bắt đầu/xong (Studio chờ trọn kết quả — có thể mất vài chục giây).
  // 098: target "local" = tạo lại bằng AI cục bộ sau lỗi online (nút trong khối lỗi).
  // 149: kết cục "cancelled" ⇒ câu huỷ + trả focus; "stale" ⇒ im lặng (lượt đã bị thay / rời notebook).
  // 178 (review B1): yêu cầu của LƯỢT custom gần nhất (gửi từ ô nhập HAY "Tạo lại" một phiên bản) — "Thử lại" / "Tạo bằng AI
  // cục bộ" trong khối lỗi dùng đúng yêu cầu của lượt vừa lỗi. Xoá khi đổi notebook (không mang nội dung sang notebook khác).
  const lastCustom = useRef<string | undefined>(undefined);
  // 178 (PR 4, review): phạm vi của LƯỢT gần nhất theo loại — "Thử lại" / "Tạo bằng AI cục bộ" dùng đúng phạm vi lượt vừa lỗi.
  const lastScope = useRef<Partial<Record<StudioKind, readonly string[]>>>({});
  useEffect(() => {
    lastCustom.current = undefined;
    lastScope.current = {};
  }, [notebookId]);
  /**
   * `sourceIds`: nút loại / ô yêu cầu ⇒ phạm vi bộ chọn; "Tạo lại" ⇒ phạm vi của phiên bản đang xem; thiếu (Thử lại / AI cục bộ)
   * ⇒ phạm vi của lượt gần nhất của loại (chưa có ⇒ bộ chọn).
   */
  const run = async (
    kind: StudioKind,
    target?: AiTarget,
    customPrompt: string | undefined = kind === "custom"
      ? lastCustom.current
      : undefined,
    sourceIds: readonly string[] = lastScope.current[kind] ?? scope,
  ): Promise<void> => {
    if (kind === "custom") lastCustom.current = customPrompt;
    lastScope.current = { ...lastScope.current, [kind]: sourceIds };
    const tr = trRef.current;
    announce(studioMessage(tr.t(`studio.kind.${kind}`), "start", tr));
    const outcome = await generate(kind, {
      sourceIds,
      target,
      customPrompt,
    });
    const now = trRef.current;
    const label = now.t(`studio.kind.${kind}`);
    // Review N1: ý định trả focus chỉ dùng cho đúng lần huỷ này — mọi kết cục đều dọn.
    const hadFocus = cancelFocused.current[kind] !== undefined;
    delete cancelFocused.current[kind];
    if (outcome === "done") {
      announce(studioMessage(label, "done", now));
    } else if (outcome === "cancelled") {
      announce(studioCancelledMessage(label, now));
      if (hadFocus) setPendingFocus(kind);
    }
  };

  return (
    <section
      ref={colRef}
      className="studio-col"
      aria-label={t.t("studio.title")}
      data-testid="studio-col"
    >
      <h2 className="studio-title" ref={titleRef} tabIndex={-1}>
        {t.t("studio.title")}
      </h2>
      <p className="col-hint">{t.t("studio.hint")}</p>

      {blockReason && (
        <p className="studio-block" data-testid="studio-block">
          {blockReason}
        </p>
      )}

      <StudioScopePicker
        sources={readySources}
        selected={scope}
        onChange={setScope}
      />

      <div className="studio-actions">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="studio-btn"
            onClick={() => void run(kind, undefined, undefined, scope)}
            disabled={disabled || loading[kind] === true}
            data-testid={`studio-btn-${kind}`}
          >
            {loading[kind]
              ? t.t("studio.creating")
              : t.t(`studio.kind.${kind}`)}
          </button>
        ))}
      </div>

      <StudioCustomRequest
        // 178 (review N1): nháp gắn với notebook — đổi notebook ⇒ ô trống.
        key={notebookId}
        loading={loading.custom === true}
        disabled={disabled}
        onSubmit={(text) => void run("custom", undefined, text, scope)}
      />

      <div className="studio-results">
        {RESULT_KINDS.map((kind) => {
          const label = t.t(`studio.kind.${kind}`);
          const err = errors[kind];
          const res = results[kind];
          const prog = loading[kind] ? progress[kind] : undefined;
          // 178 (PR 4): chữ tạm của lượt viết cuối — dưới dòng tiến độ, TRÊN phiên bản đang xem (khi Tạo lại).
          const live = loading[kind] ? streamText[kind] : undefined;
          const preview = live ? (
            <StudioStreamPreview kind={kind} text={live} />
          ) : null;
          // 146: đang tạo lần đầu và đã có tiến độ ⇒ dòng pha + thanh thay skeleton.
          // 149: nút Huỷ mỗi khi loại đang tạo — cùng hàng dòng pha / khung chờ / trên card cũ.
          const cancelBtn = loading[kind] ? (
            <StudioCancel
              kind={kind}
              cancelling={cancelling[kind] === true}
              onCancel={() =>
                onCancel(
                  kind,
                  colRef.current?.querySelector<HTMLElement>(
                    `[data-testid=studio-cancel-${kind}]`,
                  ) ?? null,
                )
              }
            />
          ) : null;
          if (prog && !res) {
            return (
              <Fragment key={kind}>
                <StudioProgress
                  kind={kind}
                  progress={prog}
                  action={cancelBtn}
                />
                {preview}
              </Fragment>
            );
          }
          // Skeleton khi đang tạo lần đầu (chưa có kết quả cũ, chưa có tiến độ) — US3.
          if (loading[kind] && !res) {
            return (
              <div key={kind} className="studio-running">
                {/* 149: nút Huỷ NGOÀI khung chờ (khung chờ aria-hidden) — có ngay trước sự kiện tiến độ đầu. */}
                <div className="studio-progress-head">{cancelBtn}</div>
                <div
                  className="studio-skeleton"
                  data-testid={`studio-skeleton-${kind}`}
                  aria-hidden="true"
                >
                  <span className="sk-line" />
                  <span className="sk-line" />
                  <span className="sk-line short" />
                </div>
              </div>
            );
          }
          if (err) {
            return (
              <div
                key={kind}
                className="studio-error"
                data-testid={`studio-error-${kind}`}
              >
                <p role="alert">{describeIpcError(err, t)}</p>
                <UpgradePrompt error={err} />
                {/* 098: lỗi AI online ⇒ người dùng chọn tạo bằng AI cục bộ cho lượt này, hoặc thử lại. */}
                {onlineFailed[kind] && (
                  <div className="fallback-actions">
                    <button
                      type="button"
                      className="btn-primary-sm"
                      aria-label={t.t("studio.localRetryAria", { kind: label })}
                      onClick={() => {
                        titleRef.current?.focus();
                        void run(kind, "local");
                      }}
                      data-testid={`studio-local-retry-${kind}`}
                    >
                      {t.t("studio.localRetry")}
                    </button>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      aria-label={t.t("studio.retryAria", { kind: label })}
                      onClick={() => {
                        titleRef.current?.focus();
                        void run(kind);
                      }}
                      data-testid={`studio-retry-${kind}`}
                    >
                      {t.t("common.retry")}
                    </button>
                  </div>
                )}
              </div>
            );
          }
          if (!res) return null;
          return (
            <Fragment key={kind}>
              {/* 146: đang Tạo lại ⇒ tiến độ nằm trên card cũ (card vẫn đọc được). */}
              {prog ? (
                <StudioProgress
                  kind={kind}
                  progress={prog}
                  onCard
                  action={cancelBtn}
                />
              ) : (
                cancelBtn && (
                  <div className="studio-progress-head on-card">
                    {cancelBtn}
                  </div>
                )
              )}
              {preview}
              <StudioResultCard
                result={res}
                regenerating={loading[kind] === true}
                onRegenerate={() =>
                  // 178: custom ⇒ tạo lại với yêu cầu của PHIÊN BẢN ĐANG XEM.
                  // 178 (PR 4): … và PHẠM VI của phiên bản đang xem (thiếu = mọi nguồn). Nguồn đã xoá ⇒ main từ chối rõ.
                  void run(
                    kind,
                    undefined,
                    res.customPrompt,
                    res.sourceIds ?? [],
                  )
                }
                onCite={onCite}
                knownSourceIds={knownSourceIds}
                versionPicker={
                  <StudioVersionPicker
                    kind={kind}
                    versions={versions[kind] ?? [res]}
                    currentId={res.id}
                    onSelect={(id) => select(kind, id)}
                    onDelete={(id) => deleteVersion(kind, id)}
                    onEmptied={() => focusKind(kind)}
                  />
                }
              />
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
