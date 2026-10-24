import { contextBridge, ipcRenderer, webUtils } from "electron";
import { CHANNELS } from "@shared/ipc/channels";
import type {
  MeetingPrepareResult,
  MeetingStartInput,
  MeetingStartResult,
  MeetingState,
  MeetingDraftEvent,
  MeetingMarker,
  MeetingMarkInput,
  MeetingSetLanguageInput,
  MeetingRecoverAction,
  MeetingTranscript,
  MeetingMarkerKind,
  RecoverableSession,
  AddSourceInput,
  AddSourceResult,
  AppInfo,
  CreateNotebookInput,
  DataDirInfo,
  Model,
  ModelSelection,
  Notebook,
  OnboardingState,
  OnlineProviderId,
  OnlineState,
  RagAnswer,
  RagAskInput,
  RendererErrorInput,
  CrashNotice,
  CrashReportDraft,
  RenameNotebookInput,
  RuntimeStatus,
  SetColorInput,
  SetProviderKeyInput,
  SetProviderModelInput,
  Source,
  SourceContent,
  SourceProgressEvent,
  StudioDeleteVersionInput,
  StudioGenerateInput,
  StudioResult,
  StudioExportInput,
  StudioExportResult,
  StoredChatMessage,
  BackupCreateResult,
  RestoreConfirmResult,
  RestorePickResult,
  RestorePrepareResult,
  RestoreResult,
  VaultBackupProgress,
  VaultBackupState,
  LicenseStatus,
  ActivateLicenseResult,
  OpenPurchasePageResult,
} from "@shared/ipc/types";

/**
 * Cầu nối an toàn (Constitution III / US2, US4): expose MỖI kênh là MỘT HÀM RIÊNG.
 * KHÔNG expose `invoke(channel, …)` chung ⇒ renderer không thể gọi tên kênh tuỳ ý.
 */
const api = {
  /** 186 PR C1: nền tảng (darwin/win32/linux) — chọn phím Cmd/Ctrl cho phím tắt ghi cuộc họp. Chỉ đọc, không phải kênh IPC. */
  platform: process.platform as string,
  // app-shell (001)
  getDataDir: (): Promise<DataDirInfo> =>
    ipcRenderer.invoke(CHANNELS.getDataDir),
  getStorageInfo: (): Promise<import("@shared/ipc/types").StorageInfo> =>
    ipcRenderer.invoke(CHANNELS.getStorageInfo),
  getPrivacyState: (): Promise<import("@shared/ipc/types").PrivacyState> =>
    ipcRenderer.invoke(CHANNELS.getPrivacyState),
  getOnboardingState: (): Promise<OnboardingState> =>
    ipcRenderer.invoke(CHANNELS.getOnboardingState),
  setOnboardingComplete: (): Promise<{ completed: true }> =>
    ipcRenderer.invoke(CHANNELS.setOnboardingComplete),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(CHANNELS.getAppInfo),
  // ghi clipboard qua main (#67) — navigator.clipboard bị chặn ở renderer sandbox.
  clipboardWrite: (text: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.clipboardWrite, text),
  // app-log (088)
  reportRendererError: (input: RendererErrorInput): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.reportRendererError, input),
  openLogsFolder: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(CHANNELS.openLogsFolder),
  // crash-report (093)
  crashGetReport: (): Promise<CrashReportDraft> =>
    ipcRenderer.invoke(CHANNELS.crashGetReport),
  crashOpenIssue: (
    input: CrashReportDraft,
  ): Promise<{ ok: boolean; throttled?: boolean }> =>
    ipcRenderer.invoke(CHANNELS.crashOpenIssue, input),
  crashGetNotice: (): Promise<CrashNotice> =>
    ipcRenderer.invoke(CHANNELS.crashGetNotice),
  crashDismissNotice: (): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.crashDismissNotice),
  // ai-runtime (007)
  aiListModels: (): Promise<Model[]> =>
    ipcRenderer.invoke(CHANNELS.aiListModels),
  aiTestConnection: (): Promise<RuntimeStatus> =>
    ipcRenderer.invoke(CHANNELS.aiTestConnection),
  aiGetSelectedModels: (): Promise<ModelSelection> =>
    ipcRenderer.invoke(CHANNELS.aiGetSelectedModels),
  aiSetSelectedModels: (sel: ModelSelection): Promise<ModelSelection> =>
    ipcRenderer.invoke(CHANNELS.aiSetSelectedModels, sel),
  aiGetRuntimeStatus: (): Promise<RuntimeStatus> =>
    ipcRenderer.invoke(CHANNELS.aiGetRuntimeStatus),
  // online-provider (031) — AI online tùy chọn (Claude/Gemini/OpenAI). Key CHỈ đi tới main (keytar).
  aiGetOnlineState: (): Promise<OnlineState> =>
    ipcRenderer.invoke(CHANNELS.aiGetOnlineState),
  aiSetProviderKey: (input: SetProviderKeyInput): Promise<OnlineState> =>
    ipcRenderer.invoke(CHANNELS.aiSetProviderKey, input),
  aiDeleteProviderKey: (id: OnlineProviderId): Promise<OnlineState> =>
    ipcRenderer.invoke(CHANNELS.aiDeleteProviderKey, id),
  aiSetProviderModel: (input: SetProviderModelInput): Promise<OnlineState> =>
    ipcRenderer.invoke(CHANNELS.aiSetProviderModel, input),
  aiSetActiveProvider: (id: OnlineProviderId | null): Promise<OnlineState> =>
    ipcRenderer.invoke(CHANNELS.aiSetActiveProvider, id),
  aiTestProvider: (id: OnlineProviderId): Promise<RuntimeStatus> =>
    ipcRenderer.invoke(CHANNELS.aiTestProvider, id),
  // notebooks (009)
  notebookList: (): Promise<Notebook[]> =>
    ipcRenderer.invoke(CHANNELS.notebookList),
  notebookCreate: (input: CreateNotebookInput): Promise<Notebook> =>
    ipcRenderer.invoke(CHANNELS.notebookCreate, input),
  notebookRename: (input: RenameNotebookInput): Promise<Notebook> =>
    ipcRenderer.invoke(CHANNELS.notebookRename, input),
  notebookSetColor: (input: SetColorInput): Promise<Notebook> =>
    ipcRenderer.invoke(CHANNELS.notebookSetColor, input),
  notebookDelete: (id: string): Promise<{ deleted: true }> =>
    ipcRenderer.invoke(CHANNELS.notebookDelete, id),
  // ingestion (011) — 5 hàm invoke + 1 subscribe event tiến độ.
  sourceAdd: (input: AddSourceInput): Promise<AddSourceResult> =>
    ipcRenderer.invoke(CHANNELS.sourceAdd, input),
  sourceListByNotebook: (notebookId: string): Promise<Source[]> =>
    ipcRenderer.invoke(CHANNELS.sourceListByNotebook, notebookId),
  sourceGet: (id: string): Promise<Source | null> =>
    ipcRenderer.invoke(CHANNELS.sourceGet, id),
  sourceDelete: (id: string): Promise<{ deleted: true }> =>
    ipcRenderer.invoke(CHANNELS.sourceDelete, id),
  sourceRetry: (id: string): Promise<Source> =>
    ipcRenderer.invoke(CHANNELS.sourceRetry, id),
  // 101: chọn lại tệp gốc — chỉ gửi id; hộp thoại + kiểm nội dung ở main.
  sourceRelink: (
    id: string,
  ): Promise<import("@shared/ipc/types").SourceRelinkResult> =>
    ipcRenderer.invoke(CHANNELS.sourceRelink, id),
  // 112: xử lý lại PDF — chỉ gửi id; kiểm tệp gốc + khoá kho ở main.
  sourceReprocess: (
    id: string,
  ): Promise<import("@shared/ipc/types").SourceReprocessResult> =>
    ipcRenderer.invoke(CHANNELS.sourceReprocess, id),
  sourceReprocessCancel: (id: string): Promise<{ cancelled: boolean }> =>
    ipcRenderer.invoke(CHANNELS.sourceReprocessCancel, id),
  // source-viewer (019)
  // 112: kèm chunkId của trích dẫn ⇒ main trả thêm citationValid (trích dẫn cũ sau "Xử lý lại").
  sourceGetContent: (
    request: string | { sourceId: string; chunkId?: string },
  ): Promise<SourceContent | null> =>
    ipcRenderer.invoke(CHANNELS.sourceGetContent, request),
  /** 073: tìm toàn văn nội dung nguồn trong notebook (FTS5 BM25). */
  sourceSearch: (
    notebookId: string,
    query: string,
  ): Promise<import("@shared/ipc/types").ContentSearchHit[]> =>
    ipcRenderer.invoke(CHANNELS.sourceSearch, { notebookId, query }),
  /** Đăng ký nhận tiến độ nạp nguồn (push từ main). Trả hàm huỷ đăng ký. */
  onSourceProgress: (cb: (e: SourceProgressEvent) => void): (() => void) => {
    const listener = (_e: unknown, payload: SourceProgressEvent): void =>
      cb(payload);
    ipcRenderer.on(CHANNELS.sourceProgress, listener);
    return () => ipcRenderer.removeListener(CHANNELS.sourceProgress, listener);
  },
  // 123: ngôn ngữ giao diện — đọc/đặt (enum) + nghe sự kiện đổi (trả hàm huỷ).
  getUiLanguage: (): Promise<import("@shared/ipc/types").UiLanguageState> =>
    ipcRenderer.invoke(CHANNELS.getUiLanguage),
  setUiLanguage: (
    preference: "auto" | "vi" | "en",
  ): Promise<import("@shared/ipc/types").UiLanguageState> =>
    ipcRenderer.invoke(CHANNELS.setUiLanguage, preference),
  onUiLanguageChanged: (
    cb: (s: import("@shared/ipc/types").UiLanguageState) => void,
  ): (() => void) => {
    const listener = (
      _e: unknown,
      payload: import("@shared/ipc/types").UiLanguageState,
    ) => cb(payload);
    ipcRenderer.on(CHANNELS.uiLanguageChanged, listener);
    return () =>
      ipcRenderer.removeListener(CHANNELS.uiLanguageChanged, listener);
  },
  /** 103: nhận trạng thái riêng tư mới mỗi khi main đổi mode (badge cập nhật tức thì). Trả hàm huỷ. */
  onPrivacyChanged: (
    cb: (s: import("@shared/ipc/types").PrivacyState) => void,
  ): (() => void) => {
    const listener = (
      _e: unknown,
      payload: import("@shared/ipc/types").PrivacyState,
    ): void => cb(payload);
    ipcRenderer.on(CHANNELS.privacyChanged, listener);
    return () => ipcRenderer.removeListener(CHANNELS.privacyChanged, listener);
  },
  /** Lấy đường dẫn tuyệt đối của một File (kéo-thả/chọn) để gửi cho main đọc (sandbox-safe). */
  getFilePath: (file: File): string => webUtils.getPathForFile(file),
  // rag-qa (013)
  ragAsk: (input: RagAskInput): Promise<RagAnswer> =>
    ipcRenderer.invoke(CHANNELS.ragAsk, input),
  // streaming (039) — Chat chạy dần. ragAskStream resolve = RagAnswer cuối; token qua onRagStreamToken.
  ragAskStream: (
    input: import("@shared/ipc/types").RagAskStreamInput,
  ): Promise<RagAnswer> => ipcRenderer.invoke(CHANNELS.ragAskStream, input),
  ragStop: (streamId: string): Promise<{ stopped: true }> =>
    ipcRenderer.invoke(CHANNELS.ragStop, streamId),
  /** Đăng ký nhận token stream (push từ main). Trả hàm huỷ đăng ký. */
  onRagStreamToken: (
    cb: (e: import("@shared/ipc/types").RagStreamTokenEvent) => void,
  ): (() => void) => {
    const listener = (
      _e: unknown,
      payload: import("@shared/ipc/types").RagStreamTokenEvent,
    ): void => cb(payload);
    ipcRenderer.on(CHANNELS.ragStreamToken, listener);
    return () => ipcRenderer.removeListener(CHANNELS.ragStreamToken, listener);
  },
  // chat-history (027) — nạp/xoá lịch sử hội thoại.
  chatHistory: (notebookId: string): Promise<StoredChatMessage[]> =>
    ipcRenderer.invoke(CHANNELS.chatHistory, { notebookId }),
  chatClear: (notebookId: string): Promise<{ cleared: true }> =>
    ipcRenderer.invoke(CHANNELS.chatClear, { notebookId }),
  // studio (021) — sinh + đọc bản tổng hợp.
  studioGenerate: (input: StudioGenerateInput): Promise<StudioResult> =>
    ipcRenderer.invoke(CHANNELS.studioGenerate, input),
  studioList: (notebookId: string): Promise<StudioResult[]> =>
    ipcRenderer.invoke(CHANNELS.studioList, notebookId),
  // 178: xoá một phiên bản kết quả Studio.
  studioDeleteVersion: (
    input: StudioDeleteVersionInput,
  ): Promise<{ deleted: boolean }> =>
    ipcRenderer.invoke(CHANNELS.studioDeleteVersion, input),
  /** 149: huỷ lượt tạo đang chạy theo generationId; reason chỉ để main ghi nhật ký. */
  studioCancel: (
    generationId: string,
    reason?: "user" | "navigate",
  ): Promise<{ cancelled: boolean }> =>
    ipcRenderer.invoke(CHANNELS.studioCancel, generationId, reason),
  /** 146: nhận tiến độ tạo Studio (push từ main, kênh chỉ nhận). Trả hàm huỷ đăng ký. */
  onStudioProgress: (
    cb: (e: import("@shared/ipc/types").StudioProgressEvent) => void,
  ): (() => void) => {
    const listener = (
      _e: unknown,
      payload: import("@shared/ipc/types").StudioProgressEvent,
    ): void => cb(payload);
    ipcRenderer.on(CHANNELS.studioProgress, listener);
    return () => ipcRenderer.removeListener(CHANNELS.studioProgress, listener);
  },
  /** 178 (PR 4): nhận chữ stream của lượt viết cuối (push từ main, CHỈ cửa sổ đã gọi). Trả hàm huỷ đăng ký. */
  onStudioStreamToken: (
    cb: (e: import("@shared/ipc/types").StudioStreamTokenEvent) => void,
  ): (() => void) => {
    const listener = (
      _e: unknown,
      payload: import("@shared/ipc/types").StudioStreamTokenEvent,
    ): void => cb(payload);
    ipcRenderer.on(CHANNELS.studioStreamToken, listener);
    return () =>
      ipcRenderer.removeListener(CHANNELS.studioStreamToken, listener);
  },
  studioExport: (input: StudioExportInput): Promise<StudioExportResult> =>
    ipcRenderer.invoke(CHANNELS.studioExport, input),
  // 059 — gợi ý model theo RAM + health Ollama + trạng thái tái lập chỉ mục.
  aiRecommendModel: (): Promise<
    import("@shared/ipc/types").ModelRecommendation
  > => ipcRenderer.invoke(CHANNELS.aiRecommendModel),
  aiOllamaHealth: (): Promise<import("@shared/ipc/types").OllamaHealth> =>
    ipcRenderer.invoke(CHANNELS.aiOllamaHealth),
  // 109 — trạng thái bộ chấm độ liên quan (chỉ đọc, không tham số).
  getRerankerStatus: (): Promise<import("@shared/ipc/types").RerankerStatus> =>
    ipcRenderer.invoke(CHANNELS.aiGetRerankerStatus),
  embedReindexStatus: (): Promise<import("@shared/ipc/types").ReindexStatus> =>
    ipcRenderer.invoke(CHANNELS.embedReindexStatus),
  /** Đăng ký nhận tiến độ tái lập chỉ mục (push từ main). Trả hàm huỷ đăng ký. */
  onReindexProgress: (
    cb: (e: import("@shared/ipc/types").ReindexStatus) => void,
  ): (() => void) => {
    const listener = (
      _e: unknown,
      payload: import("@shared/ipc/types").ReindexStatus,
    ): void => cb(payload);
    ipcRenderer.on(CHANNELS.embedReindexProgress, listener);
    return () =>
      ipcRenderer.removeListener(CHANNELS.embedReindexProgress, listener);
  },
  // vault-backup (085) — KHÔNG có tham số path; đường dẫn do hộp thoại ở main chọn, restore dùng token.
  backupGetState: (): Promise<VaultBackupState> =>
    ipcRenderer.invoke(CHANNELS.backupGetState),
  backupCreate: (req: { password?: string }): Promise<BackupCreateResult> =>
    ipcRenderer.invoke(CHANNELS.backupCreate, req),
  restorePick: (): Promise<RestorePickResult> =>
    ipcRenderer.invoke(CHANNELS.restorePick),
  restorePrepare: (req: {
    token: string;
    password?: string;
  }): Promise<RestorePrepareResult> =>
    ipcRenderer.invoke(CHANNELS.restorePrepare, req),
  restoreConfirm: (token: string): Promise<RestoreConfirmResult> =>
    ipcRenderer.invoke(CHANNELS.restoreConfirm, { token }),
  restoreCancel: (token: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.restoreCancel, { token }),
  getRestoreResult: (): Promise<RestoreResult | null> =>
    ipcRenderer.invoke(CHANNELS.getRestoreResult),
  /** Tiến trình sao lưu/khôi phục theo bước (push từ main). Trả hàm huỷ đăng ký. */
  onBackupProgress: (cb: (e: VaultBackupProgress) => void): (() => void) => {
    const listener = (_e: unknown, payload: VaultBackupProgress): void =>
      cb(payload);
    ipcRenderer.on(CHANNELS.backupProgress, listener);
    return () => ipcRenderer.removeListener(CHANNELS.backupProgress, listener);
  },
  // meeting-capture (186) — một hàm cho mỗi kênh; main kiểm mọi tham số.
  meetingPrepare: (input: {
    notebookId: string;
  }): Promise<MeetingPrepareResult> =>
    ipcRenderer.invoke(CHANNELS.meetingPrepare, input),
  meetingStart: (input: MeetingStartInput): Promise<MeetingStartResult> =>
    ipcRenderer.invoke(CHANNELS.meetingStart, input),
  /** Lô PCM16 16 kHz (~1 s) — send không chờ phản hồi; ArrayBuffer được clone sang main. */
  meetingSendAudio: (batch: {
    sessionId: string;
    seq: number;
    pcm: ArrayBuffer;
  }): void => ipcRenderer.send(CHANNELS.meetingAudio, batch),
  meetingPause: (input: {
    sessionId: string;
    reason: "user" | "deviceLost";
  }): Promise<MeetingState> => ipcRenderer.invoke(CHANNELS.meetingPause, input),
  meetingResume: (input: {
    sessionId: string;
    deviceLabel?: string;
  }): Promise<MeetingState> =>
    ipcRenderer.invoke(CHANNELS.meetingResume, input),
  meetingStop: (input: { sessionId: string }): Promise<{ sourceId: string }> =>
    ipcRenderer.invoke(CHANNELS.meetingStop, input),
  meetingStatus: (): Promise<MeetingState | null> =>
    ipcRenderer.invoke(CHANNELS.meetingStatus),
  meetingRename: (input: {
    sourceId: string;
    title: string;
  }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.meetingRename, input),
  meetingSetLanguage: (input: MeetingSetLanguageInput): Promise<MeetingState> =>
    ipcRenderer.invoke(CHANNELS.meetingSetLanguage, input),
  meetingMark: (input: MeetingMarkInput): Promise<{ markerId: string }> =>
    ipcRenderer.invoke(CHANNELS.meetingMark, input),
  meetingListMarkers: (input: { sourceId: string }): Promise<MeetingMarker[]> =>
    ipcRenderer.invoke(CHANNELS.meetingListMarkers, input),
  meetingDownloadModel: (): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.meetingDownloadModel),
  meetingListRecoverable: (input: {
    notebookId?: string;
  }): Promise<RecoverableSession[]> =>
    ipcRenderer.invoke(CHANNELS.meetingListRecoverable, input),
  meetingRecover: (input: {
    sessionId: string;
    action: MeetingRecoverAction;
  }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.meetingRecover, input),
  meetingFinalizeAgain: (input: { sourceId: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.meetingFinalizeAgain, input),
  meetingGetTranscript: (input: {
    sourceId: string;
  }): Promise<MeetingTranscript> =>
    ipcRenderer.invoke(CHANNELS.meetingGetTranscript, input),
  meetingUpdateMarker: (input: {
    markerId: string;
    kind: MeetingMarkerKind;
  }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.meetingUpdateMarker, input),
  meetingDeleteMarker: (input: { markerId: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(CHANNELS.meetingDeleteMarker, input),
  /** Main dựng nội dung từ sourceId rồi mở hộp thoại lưu (renderer không gửi nội dung). */
  meetingExportMarkdown: (input: {
    sourceId: string;
  }): Promise<StudioExportResult> =>
    ipcRenderer.invoke(CHANNELS.meetingExportMarkdown, input),
  /** Số phiên cần phục hồi (push từ main tới mọi cửa sổ). Trả hàm huỷ đăng ký. */
  onMeetingRecoverable: (cb: (e: { count: number }) => void): (() => void) => {
    const listener = (_e: unknown, payload: { count: number }): void =>
      cb(payload);
    ipcRenderer.on(CHANNELS.meetingRecoverable, listener);
    return () =>
      ipcRenderer.removeListener(CHANNELS.meetingRecoverable, listener);
  },
  /** Dòng nháp (push từ main, chỉ tới cửa sổ đang ghi). Trả hàm huỷ đăng ký. */
  onMeetingDraft: (cb: (e: MeetingDraftEvent) => void): (() => void) => {
    const listener = (_e: unknown, payload: MeetingDraftEvent): void =>
      cb(payload);
    ipcRenderer.on(CHANNELS.meetingDraft, listener);
    return () => ipcRenderer.removeListener(CHANNELS.meetingDraft, listener);
  },
  /** Trạng thái phiên ghi (push từ main, chỉ tới cửa sổ đang ghi). Trả hàm huỷ đăng ký. */
  onMeetingState: (cb: (s: MeetingState) => void): (() => void) => {
    const listener = (_e: unknown, payload: MeetingState): void => cb(payload);
    ipcRenderer.on(CHANNELS.meetingState, listener);
    return () => ipcRenderer.removeListener(CHANNELS.meetingState, listener);
  },
  // enterprise-license (226) — offline Ed25519 license & entitlements
  getLicenseStatus: (): Promise<LicenseStatus> =>
    ipcRenderer.invoke(CHANNELS.licenseGetStatus),
  activateLicenseFile: (): Promise<ActivateLicenseResult> =>
    ipcRenderer.invoke(CHANNELS.licenseActivateFile),
  deactivateLicense: (): Promise<LicenseStatus> =>
    ipcRenderer.invoke(CHANNELS.licenseDeactivate),
  // 237 — mở trang mua (không nhận URL từ renderer)
  openPurchasePage: (): Promise<OpenPurchasePageResult> =>
    ipcRenderer.invoke(CHANNELS.licenseOpenPurchasePage),
  onLicenseChanged: (cb: (status: LicenseStatus) => void): (() => void) => {
    const listener = (_e: unknown, payload: LicenseStatus): void => cb(payload);
    ipcRenderer.on(CHANNELS.licenseChanged, listener);
    return () => ipcRenderer.removeListener(CHANNELS.licenseChanged, listener);
  },
  // lan-ai-and-policy (228) — LAN AI Server & IT Policy
  getPolicy: () => ipcRenderer.invoke(CHANNELS.policyGet),
  getLanAiConfig: () => ipcRenderer.invoke(CHANNELS.lanAiGetConfig),
  saveLanAiConfig: (config: unknown) =>
    ipcRenderer.invoke(CHANNELS.lanAiSaveConfig, config),
  testLanAiConnection: (params: unknown) =>
    ipcRenderer.invoke(CHANNELS.lanAiTestConnection, params),
  // shared-team-notebooks (229) — export & import .scnb package
  exportNotebookPackage: (notebookId: string) =>
    ipcRenderer.invoke(CHANNELS.notebookExportPackage, { notebookId }),
  importNotebookPackage: (opts?: { readOnly?: boolean }) =>
    ipcRenderer.invoke(CHANNELS.notebookImportPackage, opts),
};

export type Api = typeof api;

contextBridge.exposeInMainWorld("api", api);
