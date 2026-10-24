import type { MeetingService } from "../services/meeting-capture/meeting-service";
import type { MeetingViewerApi } from "../services/meeting-capture/meeting-viewer";
import { UserFacingError } from "@shared/codes/user-error";
import { app, ipcMain, BrowserWindow, clipboard, shell } from "electron";
import { CHANNELS, isWhitelisted } from "@shared/ipc/channels";
import type {
  AddSourceInput,
  CreateNotebookInput,
  DataDirInfo,
  ModelSelection,
  OnlineProviderId,
  RagAskInput,
  RagAskStreamInput,
  RagStreamTokenEvent,
  RenameNotebookInput,
  SetColorInput,
  SetProviderKeyInput,
  SetProviderModelInput,
  StudioGenerateInput,
  StudioProgressEvent,
  StudioProgressPhase,
  ModelRecommendation,
  OllamaHealth,
  RerankerStatus,
  ReindexStatus,
  SourceRelinkResult,
  SourceReprocessResult,
} from "@shared/ipc/types";
import { getPrivacyState } from "../services/app-shell/privacy-state";
import { computeStorageInfo } from "../services/app-shell/storage-info";
import { createFsOps } from "../services/app-shell/storage-fs";
import { buildAppInfo } from "../services/app-shell/app-info";
import {
  getOnboardingState,
  setOnboardingComplete,
  type StoreLike,
} from "../services/app-shell/onboarding";
import type { AiRuntime } from "../services/ai-runtime/ai-runtime";
import type { NotebookRepo } from "../services/notebooks/notebook-repo";
import type { SourceRepo } from "../services/ingestion/source-repo";
import type { IngestionPipeline } from "../services/ingestion/pipeline";
import type { VectorStore } from "../services/ingestion/vector-store";
import type { UiLanguageService } from "../services/ui-language";
import type { RagService } from "../services/rag/rag-service";
import type { ChatRepo } from "../services/rag/chat-repo";
import type { StudioService } from "../services/studio/studio-service";
import type { ContentSearch } from "../services/search/content-search";
import { exportMarkdown } from "../services/studio/export";
import { createStudioProgressEmitter } from "../services/studio/progress-emitter";
import { createStudioTokenEmitter } from "../services/studio/token-emitter";
import {
  cancelLogFields,
  createGenerationRegistry,
} from "../services/studio/generation-registry";
import type { OnStudioProgress } from "../services/studio/map-reduce";
import { isValidGenerationId } from "@shared/studio-progress";
import {
  getSourceContent,
  type SourceContentRequest,
} from "../services/source-viewer/source-content";
import { logError, logEvent } from "../logging";
import { createRendererErrorReporter } from "../services/app-log/renderer-error";
import type { CrashService } from "../services/crash-report/crash-service";
import {
  parseAiTarget,
  rethrowForIpc,
  type AiTarget,
} from "../services/ai-runtime/ai-target";
import type { BackupService } from "../services/vault-backup/backup-service";
import type { VaultLock } from "../services/vault-backup/vault-lock";
import {
  parseBackupCreateInput,
  parseRestoreTokenInput,
} from "../services/vault-backup/ipc-input";
import { detectKindFromPath } from "../services/ingestion/parsers";
import type { LicenseService } from "../services/license/license-service";

interface RegisterDeps {
  store: StoreLike;
  version: string;
  dataDir: DataDirInfo;
  notebookRepo: NotebookRepo;
  sourceRepo: SourceRepo;
  pipeline: IngestionPipeline;
  vectorStore: VectorStore;
  aiRuntime: AiRuntime;
  // 098: theo đích AI của lượt — active (provider đang bật) / local (Ollama).
  ragServices: Record<AiTarget, RagService>;
  chatRepo: ChatRepo;
  studioServices: Record<AiTarget, StudioService>;
  contentSearch: ContentSearch;
  // 059 — gợi ý model theo RAM + health Ollama + trạng thái reindex.
  recommendChatModel: () => ModelRecommendation;
  ollamaHealth: () => Promise<OllamaHealth>;
  // 109 — trạng thái bộ chấm độ liên quan (chỉ đọc).
  rerankerStatus: () => RerankerStatus;
  reindexStatus: () => ReindexStatus;
  // 085 — sao lưu/khôi phục vault + khoá chặn ghi trong lúc chụp/sau xác nhận khôi phục.
  backupService: BackupService;
  vaultLock: VaultLock;
  // 088 — thư mục nhật ký (mở bằng trình quản lý tệp từ Cài đặt / màn hình lỗi).
  logsDir: string;
  // 093 — báo lỗi opt-in.
  crashService: CrashService;
  // 101 — chọn lại tệp gốc.
  relinkSource: (id: unknown) => Promise<SourceRelinkResult>;
  // 112 — xử lý lại PDF (kiểm khoá kho / quy tắc / tệp gốc trong handler).
  reprocessSource: (id: unknown) => Promise<SourceReprocessResult>;
  // 123 — ngôn ngữ giao diện (lưu lựa chọn + ngôn ngữ hiệu lực).
  uiLanguage: UiLanguageService;
  // 186 — Ghi cuộc họp.
  meeting: MeetingService;
  meetingViewer: MeetingViewerApi;
  // 226 — Enterprise License & Feature Gate.
  licenseService?: LicenseService;
}

/** Số báo lỗi renderer tối đa ghi mỗi phiên (chặn vòng lặp lỗi làm phình nhật ký) — 088. */
const MAX_RENDERER_ERROR_REPORTS = 50;

/**
 * Đăng ký IPC handler CHỈ cho các kênh whitelisted (Constitution III, US2).
 * KHÔNG có handler catch-all: renderer gọi kênh ngoài danh sách ⇒ không có handler ⇒ Promise reject,
 * không side effect. `safeHandle` chặn cứng nếu ai đó lỡ đăng ký tên ngoài whitelist.
 */
export function registerIpc({
  store,
  version,
  dataDir,
  notebookRepo,
  sourceRepo,
  pipeline,
  vectorStore,
  aiRuntime,
  ragServices,
  chatRepo,
  studioServices,
  contentSearch,
  recommendChatModel,
  ollamaHealth,
  rerankerStatus,
  reindexStatus,
  backupService,
  vaultLock,
  logsDir,
  crashService,
  relinkSource,
  reprocessSource,
  uiLanguage,
  meeting,
  meetingViewer,
  licenseService,
}: RegisterDeps): void {
  const safeHandle = (
    channel: string,
    fn: (...a: unknown[]) => unknown,
  ): void => {
    if (!isWhitelisted(channel)) {
      throw new Error(`IPC channel not whitelisted: ${channel}`);
    }
    // Truyền args từ renderer (bỏ event object đầu tiên). KHÔNG log args (có thể chứa nội dung).
    ipcMain.handle(channel, (_event, ...args) => fn(...args));
  };
  /**
   * 146: như safeHandle nhưng truyền kèm `sender` (webContents của cửa sổ đã gọi) — để đẩy sự kiện CHỈ về đúng cửa sổ đó.
   * KHÔNG log args.
   */
  const safeHandleWithSender = (
    channel: string,
    fn: (sender: Electron.WebContents, ...a: unknown[]) => unknown,
  ): void => {
    if (!isWhitelisted(channel)) {
      throw new Error(`IPC channel not whitelisted: ${channel}`);
    }
    ipcMain.handle(channel, (event, ...args) => fn(event.sender, ...args));
  };

  // app-shell (001)
  safeHandle(CHANNELS.getDataDir, () => dataDir);
  // 037: thông tin lưu trữ (chỉ đọc kích thước thư mục dữ liệu + dung lượng ổ; KHÔNG log nội dung).
  safeHandle(CHANNELS.getStorageInfo, () =>
    computeStorageInfo(dataDir.path, createFsOps()),
  );
  safeHandle(CHANNELS.getPrivacyState, () => getPrivacyState());
  // 123: đọc/đặt ngôn ngữ giao diện; set kiểm enum ở service (giá trị khác ⇒ ném, không ghi).
  safeHandle(CHANNELS.getUiLanguage, () => uiLanguage.get());
  safeHandle(CHANNELS.setUiLanguage, (pref) => uiLanguage.set(pref));
  safeHandle(CHANNELS.getOnboardingState, () => getOnboardingState(store));
  safeHandle(CHANNELS.setOnboardingComplete, () =>
    setOnboardingComplete(store),
  );
  safeHandle(CHANNELS.getAppInfo, () => buildAppInfo(version));
  // ghi clipboard qua main (#67): navigator.clipboard bị chặn bởi permission handler + file:// không phải
  // secure context ở bản đóng gói. Dùng Electron clipboard (local, không egress). KHÔNG log nội dung.
  safeHandle(CHANNELS.clipboardWrite, (text) => {
    clipboard.writeText(String(text));
    return { ok: true } as const;
  });
  // app-log (088): renderer chỉ gửi loại lỗi + componentStack; main làm sạch + chặn lũ rồi ghi nhật ký.
  safeHandle(
    CHANNELS.reportRendererError,
    createRendererErrorReporter({
      log: logError,
      max: MAX_RENDERER_ERROR_REPORTS,
    }),
  );
  // Mở thư mục nhật ký CỐ ĐỊNH (không nhận path từ renderer). shell.openPath trả "" khi thành công.
  safeHandle(CHANNELS.openLogsFolder, async () => {
    if (!logsDir) return { ok: false }; // khởi tạo nhật ký thất bại lúc khởi động
    const err = await shell.openPath(logsDir);
    if (err) logEvent("logs.openFailed", {});
    return { ok: err === "" };
  });
  // crash-report (093): bản nháp đã làm sạch; mở issue với đích CỐ ĐỊNH (renderer chỉ gửi tiêu đề + nội dung).
  safeHandle(CHANNELS.crashGetReport, () => crashService.getReport());
  safeHandle(CHANNELS.crashOpenIssue, (input) => crashService.openIssue(input));
  safeHandle(CHANNELS.crashGetNotice, () => crashService.getNotice());
  safeHandle(CHANNELS.crashDismissNotice, () => crashService.dismissNotice());

  // ai-runtime (007) — Ollama gọi CHỈ ở đây (main); renderer chạm qua 5 kênh này. Cùng instance với pipeline.
  const ai = aiRuntime;
  safeHandle(CHANNELS.aiListModels, () => ai.listModels());
  safeHandle(CHANNELS.aiTestConnection, () => ai.testConnection());
  safeHandle(CHANNELS.aiGetSelectedModels, () => ai.getSelectedModels());
  safeHandle(CHANNELS.aiSetSelectedModels, (sel) =>
    ai.setSelectedModels(sel as ModelSelection),
  );
  safeHandle(CHANNELS.aiGetRuntimeStatus, () => ai.getRuntimeStatus());
  // 059 — gợi ý cỡ model chat theo RAM (chỉ gợi ý) + health-check Ollama (chat). Read-only, không tự tải.
  safeHandle(CHANNELS.aiRecommendModel, () => recommendChatModel());
  safeHandle(CHANNELS.aiOllamaHealth, () => ollamaHealth());
  safeHandle(CHANNELS.aiGetRerankerStatus, () => rerankerStatus());
  // 059 — trạng thái tái lập chỉ mục (đổi engine embedding).
  safeHandle(CHANNELS.embedReindexStatus, () => reindexStatus());

  // online-provider (031) — network + keytar CHỈ ở main; renderer qua 6 kênh này. KHÔNG log key/nội dung.
  // Validate boundary trong online-runtime (id whitelist, key/model). Trả OnlineState (không chứa key).
  safeHandle(CHANNELS.aiGetOnlineState, () => ai.online.getOnlineState());
  safeHandle(CHANNELS.aiSetProviderKey, (input) =>
    ai.online.setProviderKey(input as SetProviderKeyInput),
  );
  safeHandle(CHANNELS.aiDeleteProviderKey, (id) =>
    ai.online.deleteProviderKey(id as OnlineProviderId),
  );
  safeHandle(CHANNELS.aiSetProviderModel, (input) =>
    ai.online.setProviderModel(input as SetProviderModelInput),
  );
  safeHandle(CHANNELS.aiSetActiveProvider, (id) =>
    ai.online.setActiveProvider(id as OnlineProviderId | null),
  );
  safeHandle(CHANNELS.aiTestProvider, (id) =>
    ai.online.testProvider(id as OnlineProviderId),
  );

  // notebooks (009) — SQLite gọi CHỈ ở đây (main, qua repo). KHÔNG log tên notebook (args không vào logEvent).
  safeHandle(CHANNELS.notebookList, () => notebookRepo.list());
  safeHandle(CHANNELS.notebookCreate, (input) => {
    licenseService?.gate.assertCanCreateNotebook(notebookRepo.list().length);
    return notebookRepo.create(input as CreateNotebookInput);
  });
  safeHandle(CHANNELS.notebookRename, (input) =>
    notebookRepo.rename(input as RenameNotebookInput),
  );
  safeHandle(CHANNELS.notebookSetColor, (input) =>
    notebookRepo.setColor(input as SetColorInput),
  );
  // Xoá notebook: dọn vector LanceDB theo notebook_id TRƯỚC (tránh mồ côi), rồi xoá SQLite (cascade
  // source→chunk). Nhất quán 2 store (ADR lancedb-integration, FR-015).
  // 085: chặn các kênh GHI vault khi đang chụp dữ liệu / đã xác nhận khôi phục (vault lock).
  const assertVaultWritable = (): void => {
    // 123: mã "vaultLocked" — giao diện dịch theo ngôn ngữ hiện tại (085, R7).
    if (vaultLock.isLocked()) throw new UserFacingError("vaultLocked");
  };

  safeHandle(CHANNELS.notebookDelete, async (id) => {
    assertVaultWritable();
    // 186: không xoá notebook đang ghi cuộc họp (FR-042); audio cuộc họp do app sở hữu ⇒ dọn thư mục trước khi
    // cascade xoá hàng (nếu không sẽ thành tệp mồ côi).
    if (meeting.isRecordingNotebook(id as string)) {
      throw new UserFacingError("meetingRecording");
    }
    for (const s of sourceRepo.listByNotebook(id as string)) {
      if (s.kind === "meeting") await meeting.onSourceRemoved(s.id);
    }
    await vectorStore.deleteByNotebook(id as string);
    return notebookRepo.delete(id as string);
  });

  // ingestion (011) — FS/parse/embed/LanceDB CHỈ ở main (Constitution III). KHÔNG log nội dung tài liệu.
  safeHandle(CHANNELS.sourceAdd, (input) => {
    assertVaultWritable();
    const addInput = input as AddSourceInput;
    if (
      licenseService &&
      addInput &&
      typeof addInput.notebookId === "string" &&
      addInput.notebookId !== ""
    ) {
      const kind =
        addInput.kind === "url"
          ? "url"
          : typeof addInput.filePath === "string" &&
              addInput.filePath.trim() !== ""
            ? detectKindFromPath(addInput.filePath)
            : addInput.kind;
      const count = sourceRepo.listByNotebook(addInput.notebookId).length;
      licenseService.gate.assertCanAddSource(count, kind);
    }
    return pipeline.add(addInput);
  });
  safeHandle(CHANNELS.sourceListByNotebook, (id) =>
    sourceRepo.listByNotebook(id as string),
  );
  safeHandle(CHANNELS.sourceGet, (id) => sourceRepo.getById(id as string));
  safeHandle(CHANNELS.sourceDelete, (id) => {
    assertVaultWritable();
    // 186: không xoá nguồn cuộc họp đang được ghi (FR-042) — kết thúc ghi trước.
    if (meeting.status()?.sourceId === id) {
      throw new UserFacingError("meetingRecording");
    }
    return pipeline.remove(id as string);
  });
  safeHandle(CHANNELS.sourceRetry, (id) => {
    assertVaultWritable();
    return pipeline.retry(id as string);
  });
  // 101: chọn lại tệp gốc (đổi origin) — là thao tác GHI vault ⇒ chặn khi đang sao lưu/khôi phục.
  safeHandle(CHANNELS.sourceRelink, (id) => {
    assertVaultWritable();
    return relinkSource(id);
  });
  // 112: xử lý lại PDF — là thao tác GHI vault ⇒ chặn khi đang sao lưu/khôi phục (kiểm lại lúc hoán đổi).
  safeHandle(CHANNELS.sourceReprocess, (id) => {
    assertVaultWritable();
    return reprocessSource(id);
  });
  safeHandle(CHANNELS.sourceReprocessCancel, (id) => ({
    cancelled: typeof id === "string" && pipeline.cancelReprocess(id),
  }));
  // source-viewer (019) — tái dựng toàn văn từ chunk đã lưu để hiển thị. CHỈ đọc; KHÔNG log content.
  // 112: nhận id hoặc {sourceId, chunkId} — getSourceContent tự validate kiểu (sai ⇒ null).
  safeHandle(CHANNELS.sourceGetContent, (req) =>
    getSourceContent(sourceRepo, req as string | SourceContentRequest),
  );
  // content-search (073) — tìm toàn văn nội dung nguồn trong notebook (FTS5 BM25). CHỈ đọc; KHÔNG log query.
  safeHandle(CHANNELS.sourceSearch, (input) => {
    const { notebookId, query } = input as {
      notebookId: string;
      query: string;
    };
    return contentSearch.search(notebookId, query);
  });

  // rag-qa (013) — embed/search/chat CHỈ ở đây (main). KHÔNG log payload (câu hỏi/nội dung — Constitution III).
  // 098: đích AI theo lượt (input.target) + lỗi provider online gắn thẻ để renderer hiện nút "AI cục bộ".
  safeHandle(CHANNELS.ragAsk, async (input) => {
    const target = parseAiTarget(input);
    try {
      return await ragServices[target].ask(input as RagAskInput);
    } catch (e) {
      return rethrowForIpc(e);
    }
  });

  // streaming (039) — Chat trả lời chạy dần. Token đẩy qua rag:streamToken (webContents.send); huỷ qua
  // rag:stop (AbortController theo streamId). KHÔNG log token/nội dung.
  const streamControllers = new Map<string, AbortController>();
  const emitToken = (e: RagStreamTokenEvent): void => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(CHANNELS.ragStreamToken, e);
    }
  };
  safeHandle(CHANNELS.ragAskStream, async (input) => {
    const streamId = (input as { streamId?: unknown }).streamId;
    if (typeof streamId !== "string" || streamId === "") {
      throw new Error("Invalid streamId.");
    }
    // Kiểm đích AI TRƯỚC khi giữ controller — ném ở đây không để lại entry mồ côi trong streamControllers.
    const target = parseAiTarget(input);
    const controller = new AbortController();
    streamControllers.set(streamId, controller);
    try {
      return await ragServices[target].askStream(input as RagAskStreamInput, {
        onToken: (delta) => emitToken({ streamId, delta }),
        signal: controller.signal,
      });
    } catch (e) {
      return rethrowForIpc(e);
    } finally {
      streamControllers.delete(streamId);
    }
  });
  safeHandle(CHANNELS.ragStop, (streamId) => {
    const c = streamControllers.get(streamId as string);
    if (c) c.abort();
    return { stopped: true } as const;
  });
  // Đóng hết cửa sổ (macOS: app còn chạy nền) → huỷ mọi stream đang chạy để KHÔNG egress ngầm ngoài tầm
  // quan sát của người dùng (Constitution I — chỉ báo khớp hành vi). Nút Dừng nằm ở renderer đã đóng.
  app.on("window-all-closed", () => {
    for (const c of streamControllers.values()) c.abort();
    streamControllers.clear();
  });

  // chat-history (027) — nạp/xoá lịch sử hội thoại. Đọc/ghi DB CHỈ ở main. KHÔNG log nội dung.
  const notebookIdOf = (input: unknown): string => {
    const id = (input as { notebookId?: unknown }).notebookId;
    if (typeof id !== "string" || id === "") {
      throw new Error("Invalid notebookId.");
    }
    return id;
  };
  safeHandle(CHANNELS.chatHistory, (input) =>
    chatRepo.listByNotebook(notebookIdOf(input)),
  );
  safeHandle(CHANNELS.chatClear, (input) => {
    chatRepo.clear(notebookIdOf(input));
    return { cleared: true } as const;
  });

  // studio (021) — tổng hợp toàn notebook (đọc chunk + chat CHỈ ở main). KHÔNG log content/citations.
  // 146: tiến độ Studio đẩy qua studio:progress CHỈ về cửa sổ đã gọi (review bảo mật) — chỉ khi renderer gửi generationId hợp
  // lệ. KHÔNG log payload.
  // 149: sổ lượt tạo Studio đang chạy — huỷ theo generationId (chỉ cửa sổ đã bắt đầu), lượt mới cùng (notebook, loại) thay lượt cũ,
  // cửa sổ đóng ⇒ huỷ. Log studio.cancelled chỉ loại/pha/lý do (không id, không nội dung).
  const studioRuns = createGenerationRegistry<Electron.WebContents>();
  const watchedSenders = new WeakSet<Electron.WebContents>();
  safeHandleWithSender(CHANNELS.studioGenerate, async (sender, input) => {
    const target = parseAiTarget(input);
    const studioInput = input as StudioGenerateInput;
    if (licenseService && studioInput && typeof studioInput.kind === "string") {
      licenseService.gate.assertCanGenerateStudio(studioInput.kind);
    }
    const emitStudioProgress = (e: StudioProgressEvent): void => {
      if (!sender.isDestroyed()) sender.send(CHANNELS.studioProgress, e);
    };
    const emit = createStudioProgressEmitter(studioInput, emitStudioProgress);
    let lastPhase: StudioProgressPhase | undefined;
    const onProgress: OnStudioProgress = (step) => {
      lastPhase = step.phase;
      emit?.(step);
    };
    const id = isValidGenerationId(studioInput.generationId)
      ? studioInput.generationId
      : null;
    let signal: AbortSignal | undefined;
    if (id) {
      if (!watchedSenders.has(sender)) {
        watchedSenders.add(sender);
        sender.once("destroyed", () =>
          studioRuns.abortAllFor(sender, "window"),
        );
        // Review N3: renderer crash / tải lại trang (không phải đổi hash trong trang) ⇒ không để lượt chạy ngầm.
        sender.on("render-process-gone", () =>
          studioRuns.abortAllFor(sender, "window"),
        );
        sender.on("did-navigate", () =>
          studioRuns.abortAllFor(sender, "window"),
        );
      }
      ({ signal } = studioRuns.register({
        generationId: id,
        notebookId: studioInput.notebookId,
        kind: studioInput.kind,
        owner: sender,
      }));
    }
    // 178 (PR 4, FR-041): stream lượt viết cuối CHỈ về sender của lượt (không getAllWindows như rag:streamToken); id sai ⇒
    // không stream; sau huỷ / cửa sổ đóng ⇒ không gửi. Không log delta.
    const onToken = createStudioTokenEmitter(studioInput.generationId, signal, {
      send: (ev) => sender.send(CHANNELS.studioStreamToken, ev),
      isDestroyed: () => sender.isDestroyed(),
    });
    let cancelled = false;
    try {
      return await studioServices[target].generate(studioInput, {
        onProgress,
        signal,
        ...(onToken ? { onToken } : {}),
      });
    } catch (e) {
      cancelled = e instanceof UserFacingError && e.code === "studioCancelled";
      return rethrowForIpc(e);
    } finally {
      const reason = id ? studioRuns.finish(id, signal) : null;
      if (cancelled && reason) {
        logEvent(
          "studio.cancelled",
          cancelLogFields(studioInput.kind, lastPhase, reason),
        );
      }
    }
  });
  // 149: huỷ theo generationId — id sai / lạ / của cửa sổ khác ⇒ {cancelled:false}, không ném. reason chỉ "user" | "navigate".
  safeHandleWithSender(
    CHANNELS.studioCancel,
    (sender, generationId, reason) => ({
      cancelled: isValidGenerationId(generationId)
        ? studioRuns.cancel(
            generationId,
            sender,
            reason === "navigate" ? "navigate" : "user",
          )
        : false,
    }),
  );
  app.on("window-all-closed", () => studioRuns.abortAll("window"));
  safeHandle(CHANNELS.studioList, (id) =>
    studioServices.active.list(id as string),
  );
  // 178: xoá một phiên bản — service kiểm kiểu tham số; repo chỉ xoá khi id thuộc notebook. Không log id.
  safeHandle(CHANNELS.studioDeleteVersion, (input) => {
    const { notebookId, id } = (input ?? {}) as {
      notebookId?: unknown;
      id?: unknown;
    };
    return studioServices.active.deleteVersion(notebookId, id);
  });
  // studio export (025) — ghi .md qua save dialog (main). KHÔNG log content.
  safeHandle(CHANNELS.studioExport, (input) => {
    const { content, suggestedName } = input as {
      content: string;
      suggestedName: string;
    };
    return exportMarkdown(
      BrowserWindow.getFocusedWindow(),
      content,
      suggestedName,
      uiLanguage.translator(),
    );
  });

  // vault-backup (085) — FS/crypto/hộp thoại CHỈ ở main; renderer không gửi path (token thay path).
  // Payload validate ở boundary (ipc-input); sai hình ⇒ ioError. KHÔNG log payload (chứa mật khẩu).
  const invalidPayload = { status: "error", code: "ioError" } as const;
  safeHandle(CHANNELS.backupGetState, () => backupService.getState());
  safeHandle(CHANNELS.backupCreate, (input) => {
    const req = parseBackupCreateInput(input);
    return req ? backupService.createBackup(req) : invalidPayload;
  });
  safeHandle(CHANNELS.restorePick, () => backupService.pickRestore());
  safeHandle(CHANNELS.restorePrepare, (input) => {
    const req = parseRestoreTokenInput(input);
    return req ? backupService.prepareRestore(req) : invalidPayload;
  });
  safeHandle(CHANNELS.restoreConfirm, (input) => {
    const req = parseRestoreTokenInput(input);
    return req ? backupService.confirmRestore(req) : invalidPayload;
  });
  safeHandle(CHANNELS.restoreCancel, (input) => {
    const req = parseRestoreTokenInput(input);
    return req ? backupService.cancelRestore(req) : { ok: true };
  });
  safeHandle(CHANNELS.getRestoreResult, () => backupService.getRestoreResult());

  // enterprise-license (226) — offline Ed25519 license & entitlements
  if (licenseService) {
    safeHandle(CHANNELS.licenseGetStatus, () => licenseService.getStatus());
    safeHandle(CHANNELS.licenseActivateFile, () =>
      licenseService.activateFromDialog(),
    );
    safeHandle(CHANNELS.licenseDeactivate, () => licenseService.deactivate());
  }

  logEvent("ipc.registered", { channels: Object.values(CHANNELS).length });

  // meeting-capture (186) — mọi kiểm tra ở meeting-service (phiên, chủ sở hữu, đầu vào). KHÔNG log tham số/nội dung.
  safeHandleWithSender(CHANNELS.meetingPrepare, (sender, input) =>
    meeting.prepare(sender.id, input),
  );
  safeHandleWithSender(CHANNELS.meetingStart, (sender, input) => {
    assertVaultWritable();
    return meeting.start(sender.id, input);
  });
  safeHandleWithSender(CHANNELS.meetingPause, (sender, input) =>
    meeting.pause(sender.id, input),
  );
  safeHandleWithSender(CHANNELS.meetingResume, (sender, input) =>
    meeting.resume(sender.id, input),
  );
  safeHandleWithSender(CHANNELS.meetingStop, (sender, input) =>
    meeting.stop(sender.id, input),
  );
  safeHandle(CHANNELS.meetingStatus, () => {
    const st = meeting.status();
    meeting.resendDrafts(); // renderer gắn lại (reload/điều hướng) ⇒ nhận lại đủ dòng nháp
    return st;
  });
  safeHandleWithSender(CHANNELS.meetingSetLanguage, (sender, input) =>
    meeting.setLanguage(sender.id, input),
  );
  safeHandleWithSender(CHANNELS.meetingMark, (sender, input) =>
    meeting.mark(sender.id, input),
  );
  safeHandle(CHANNELS.meetingListMarkers, (input) =>
    meeting.listMarkers(input),
  );
  safeHandle(CHANNELS.meetingDownloadModel, () => meeting.downloadModel());
  // PR C2 — trình xem cuộc họp. Xuất Markdown dựng ở main (renderer chỉ gửi sourceId).
  safeHandle(CHANNELS.meetingGetTranscript, (input) =>
    meetingViewer.getTranscript(input),
  );
  safeHandle(CHANNELS.meetingUpdateMarker, (input) => {
    assertVaultWritable();
    return meetingViewer.updateMarker(input);
  });
  safeHandle(CHANNELS.meetingDeleteMarker, (input) => {
    assertVaultWritable();
    return meetingViewer.deleteMarker(input);
  });
  safeHandle(CHANNELS.meetingExportMarkdown, (input) =>
    meetingViewer.exportMarkdown(input),
  );
  safeHandle(CHANNELS.meetingListRecoverable, (input) =>
    meeting.listRecoverable(input),
  );
  safeHandle(CHANNELS.meetingRecover, (input) => {
    assertVaultWritable();
    return meeting.recover(input);
  });
  safeHandle(CHANNELS.meetingFinalizeAgain, (input) => {
    assertVaultWritable();
    return meeting.finalizeAgain(input);
  });
  safeHandle(CHANNELS.meetingRename, (input) => {
    assertVaultWritable();
    return meeting.rename(input);
  });
  // Kênh SEND duy nhất (renderer→main, không phản hồi): lô PCM. Lô sai bị bỏ trong service (không ném).
  if (!isWhitelisted(CHANNELS.meetingAudio)) {
    throw new Error("IPC channel not whitelisted: meeting:audio");
  }
  ipcMain.on(CHANNELS.meetingAudio, (event, batch: unknown) => {
    const b = (
      typeof batch === "object" && batch !== null ? batch : {}
    ) as Record<string, unknown>;
    meeting.acceptAudio(event.sender.id, {
      sessionId: b["sessionId"],
      seq: b["seq"],
      pcm: b["pcm"],
    });
  });
}
