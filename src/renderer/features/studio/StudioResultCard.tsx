import { useState, type ReactNode } from "react";
import type { Citation, ExportFormat, StudioResult } from "@shared/ipc/types";
import { isoDate } from "@shared/i18n";
import { parseIpcError, type ParsedIpcError } from "@shared/online-error-tag";
import { formatCitationLabel } from "../rag-qa/citation-format";
import { MarkdownContent } from "../../shared/markdown/MarkdownContent";
import { useT } from "../../shared/i18n/i18n-context";
import { isUpsellCode } from "../license-upsell/upsell-codes";
import { UpgradePrompt } from "../license-upsell/UpgradePrompt";

// Card kết quả Studio. Render MARKDOWN an toàn + chip [n] (029, React node — KHÔNG innerHTML). Bấm chip →
// onCite (mở Source Viewer 019). Ghi chú khi truncated. 123: nhãn loại = khoá `studio.kind.<kind>`.
// 178: `result` là PHIÊN BẢN đang xem — Copy / Export / chip / ghi chú / nhãn AI cục bộ đều theo phiên bản này.

// 123: thông báo chớp lưu KHOÁ (không lưu chuỗi đã dịch).
type NoticeKey = "copyFailed" | "exported" | "exportFailed";

interface StudioResultCardProps {
  result: StudioResult;
  regenerating: boolean;
  onRegenerate: () => void;
  onCite?: (c: Citation) => void;
  /** 178: bộ chọn / xoá phiên bản (đặt dưới tiêu đề thẻ). */
  versionPicker?: ReactNode;
  /** 178 (PR 4): id nguồn hiện còn trong notebook — id của phiên bản không có ở đây ⇒ "nguồn đã xoá". */
  knownSourceIds?: ReadonlySet<string>;
}

/** "Phạm vi: N nguồn" (+ " · K nguồn đã xoá" khi biết danh sách nguồn hiện có). */
function scopeNote(
  ids: readonly string[],
  known: ReadonlySet<string> | undefined,
  t: ReturnType<typeof useT>,
): string {
  const base = t.plural("studio.scope.versionCount", ids.length);
  const deleted = known ? ids.filter((id) => !known.has(id)).length : 0;
  return deleted > 0
    ? `${base} · ${t.plural("studio.scope.deletedSource", deleted)}`
    : base;
}

export function StudioResultCard({
  result,
  regenerating,
  onRegenerate,
  onCite,
  versionPicker,
  knownSourceIds,
}: StudioResultCardProps): JSX.Element {
  // 098 + 178: nhãn AI cục bộ lưu cùng phiên bản (main ghi khi target local).
  const local = result.local === true;
  const t = useT();
  const kindLabel = t.t(`studio.kind.${result.kind}`);
  const citeByN = new Map(result.citations.map((c) => [c.n, c]));
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<NoticeKey | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportError, setExportError] = useState<ParsedIpcError | null>(null);

  const flash = (key: NoticeKey): void => {
    setNotice(key);
    setTimeout(() => setNotice(null), 2000);
  };

  const onCopy = async (): Promise<void> => {
    try {
      // Ghi clipboard qua main (#67): navigator.clipboard bị chặn ở renderer sandbox (permission +
      // file:// không phải secure context ở bản đóng gói).
      await window.api.clipboardWrite(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      flash("copyFailed");
    }
  };

  const onExport = async (format: ExportFormat = "md"): Promise<void> => {
    setShowExportMenu(false);
    setExportError(null);
    try {
      const res = await window.api.studioExport({
        content: result.content,
        notebookId: result.notebookId,
        studioKind: result.kind,
        suggestedName: t.t("studio.exportName", {
          kind: kindLabel,
          date: isoDate(result.createdAt),
        }),
        format,
        options: {
          title: kindLabel,
          includeCoverPage: true,
          includeTableOfContents: true,
        },
      });
      if (res.saved) flash("exported");
    } catch (err: unknown) {
      const parsed = parseIpcError(
        err instanceof Error ? err.message : String(err),
      );
      if (isUpsellCode(parsed.code)) {
        setExportError(parsed);
      } else {
        flash("exportFailed");
      }
    }
  };

  return (
    <article className="studio-card" data-testid={`studio-card-${result.kind}`}>
      <header className="studio-card-head">
        <h3 className="studio-card-title">
          {kindLabel}
          {local && (
            <span
              className="local-answer"
              data-testid={`studio-local-${result.kind}`}
              title={t.t("studio.localBadgeTitle")}
            >
              {t.t("studio.localBadge")}
            </span>
          )}
        </h3>
        <div className="studio-card-actions">
          <button
            type="button"
            className="studio-cardbtn"
            onClick={() => void onCopy()}
            data-testid={`studio-copy-${result.kind}`}
          >
            {copied ? t.t("common.copied") : t.t("common.copy")}
          </button>
          <div style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="studio-cardbtn"
              onClick={() => setShowExportMenu((prev) => !prev)}
              data-testid={`studio-export-${result.kind}`}
              aria-expanded={showExportMenu}
            >
              {t.t("chat.actions.export")} ▾
            </button>
            {showExportMenu && (
              <div
                className="studio-export-menu"
                data-testid={`studio-export-menu-${result.kind}`}
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  zIndex: 50,
                  backgroundColor: "var(--color-bg, #ffffff)",
                  border: "1px solid var(--color-border, #cbd5e1)",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  minWidth: "160px",
                  padding: "4px",
                }}
              >
                <button
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                  onClick={() => void onExport("md")}
                  data-testid={`studio-export-md-${result.kind}`}
                >
                  {t.t("studio.exportFormats.md")}
                </button>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                  onClick={() => void onExport("docx")}
                  data-testid={`studio-export-docx-${result.kind}`}
                >
                  <span>{t.t("studio.exportFormats.docx")}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      color: "#b45309",
                      padding: "1px 4px",
                      borderRadius: "3px",
                    }}
                  >
                    PRO
                  </span>
                </button>
                <button
                  type="button"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 10px",
                    fontSize: "12px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderRadius: "4px",
                  }}
                  onClick={() => void onExport("pdf")}
                  data-testid={`studio-export-pdf-${result.kind}`}
                >
                  <span>{t.t("studio.exportFormats.pdf")}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      color: "#b45309",
                      padding: "1px 4px",
                      borderRadius: "3px",
                    }}
                  >
                    PRO
                  </span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="studio-regen"
            onClick={onRegenerate}
            disabled={regenerating}
            data-testid={`studio-regen-${result.kind}`}
          >
            {regenerating ? t.t("studio.creating") : t.t("studio.regenerate")}
          </button>
        </div>
      </header>
      {exportError && <UpgradePrompt error={exportError} />}
      {versionPicker}
      {/* 178 (FR-024): yêu cầu tuỳ chỉnh của phiên bản — text node (React tự thoát), KHÔNG markdown / HTML. */}
      {result.customPrompt && (
        <p
          className="studio-request"
          data-testid={`studio-request-${result.kind}`}
        >
          <span className="studio-request-label">
            {t.t("studio.custom.requestHeading")}:
          </span>{" "}
          {result.customPrompt}
        </p>
      )}
      {/* 178 (PR 4, FR-033): phạm vi nguồn của phiên bản — vẫn hiển thị khi nguồn đã bị xoá. */}
      {result.sourceIds && result.sourceIds.length > 0 && (
        <p
          className="studio-scope-note"
          data-testid={`studio-scope-note-${result.kind}`}
        >
          {scopeNote(result.sourceIds, knownSourceIds, t)}
        </p>
      )}
      {/* 233 (FR-008, D7): Ghi chú pháp lý cố định cho kết quả so sánh văn bản */}
      {result.kind === "documentDiff" && (
        <p
          className="studio-diff-disclaimer"
          data-testid="studio-diff-disclaimer"
        >
          {t.t("studio.diff.disclaimer")}
        </p>
      )}
      {notice && (
        <p
          className="studio-notice"
          data-testid={`studio-notice-${result.kind}`}
        >
          {t.t(`chat.actions.${notice}`)}
        </p>
      )}
      <div className="studio-card-body">
        <MarkdownContent
          content={result.content}
          citeByN={citeByN}
          onCite={onCite}
        />
      </div>
      {/* 105: tổng hợp nhiều phần (map-reduce) — chip [n] vẫn trỏ đúng đoạn nguồn (ADR studio-large-clarify). */}
      {(result.parts ?? 1) > 1 && (
        <p className="studio-truncated" data-testid="studio-parts">
          {t.plural("studio.parts", result.parts ?? 1)}
        </p>
      )}
      {result.truncated && (
        <p className="studio-truncated" data-testid="studio-truncated">
          {t.t("studio.truncated")}
        </p>
      )}
      {result.citations.length > 0 && (
        <div
          className="studio-srcnote"
          data-testid={`studio-srcnote-${result.kind}`}
        >
          <span className="studio-srcnote-label">
            {t.t("chat.sourcesLabel")}
          </span>
          {result.citations.map((c) => (
            <span key={c.n} className="studio-srcnote-item">
              {formatCitationLabel(c, t)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
