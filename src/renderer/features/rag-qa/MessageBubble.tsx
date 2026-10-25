import { useState } from "react";
import type { Citation } from "@shared/ipc/types";
import { isoDate } from "@shared/i18n";
import { formatCitationLabel, formatAnswerMarkdown } from "./citation-format";
import { MarkdownContent } from "../../shared/markdown/MarkdownContent";
import type { ChatMessage } from "./useChat";
import { useT } from "../../shared/i18n/i18n-context";

// 123: thông báo chớp lưu KHOÁ (không lưu chuỗi đã dịch) ⇒ đổi ngôn ngữ thì thông báo cũng đổi.
type NoticeKey = "copyFailed" | "exported" | "exportFailed";

// Bong bóng hội thoại (prototype S2). Trả lời AI: render MARKDOWN an toàn + chip [n] (029). Tin người dùng
// giữ text thuần. Bấm chip → mở Source Viewer (019). onCite optional. 072: Copy/Export câu trả lời kèm nguồn.

export function MessageBubble({
  message,
  onCite,
  notebookId,
}: {
  message: ChatMessage;
  onCite?: (c: Citation) => void;
  /** 236: ngữ cảnh cho bản ghi kiểm toán khi xuất (main tra tên sổ tay, không tin renderer). */
  notebookId?: string;
}): JSX.Element {
  const t = useT();
  const isUser = message.role === "user";
  const citeByN = new Map((message.citations ?? []).map((c) => [c.n, c]));
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<NoticeKey | null>(null);

  const flash = (key: NoticeKey): void => {
    setNotice(key);
    setTimeout(() => setNotice(null), 2000);
  };

  // 072: copy/export câu trả lời + danh sách nguồn (markdown). Copy qua clipboard main (#67); export .md
  // qua hộp thoại lưu (tái dùng studioExport — ghi markdown generic ở main). KHÔNG log nội dung.
  // 123: câu "không tìm thấy" hiển thị theo ngôn ngữ hiện tại (bỏ qua content đã lưu — có thể là tiếng Việt cũ).
  const content =
    !isUser && message.notFound && !message.streaming
      ? `${t.t("chat.notFound")} ${t.t("chat.notFoundHint")}`
      : !isUser && message.reindexing && !message.streaming
        ? t.t("chat.reindexing")
        : message.content;
  const exportMd = (): string =>
    formatAnswerMarkdown(content, message.citations ?? [], t);

  const onCopy = async (): Promise<void> => {
    try {
      await window.api.clipboardWrite(exportMd());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      flash("copyFailed");
    }
  };

  const onExport = async (): Promise<void> => {
    try {
      const res = await window.api.studioExport({
        content: exportMd(),
        suggestedName: t.t("chat.exportName", { date: isoDate(Date.now()) }),
        ...(notebookId ? { notebookId } : {}),
      });
      if (res.saved) flash("exported");
    } catch {
      flash("exportFailed");
    }
  };

  // Chỉ hiện hành động cho câu trả lời AI đã hoàn tất, có nội dung.
  const showActions = !isUser && !message.streaming && content.trim() !== "";

  return (
    <div
      className={isUser ? "bubble user" : "bubble ai"}
      data-testid={`bubble-${message.role}`}
      // 091: đang stream ⇒ báo trình đọc màn hình nội dung chưa xong (không đọc từng token).
      aria-busy={message.streaming ? true : undefined}
    >
      <span className="who" data-testid="bubble-who">
        {isUser ? t.t("chat.you") : "SourceCraft"}
      </span>
      {/* 071: chế độ Mở rộng có thể chứa nội dung ngoài nguồn → badge cảnh báo (kiểm chứng được). */}
      {!isUser && message.modeUsed === "open" && (
        <span
          className="ungrounded"
          data-testid="ungrounded-badge"
          title={t.t("chat.ungroundedTitle")}
        >
          {t.t("chat.ungroundedBadge")}
        </span>
      )}
      {/* 098: trả lời bằng AI cục bộ sau lỗi online (người dùng chọn) — minh bạch nguồn trả lời. */}
      {!isUser && message.answeredLocally && (
        <span
          className="local-answer"
          data-testid="local-badge"
          title={t.t("chat.localBadgeTitle")}
        >
          {t.t("chat.localBadge")}
        </span>
      )}
      {isUser ? (
        <p className="bubble-text">{message.content}</p>
      ) : message.streaming ? (
        // 039: đang stream → text thô + con trỏ (chip [n] chỉ xuất hiện sau khi hậu kiểm toàn văn).
        <p
          className="bubble-text bubble-streaming"
          data-testid="bubble-streaming"
        >
          {message.content}
          <span className="stream-caret" aria-hidden="true" />
        </p>
      ) : (
        <div className="bubble-text">
          <MarkdownContent
            content={content}
            citeByN={citeByN}
            onCite={onCite}
          />
        </div>
      )}
      {!isUser && message.citations && message.citations.length > 0 && (
        <div className="srcnote" data-testid="srcnote">
          <span className="srcnote-label">{t.t("chat.sourcesLabel")}</span>
          {message.citations.map((c) => (
            <span key={c.n} className="srcnote-item">
              {formatCitationLabel(c, t)}
            </span>
          ))}
        </div>
      )}
      {showActions && (
        <div className="bubble-actions" data-testid="bubble-actions">
          <button
            type="button"
            className="bubblebtn"
            onClick={() => void onCopy()}
            data-testid="bubble-copy"
          >
            {copied ? t.t("common.copied") : t.t("common.copy")}
          </button>
          <button
            type="button"
            className="bubblebtn"
            onClick={() => void onExport()}
            data-testid="bubble-export"
          >
            {t.t("chat.actions.export")}
          </button>
          {notice && (
            <span className="bubble-notice" data-testid="bubble-notice">
              {t.t(`chat.actions.${notice}`)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
