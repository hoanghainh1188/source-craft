import type {
  AddSourceResult,
  AppInfo,
  DataDirInfo,
  Model,
  ModelSelection,
  Notebook,
  OnboardingState,
  OnlineState,
  PrivacyState,
  UiLanguageState,
  StorageInfo,
  RagAnswer,
  RuntimeStatus,
  Source,
  SourceContent,
  ContentSearchHit,
  StudioResult,
  StudioExportResult,
  StoredChatMessage,
  ModelRecommendation,
  OllamaHealth,
  RerankerStatus,
  ReindexStatus,
  VaultBackupState,
  BackupCreateResult,
  RestorePickResult,
  RestorePrepareResult,
  RestoreConfirmResult,
  RestoreResult,
  CrashReportDraft,
  CrashNotice,
  SourceRelinkResult,
  SourceReprocessResult,
  MeetingMarker,
  MeetingPrepareResult,
  RecoverableSession,
  MeetingTranscript,
  MeetingStartResult,
  MeetingState,
  LicenseStatus,
  ActivateLicenseResult,
  EnterprisePolicy,
  LanAiConfig,
  LanAiTestResult,
} from "./types";

/**
 * Whitelist đầy đủ các kênh IPC (Constitution III). NGUỒN DUY NHẤT: main (register) + preload (expose).
 * Feature sau THÊM kênh mới ở đây — KHÔNG đổi nghĩa kênh cũ.
 * - app:*    → 001-app-shell (5 kênh)
 * - ai:*     → 007-ai-runtime (5 kênh)
 * - notebook:* → 009-notebooks (5 kênh)
 * - source:* → 011-ingestion (5 invoke + 1 event push)
 */
export const CHANNELS = {
  getDataDir: "app:getDataDir",
  getStorageInfo: "app:getStorageInfo",
  getPrivacyState: "app:getPrivacyState",
  getOnboardingState: "app:getOnboardingState",
  setOnboardingComplete: "app:setOnboardingComplete",
  getAppInfo: "app:getAppInfo",
  // ghi clipboard qua main (renderer sandbox: navigator.clipboard bị chặn bởi permission handler) (#67)
  clipboardWrite: "app:clipboardWrite",
  // app-log (088): renderer báo lỗi (chỉ loại lỗi + tên component) + mở thư mục nhật ký bằng trình quản lý tệp.
  reportRendererError: "app:reportRendererError",
  openLogsFolder: "app:openLogsFolder",
  // crash-report (093): báo lỗi opt-in — soạn báo cáo đã làm sạch, mở GitHub issue điền sẵn (đích cố định ở main),
  // thông báo khi phiên trước kết thúc bất thường.
  crashGetReport: "crash:getReport",
  crashOpenIssue: "crash:openIssue",
  crashGetNotice: "crash:getNotice",
  crashDismissNotice: "crash:dismissNotice",
  // ai-runtime (007)
  aiListModels: "ai:listModels",
  aiTestConnection: "ai:testConnection",
  aiGetSelectedModels: "ai:getSelectedModels",
  aiSetSelectedModels: "ai:setSelectedModels",
  aiGetRuntimeStatus: "ai:getRuntimeStatus",
  // online-provider (031) — AI online tùy chọn (Claude/Gemini/OpenAI)
  aiGetOnlineState: "ai:getOnlineState",
  aiSetProviderKey: "ai:setProviderKey",
  aiDeleteProviderKey: "ai:deleteProviderKey",
  aiSetProviderModel: "ai:setProviderModel",
  aiSetActiveProvider: "ai:setActiveProvider",
  aiTestProvider: "ai:testProvider",
  // 059 — gợi ý model chat theo RAM + health-check Ollama
  aiRecommendModel: "ai:recommendModel",
  aiOllamaHealth: "ai:ollamaHealth",
  // 109 — trạng thái bộ chấm độ liên quan (chỉ đọc)
  aiGetRerankerStatus: "ai:getRerankerStatus",
  // notebooks (009)
  notebookList: "notebook:list",
  notebookCreate: "notebook:create",
  notebookRename: "notebook:rename",
  notebookSetColor: "notebook:setColor",
  notebookDelete: "notebook:delete",
  // ingestion (011) — 5 invoke
  sourceAdd: "source:add",
  sourceListByNotebook: "source:listByNotebook",
  sourceGet: "source:get",
  sourceDelete: "source:delete",
  sourceRetry: "source:retry",
  // 101: chọn lại tệp gốc (hộp thoại ở main, kiểm cùng nội dung) — renderer chỉ gửi sourceId, không gửi path.
  sourceRelink: "source:relink",
  // 112: xử lý lại PDF bằng cách trích có bố cục (chỉ nhận sourceId) + huỷ.
  sourceReprocess: "source:reprocess",
  sourceReprocessCancel: "source:reprocessCancel",
  // source-viewer (019) — lấy toàn văn nguồn để hiển thị + highlight
  sourceGetContent: "source:getContent",
  // content-search (073) — tìm toàn văn nội dung nguồn trong notebook (FTS5 BM25)
  sourceSearch: "source:search",
  // ingestion (011) — 1 event push (main→renderer, KHÔNG phải invoke/ChannelResponse)
  sourceProgress: "source:progress",
  // rag-qa (013) — hỏi đáp theo nguồn
  ragAsk: "rag:ask",
  // streaming (039) — Chat trả lời chạy dần
  ragAskStream: "rag:askStream",
  ragStreamToken: "rag:streamToken", // event push main→renderer (KHÔNG vào ChannelResponse)
  ragStop: "rag:stop",
  // chat-history (027) — lưu/nạp/xoá lịch sử hội thoại theo notebook
  chatHistory: "chat:history",
  chatClear: "chat:clear",
  // studio (021) — tổng hợp tri thức từ notebook
  studioGenerate: "studio:generate",
  studioList: "studio:list",
  studioProgress: "studio:progress", // 146: event push main→renderer (KHÔNG vào ChannelResponse)
  studioStreamToken: "studio:streamToken", // 178 PR 4: push CHỈ về sender của lượt (KHÔNG vào ChannelResponse)
  studioCancel: "studio:cancel", // 149: huỷ lượt tạo theo generationId
  studioDeleteVersion: "studio:deleteVersion", // 178: xoá một phiên bản kết quả
  // studio export (025) — xuất kết quả ra tệp .md
  studioExport: "studio:export",
  // 059 embed-in-process — trạng thái tái lập chỉ mục
  embedReindexStatus: "embed:reindexStatus",
  embedReindexProgress: "embed:reindexProgress", // event push main→renderer
  // vault-backup (085) — sao lưu / khôi phục vault (path chỉ ở main; restore dùng token)
  backupGetState: "backup:getState",
  backupCreate: "backup:create",
  backupProgress: "backup:progress", // event push main→renderer
  // 103: trạng thái riêng tư đổi (local/online/sending) — event push main→renderer, không polling.
  privacyChanged: "app:privacyChanged",
  // 123: ngôn ngữ giao diện — đọc/đặt (đặt chỉ nhận auto|vi|en, main kiểm) + event push main→renderer.
  getUiLanguage: "app:getUiLanguage",
  setUiLanguage: "app:setUiLanguage",
  uiLanguageChanged: "app:uiLanguageChanged",
  restorePick: "restore:pick",
  restorePrepare: "restore:prepare",
  restoreConfirm: "restore:confirm",
  restoreCancel: "restore:cancel",
  getRestoreResult: "app:getRestoreResult",
  // meeting-capture (186) — ghi cuộc họp. Audio/FS/ASR CHỈ ở main; renderer gửi lô PCM qua kênh send meeting:audio
  // (main kiểm sender/phiên/thứ tự/kích thước/tần suất), nhận trạng thái qua push meeting:state (chỉ cửa sổ ghi).
  meetingPrepare: "meeting:prepare",
  meetingStart: "meeting:start",
  meetingAudio: "meeting:audio", // send renderer→main (KHÔNG vào ChannelResponse)
  meetingPause: "meeting:pause",
  meetingResume: "meeting:resume",
  meetingStop: "meeting:stop",
  meetingStatus: "meeting:status",
  meetingRename: "meeting:rename",
  meetingState: "meeting:state", // event push main→renderer (KHÔNG vào ChannelResponse)
  // PR B — nháp gần thời gian thực, ngôn ngữ, đánh dấu, tải model.
  meetingDraft: "meeting:draft", // event push main→renderer (KHÔNG vào ChannelResponse)
  meetingSetLanguage: "meeting:setLanguage",
  meetingMark: "meeting:mark",
  meetingListMarkers: "meeting:listMarkers",
  meetingDownloadModel: "meeting:downloadModel",
  // PR C1 — phục hồi phiên dang dở, "Hoàn tất transcript" / "Chốt lại".
  meetingListRecoverable: "meeting:listRecoverable",
  meetingRecover: "meeting:recover",
  meetingFinalizeAgain: "meeting:finalizeAgain",
  meetingRecoverable: "meeting:recoverable", // event push main→renderer (KHÔNG vào ChannelResponse)
  // PR C2 — trình xem cuộc họp.
  meetingGetTranscript: "meeting:getTranscript",
  meetingUpdateMarker: "meeting:updateMarker",
  meetingDeleteMarker: "meeting:deleteMarker",
  meetingExportMarkdown: "meeting:exportMarkdown",
  // enterprise-license (226) — offline Ed25519 license & entitlements
  licenseGetStatus: "license:getStatus",
  licenseActivateFile: "license:activateFile",
  licenseDeactivate: "license:deactivate",
  licenseChanged: "license:changed", // event push main→renderer (not in ChannelResponse)
  // lan-ai-and-policy (228) — LAN AI Server & IT Policy
  policyGet: "policy:get",
  lanAiGetConfig: "lanAi:getConfig",
  lanAiSaveConfig: "lanAi:saveConfig",
  lanAiTestConnection: "lanAi:testConnection",
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Tập tên kênh whitelisted (dùng cho guard ở main). */
export const WHITELISTED_CHANNELS: ReadonlySet<string> = new Set(
  Object.values(CHANNELS),
);

/** Guard thuần — kiểm 1 tên kênh có thuộc whitelist không (unit-test được, không cần electron). */
export function isWhitelisted(channel: string): channel is ChannelName {
  return WHITELISTED_CHANNELS.has(channel);
}

/** Bản đồ kiểu response theo kênh — dùng cho type-safety ở preload/renderer. */
export interface ChannelResponse {
  [CHANNELS.getDataDir]: DataDirInfo;
  [CHANNELS.getStorageInfo]: StorageInfo;
  [CHANNELS.getPrivacyState]: PrivacyState;
  [CHANNELS.getUiLanguage]: UiLanguageState;
  [CHANNELS.setUiLanguage]: UiLanguageState;
  [CHANNELS.getOnboardingState]: OnboardingState;
  [CHANNELS.setOnboardingComplete]: { completed: true };
  [CHANNELS.getAppInfo]: AppInfo;
  [CHANNELS.clipboardWrite]: { ok: true };
  [CHANNELS.reportRendererError]: { ok: boolean };
  [CHANNELS.openLogsFolder]: { ok: boolean };
  [CHANNELS.crashGetReport]: CrashReportDraft;
  [CHANNELS.crashOpenIssue]: { ok: boolean; throttled?: boolean };
  [CHANNELS.crashGetNotice]: CrashNotice;
  [CHANNELS.crashDismissNotice]: { ok: true };
  [CHANNELS.aiListModels]: Model[];
  [CHANNELS.aiTestConnection]: RuntimeStatus;
  [CHANNELS.aiGetSelectedModels]: ModelSelection;
  [CHANNELS.aiSetSelectedModels]: ModelSelection;
  [CHANNELS.aiGetRuntimeStatus]: RuntimeStatus;
  // online-provider (031)
  [CHANNELS.aiGetOnlineState]: OnlineState;
  [CHANNELS.aiSetProviderKey]: OnlineState;
  [CHANNELS.aiDeleteProviderKey]: OnlineState;
  [CHANNELS.aiSetProviderModel]: OnlineState;
  [CHANNELS.aiSetActiveProvider]: OnlineState;
  [CHANNELS.aiTestProvider]: RuntimeStatus;
  // 059 — gợi ý model theo RAM + health Ollama
  [CHANNELS.aiRecommendModel]: ModelRecommendation;
  [CHANNELS.aiOllamaHealth]: OllamaHealth;
  [CHANNELS.aiGetRerankerStatus]: RerankerStatus;
  [CHANNELS.notebookList]: Notebook[];
  [CHANNELS.notebookCreate]: Notebook;
  [CHANNELS.notebookRename]: Notebook;
  [CHANNELS.notebookSetColor]: Notebook;
  [CHANNELS.notebookDelete]: { deleted: true };
  // ingestion (011) — chỉ 5 kênh invoke (source:progress là event push, không vào đây).
  [CHANNELS.sourceAdd]: AddSourceResult;
  [CHANNELS.sourceListByNotebook]: Source[];
  [CHANNELS.sourceGet]: Source | null;
  [CHANNELS.sourceDelete]: { deleted: true };
  [CHANNELS.sourceRetry]: Source;
  [CHANNELS.sourceRelink]: SourceRelinkResult;
  [CHANNELS.sourceReprocess]: SourceReprocessResult;
  [CHANNELS.sourceReprocessCancel]: { cancelled: boolean };
  // source-viewer (019)
  [CHANNELS.sourceGetContent]: SourceContent | null;
  // content-search (073)
  [CHANNELS.sourceSearch]: ContentSearchHit[];
  // rag-qa (013)
  [CHANNELS.ragAsk]: RagAnswer;
  // streaming (039) — ragStreamToken là event push, không vào đây
  [CHANNELS.ragAskStream]: RagAnswer;
  [CHANNELS.ragStop]: { stopped: true };
  // studio (021)
  [CHANNELS.studioGenerate]: StudioResult;
  [CHANNELS.studioList]: StudioResult[];
  [CHANNELS.studioCancel]: { cancelled: boolean };
  [CHANNELS.studioDeleteVersion]: { deleted: boolean };
  // studio export (025)
  [CHANNELS.studioExport]: StudioExportResult;
  // chat-history (027)
  [CHANNELS.chatHistory]: StoredChatMessage[];
  [CHANNELS.chatClear]: { cleared: true };
  // 059 embed-in-process
  [CHANNELS.embedReindexStatus]: ReindexStatus;
  // vault-backup (085) — backupProgress là event push, không vào đây
  [CHANNELS.backupGetState]: VaultBackupState;
  [CHANNELS.backupCreate]: BackupCreateResult;
  [CHANNELS.restorePick]: RestorePickResult;
  [CHANNELS.restorePrepare]: RestorePrepareResult;
  [CHANNELS.restoreConfirm]: RestoreConfirmResult;
  [CHANNELS.restoreCancel]: { ok: true };
  [CHANNELS.getRestoreResult]: RestoreResult | null;
  // meeting-capture (186) — meeting:audio (send) và meeting:state (push) không vào đây
  [CHANNELS.meetingPrepare]: MeetingPrepareResult;
  [CHANNELS.meetingStart]: MeetingStartResult;
  [CHANNELS.meetingPause]: MeetingState;
  [CHANNELS.meetingResume]: MeetingState;
  [CHANNELS.meetingStop]: { sourceId: string };
  [CHANNELS.meetingStatus]: MeetingState | null;
  [CHANNELS.meetingRename]: { ok: true };
  [CHANNELS.meetingSetLanguage]: MeetingState;
  [CHANNELS.meetingMark]: { markerId: string };
  [CHANNELS.meetingListMarkers]: MeetingMarker[];
  [CHANNELS.meetingDownloadModel]: { ok: true };
  [CHANNELS.meetingListRecoverable]: RecoverableSession[];
  [CHANNELS.meetingRecover]: { ok: true };
  [CHANNELS.meetingFinalizeAgain]: { ok: true };
  [CHANNELS.meetingGetTranscript]: MeetingTranscript;
  [CHANNELS.meetingUpdateMarker]: { ok: true };
  [CHANNELS.meetingDeleteMarker]: { ok: true };
  [CHANNELS.meetingExportMarkdown]: StudioExportResult;
  // enterprise-license (226)
  [CHANNELS.licenseGetStatus]: LicenseStatus;
  [CHANNELS.licenseActivateFile]: ActivateLicenseResult;
  [CHANNELS.licenseDeactivate]: LicenseStatus;
  // lan-ai-and-policy (228)
  [CHANNELS.policyGet]: EnterprisePolicy | null;
  [CHANNELS.lanAiGetConfig]: LanAiConfig;
  [CHANNELS.lanAiSaveConfig]: { ok: boolean; error?: string };
  [CHANNELS.lanAiTestConnection]: LanAiTestResult;
}
