import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { runtimeStatusStore } from "../ai-runtime/runtime-status-store";
import { chatReadiness } from "./chat-readiness";
import type {
  AiTarget,
  Citation,
  DomainMode,
  RagMode,
  RagTurn,
} from "@shared/ipc/types";
import type { Translator } from "@shared/i18n";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { announce } from "../../shared/a11y/announcer";
import { useT } from "../../shared/i18n/i18n-context";
import {
  describeIpcError,
  toParsedError,
} from "../../shared/i18n/describe-error";
import {
  chatCancelledMessage,
  chatStartedMessage,
  chatDoneMessage,
} from "../../shared/a11y/messages";

// Hook cột Chat: nạp lịch sử hội thoại đã lưu theo notebook (027-chat-history) + gọi ragAskStream (streaming,
// 039; main tự persist câu trả lời cuối) + kiểm runtime/nguồn ready. Multi-turn: gửi lịch sử hiện có.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  notFound?: boolean;
  /** 123: thông báo "đang tái lập chỉ mục" (không lưu) — hiển thị câu dịch theo ngôn ngữ hiện tại. */
  reindexing?: boolean;
  /** 071: chế độ đã dùng — "open" → badge "không dựa trên nguồn". */
  modeUsed?: RagMode;
  streaming?: boolean; // 039: đang nhận token (render text thô, chưa chip)
  /** 098: trả lời bằng AI cục bộ sau lỗi online (người dùng bấm) — nhãn minh bạch, chỉ trong phiên. */
  answeredLocally?: boolean;
}

/** 123: lỗi Chat lưu dạng MÃ (không lưu chuỗi đã dịch) — dịch lúc render bằng describeChatError. */
export type ChatError =
  | { kind: "ipc"; error: ParsedIpcError }
  | { kind: "clearFailed" | "localNotReady" | "notSent" };

export function describeChatError(err: ChatError, tr: Translator): string {
  switch (err.kind) {
    case "ipc":
      return describeIpcError(err.error, tr);
    case "clearFailed":
      return tr.t("chat.errors.clearFailed");
    case "localNotReady":
      return tr.t("chat.blockRuntime");
    case "notSent":
      return tr.t("chat.errors.notSent");
  }
}

/** 098: lượt lỗi do provider online, chờ người dùng chọn "AI cục bộ" hoặc "Thử lại". */
export interface FailedTurn {
  question: string;
}

export function useChat(notebookId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<RagMode>("grounded");
  const [scope, setScope] =
    useState<import("@shared/ipc/types").RagSearchScope>("current");
  const [domainMode, setDomainMode] = useState<DomainMode>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [failedTurn, setFailedTurn] = useState<FailedTurn | null>(null);
  // #135: trạng thái runtime dùng chung (tự kiểm tra lại khi chưa sẵn sàng; "Kiểm tra lại" ở banner cập nhật cả đây).
  const runtime = useSyncExternalStore(
    runtimeStatusStore.subscribe,
    runtimeStatusStore.getSnapshot,
  );
  // Cổng gửi theo provider SẼ trả lời (LAN/online/Ollama); localReady chỉ cho nhánh "AI cục bộ" (098).
  const {
    ready: runtimeReady,
    localReady,
    blockKey: runtimeBlockKey,
  } = chatReadiness(runtime.status);
  const [hasReadySources, setHasReadySources] = useState(false);
  // 039: id stream đang chạy (để hiện nút Dừng); ref để listener token lọc đúng lượt.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const activeStreamRef = useRef<string | null>(null);
  // 091: người dùng bấm Dừng ⇒ câu báo kết thúc là "Đã dừng" thay vì "Đã có câu trả lời".
  const stopRequestedRef = useRef(false);
  // 123: translator HIỆN TẠI cho câu báo trình đọc màn hình trong callback sống lâu (đổi ngôn ngữ giữa stream).
  const t = useT();
  const trRef = useRef(t);
  trRef.current = t;

  // Đăng ký nhận token (039) một lần — nối delta vào bong bóng assistant đang stream (khớp streamId).
  useEffect(() => {
    const off = window.api.onRagStreamToken((e) => {
      if (e.streamId !== activeStreamRef.current) return;
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (!last.streaming) return prev;
        return [
          ...prev.slice(0, -1),
          { ...last, content: last.content + e.delta },
        ];
      });
    });
    return off;
  }, []);

  // Đổi notebook → huỷ stream đang chạy (039) + nạp lịch sử đã lưu (027) thay vì reset rỗng.
  useEffect(() => {
    let cancelled = false;
    if (activeStreamRef.current) {
      void window.api.ragStop(activeStreamRef.current).catch(() => {});
      activeStreamRef.current = null;
      setStreamingId(null);
      // 091: lượt bị huỷ không còn câu báo kết thúc ⇒ báo huỷ để "Đang soạn…" không treo lơ lửng.
      announce(chatCancelledMessage(trRef.current));
    }
    setError(null);
    setFailedTurn(null);
    setMessages([]);
    window.api
      .chatHistory(notebookId)
      .then((list) => {
        if (cancelled) return;
        setMessages(
          list.map((m) => ({
            role: m.role,
            content: m.content,
            citations: m.citations,
            notFound: m.notFound,
            modeUsed: m.modeUsed,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const clearHistory = useCallback(() => {
    // 098: xoá hội thoại thì bỏ luôn lượt lỗi đang chờ chọn (không còn câu hỏi để hỏi lại).
    setFailedTurn(null);
    setError(null);
    window.api
      .chatClear(notebookId)
      .then(() => setMessages([]))
      .catch(() => setError({ kind: "clearFailed" }));
  }, [notebookId]);

  const refreshReadiness = useCallback(() => {
    runtimeStatusStore.refresh();
    window.api
      .sourceListByNotebook(notebookId)
      .then((list) =>
        setHasReadySources(list.some((s) => s.status === "ready")),
      )
      .catch(() => setHasReadySources(false));
  }, [notebookId]);

  useEffect(() => refreshReadiness(), [refreshReadiness]);

  // Nguồn vừa nạp xong → cập nhật lại "có nguồn ready".
  useEffect(() => {
    const off = window.api.onSourceProgress((e) => {
      if (e.notebookId === notebookId) refreshReadiness();
    });
    return off;
  }, [notebookId, refreshReadiness]);

  const canSend = runtimeReady === true && hasReadySources && !loading;

  const send = useCallback(
    async (
      question: string,
      opts: { target?: AiTarget; retry?: boolean } = {},
    ) => {
      const q = question.trim();
      if (!q || !canSend) return;
      // Defense-in-depth (FR-007): huỷ stream cũ nếu còn (ngoài việc UI đã khoá nút khi loading).
      if (activeStreamRef.current) {
        void window.api.ragStop(activeStreamRef.current).catch(() => {});
      }
      setError(null);
      setFailedTurn(null);
      // 098: hỏi lại lượt lỗi ⇒ câu hỏi (và phần trả lời dở nếu lỗi giữa stream) đã nằm cuối thread — cắt bỏ từ câu
      // hỏi đó trở đi để không nhân đôi và không gửi chúng vào lịch sử.
      const retryAt = opts.retry
        ? messages
            .map((m) => m.role === "user" && m.content === q)
            .lastIndexOf(true)
        : -1;
      const base = retryAt >= 0 ? messages.slice(0, retryAt) : messages;
      const local = opts.target === "local";
      const history: RagTurn[] = base.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const streamId = crypto.randomUUID();
      activeStreamRef.current = streamId;
      setStreamingId(streamId);
      // Thêm câu hỏi + bong bóng assistant rỗng (streaming) để nối token.
      setMessages(() => [
        ...base,
        { role: "user", content: q },
        { role: "assistant", content: "", streaming: true },
      ]);
      setLoading(true);
      stopRequestedRef.current = false;
      announce(chatStartedMessage(trRef.current));
      try {
        const res = await window.api.ragAskStream({
          notebookId,
          question: q,
          mode,
          history,
          streamId,
          scope,
          domainMode,
          ...(local ? { target: "local" as const } : {}),
        });
        // Lượt đã bị huỷ/đổi notebook giữa chừng → không ghi đè (streamId không còn active).
        if (activeStreamRef.current !== streamId) return;
        announce(
          chatDoneMessage(
            {
              citationCount: res.citations.length,
              notFound: res.notFound,
              stopped: stopRequestedRef.current,
            },
            trRef.current,
          ),
        );
        // Thay bong bóng streaming bằng kết quả cuối (markdown + chip hậu kiểm).
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (!last.streaming) return prev;
          return [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: res.answer,
              citations: res.citations,
              notFound: res.notFound,
              modeUsed: res.modeUsed,
              ...(res.reindexing ? { reindexing: true } : {}),
              ...(local ? { answeredLocally: true } : {}),
            },
          ];
        });
      } catch (e) {
        if (activeStreamRef.current === streamId) {
          // 098: tách thẻ lỗi online (main gắn) — lỗi provider online ⇒ giữ lượt để người dùng chọn AI cục bộ.
          const parsed = toParsedError(e);
          setError({ kind: "ipc", error: parsed });
          if (parsed.onlineKind && !local) setFailedTurn({ question: q });
          // Lỗi mạng giữa stream (khác Dừng): GIỮ phần đã nhận (token đã tới bong bóng) — chỉ chốt lại
          // (streaming:false) để người dùng không mất phần đã đọc; bong bóng rỗng thì gỡ. (spec Edge Case)
          setMessages((prev) => {
            if (prev.length === 0) return prev;
            const last = prev[prev.length - 1];
            if (!last.streaming) return prev;
            return last.content === ""
              ? prev.slice(0, -1)
              : [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: last.content },
                ];
          });
        }
      } finally {
        if (activeStreamRef.current === streamId) {
          activeStreamRef.current = null;
          setStreamingId(null);
        }
        setLoading(false);
      }
    },
    // 238: scope/domainMode PHẢI có ở đây — thiếu ⇒ send giữ giá trị cũ, đổi toggle rồi hỏi ngay vẫn gửi lựa chọn trước.
    [canSend, messages, mode, notebookId, scope, domainMode],
  );

  /** 098: chạy lại lượt lỗi online — "local" (Ollama) hoặc "active" (thử lại provider đang bật). */
  const retryFailed = useCallback(
    async (target: AiTarget) => {
      if (!failedTurn) return;
      // Không gửi được (Ollama ngừng chạy giữa phiên…) ⇒ báo rõ thay vì bấm mà không có gì xảy ra (ADR 098).
      // "AI cục bộ" cần chính Ollama — provider đang bật (online) sẵn sàng không đủ.
      if (target === "local" && localReady !== true) {
        setError({ kind: "localNotReady" });
        return;
      }
      if (!canSend) {
        setError({ kind: "notSent" });
        return;
      }
      await send(failedTurn.question, {
        target: target === "local" ? "local" : undefined,
        retry: true,
      });
    },
    [canSend, failedTurn, localReady, send],
  );

  // Dừng stream đang chạy (039) — main abort → ragAskStream resolve với phần đã nhận → finalize bình thường.
  const stop = useCallback(() => {
    const id = activeStreamRef.current;
    if (!id) return;
    stopRequestedRef.current = true;
    void window.api.ragStop(id).catch(() => {});
  }, []);

  return {
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
  };
}
