import type { SourceErrorCode } from "../codes/source-error";
// Kiểu trao đổi qua IPC (main ↔ renderer). Nguồn: data-model.md.

/** 123: trạng thái ngôn ngữ giao diện — lựa chọn đã lưu + ngôn ngữ hiệu lực (contracts/ipc-ui-language.md). */
export interface UiLanguageState {
  preference: "auto" | "vi" | "en";
  effective: "vi" | "en";
}

/** Trạng thái riêng tư — nguồn sự thật cho privacy indicator badge. v1 luôn 'local'. */
export interface PrivacyState {
  /** 103/228: local / lan (máy chủ AI mạng nội bộ tổ chức) / online (provider online đã bật, chưa gửi) / sending (đang có egress thật). */
  mode: "local" | "lan" | "online" | "sending";
  /** 123/228: loại egress khi mode = sending (ai > lanAi > url > model) — renderer dịch nhãn theo ngôn ngữ hiện tại. */
  egressKind?: "ai" | "lanAi" | "url" | "model";
}

/** Trạng thái onboarding lần đầu. Lưu bền ở OS settings store. */
export interface OnboardingState {
  completed: boolean;
}

/** Thông tin tĩnh của app cho header/titlebar. */
export interface AppInfo {
  name: string;
  version: string;
}

/** Kết quả đảm bảo thư mục dữ liệu cục bộ tồn tại. */
export interface DataDirInfo {
  path: string;
  ready: boolean;
}

/**
 * Báo lỗi renderer về main để ghi nhật ký (088). CHỈ loại lỗi (Error.name) + componentStack của React — KHÔNG
 * message/stack thô (có thể dính nội dung tài liệu). Main làm sạch lại (chỉ giữ tên component).
 */
export interface RendererErrorInput {
  source: "boundary" | "window" | "rejection";
  errorType: string;
  componentStack?: string;
}

/** Bản nháp báo lỗi (093) — người dùng xem/sửa trước khi tự gửi qua GitHub. Không chứa nội dung tài liệu. */
export interface CrashReportDraft {
  title: string;
  text: string;
}

/** Thông báo lúc mở app (093): phiên trước kết thúc bất thường và/hoặc có crash native mới. */
export interface CrashNotice {
  abnormalExit: boolean;
  newNativeCrashes: number;
}

/** Thông tin lưu trữ cục bộ (037) — hiển thị ở Cài đặt. Chỉ đọc metadata, không nội dung. */
export interface StorageInfo {
  /** Đường dẫn thư mục dữ liệu app. */
  path: string;
  /** Tổng dung lượng thư mục dữ liệu đang dùng (byte). */
  usedBytes: number;
  /** Dung lượng trống của ổ đĩa chứa thư mục (byte). */
  freeBytes: number;
  /** 186: dung lượng ghi âm cuộc họp (thư mục meetings/) — chỉ có khi đã từng ghi. Hộp sao lưu hiển thị. */
  meetingsBytes?: number;
}

// ===== ai-runtime (007) — nguồn: specs/.../ai-runtime/data-model.md =====

/** Một mô hình AI trên Ollama. `kind` suy đoán từ tên/metadata; UI lọc theo kind. */
export interface Model {
  name: string;
  sizeBytes: number | null;
  kind: "chat" | "embedding" | "unknown";
}

/** Lựa chọn mô hình của người dùng (lưu bền ở electron-store). null = chưa chọn. */
export interface ModelSelection {
  chatModel: string | null;
  embeddingModel: string | null;
}

/** 059 — gợi ý cỡ model chat theo RAM máy (chỉ gợi ý, không tự tải). */
export interface ModelRecommendation {
  tier: "small" | "medium" | "large";
  label: string;
  examples: string[];
  totalMemGb: number;
}

/** 059 — health-check Ollama (phục vụ chat; embedding đã in-process). */
export interface OllamaHealth {
  running: boolean;
  models: string[];
  modelPulled: boolean;
}

/** 109 — trạng thái bộ chấm độ liên quan (kênh chỉ đọc ai:getRerankerStatus); unavailable = bản ghi hiệu chuẩn không bật;
 * 153: loading = nạp từ cache (không tải). */
export type RerankerStatus =
  "unavailable" | "idle" | "downloading" | "loading" | "ready" | "error";

/** 059 — trạng thái tái lập chỉ mục (đổi engine embedding). */
export interface ReindexStatus {
  inProgress: boolean;
  done: number;
  total: number;
}

/** Trạng thái runtime AI cục bộ — nguồn cho onboarding & Cài đặt. Tách khỏi OnboardingState. */
export interface RuntimeStatus {
  /** Ollama phản hồi ping trong timeout. */
  reachable: boolean;
  /** reachable AND mô hình TRẢ LỜI đã chọn tồn tại trên máy (#124: embedding chạy in-process, không cần Ollama). */
  ollamaReady: boolean;
  /** Lý do khi chưa sẵn sàng (English, cho nhật ký) — giao diện hiển thị theo reasonCode (123). */
  reason: string | null;
  /** 123: mã lý do — giao diện dịch theo ngôn ngữ hiện tại. */
  reasonCode?: RuntimeReasonCode;
  reasonParams?: { models?: string; provider?: string };
  /** 123: lỗi gốc khi kiểm tra kết nối online thất bại (có thể mang thẻ [[err:…]] / [[online:…]]). */
  reasonError?: string;
}

export type RuntimeReasonCode =
  | "ollamaUnreachable"
  | "modelsNotSelected"
  | "modelsMissing"
  | "apiKeyMissing"
  | "modelNotSelected"
  | "connectionFailed";

/** Yêu cầu/kết quả chat & embedding (nội bộ main; KHÔNG log payload — Constitution III). */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  /** 105: cửa sổ ngữ cảnh (token) ép cho Ollama (`options.num_ctx`); provider online bỏ qua. */
  numCtx?: number;
}
export interface ChatResult {
  content: string;
}
export interface EmbedRequest {
  text: string;
  model?: string;
}
export interface EmbedResult {
  vector: number[];
}

// ===== online-provider (031) — AI online tùy chọn (Claude/Gemini/OpenAI) =====

/** Định danh 3 nhà cung cấp AI online hỗ trợ. */
export type OnlineProviderId = "anthropic" | "gemini" | "openai";

/** View 1 provider online cho renderer — KHÔNG bao giờ chứa API key (chỉ hasKey). */
export interface OnlineProviderView {
  id: OnlineProviderId;
  /** Nhãn hiển thị (VD "Claude (Anthropic)"). */
  label: string;
  /** Đã lưu API key trong keychain chưa (suy từ keytar, không lộ key). */
  hasKey: boolean;
  /** Model đang chọn cho provider này (null = chưa chọn). */
  model: string | null;
  /** Danh sách model preset gợi ý cho provider này. */
  presets: string[];
  /** Provider này có đang là active (nguồn AI đang dùng) không. */
  active: boolean;
}

/** Trạng thái toàn bộ khu vực "AI online" cho renderer. */
export interface OnlineState {
  providers: OnlineProviderView[];
  /** Provider online đang active; null = đang dùng local Ollama. */
  activeOnlineId: OnlineProviderId | null;
}

/** Input đặt API key cho 1 provider (key CHỈ đi tới main, lưu keytar, không log). */
export interface SetProviderKeyInput {
  id: OnlineProviderId;
  apiKey: string;
}

/** Input đặt model đã chọn cho 1 provider. */
export interface SetProviderModelInput {
  id: OnlineProviderId;
  model: string | null;
}

// ===== notebooks (009) — nguồn: specs/.../notebooks/data-model.md =====

/** Màu notebook — hex thuộc palette cố định. */
export type NotebookColor = string;

/** Notebook (metadata). `sourceCount` = 0 ở feature này (source thuộc 004). */
export interface Notebook {
  id: string;
  name: string;
  color: NotebookColor;
  createdAt: number;
  updatedAt: number;
  sourceCount: number;
  /** 229: Sổ tay dùng chung chỉ đọc (gắn kết từ gói .scnb hoặc ổ mạng). */
  readOnly?: boolean;
}

export interface CreateNotebookInput {
  name: string;
  color: NotebookColor;
}
export interface RenameNotebookInput {
  id: string;
  name: string;
}
export interface SetColorInput {
  id: string;
  color: NotebookColor;
}

// ===== ingestion (011) — nguồn: specs/.../ingestion/data-model.md =====

export type SourceKind =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "url"
  | "audio"
  | "video"
  | "image"
  /** 186: nguồn cuộc họp — ghi trực tiếp trong app, audio do app sở hữu. Không bao giờ suy từ đuôi tệp. */
  | "meeting";

/** Vùng bao chữ trên ảnh (053), chuẩn hoá 0..1 theo kích thước ảnh → overlay co giãn theo `<img>`. */
export interface Bbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Trạng thái vòng đời nguồn. Ánh xạ UI: ready→.stat ready; queued/processing/awaiting_embedding→.stat proc; error→.stat err. */
export type SourceStatus =
  "queued" | "processing" | "awaiting_embedding" | "ready" | "error";

/** Vị trí gốc của một chunk trong nguồn — gắn NGAY lúc chunk (Constitution II). half-open [charStart, charEnd). */
export interface Locator {
  /** PDF: số trang 1-based; loại khác: null. */
  page: number | null;
  charStart: number;
  charEnd: number;
  /** Audio (045): mốc thời gian (giây) của đoạn được trích dẫn — cho player seek (2a-player). */
  tStart?: number;
  tEnd?: number;
  /** Ảnh (053): vùng chữ OCR (chuẩn hoá 0..1) — cho overlay highlight trên `<img>`. */
  bbox?: Bbox;
}

/** Nguồn (metadata) — KHÔNG expose origin/content_hash toàn văn ra renderer. */
export interface Source {
  id: string;
  notebookId: string;
  kind: SourceKind;
  title: string;
  status: SourceStatus;
  /** 123: mã lỗi nguồn (cột error_label lưu mã) — giao diện dịch theo ngôn ngữ hiện tại. */
  errorCode: SourceErrorCode | null;
  pageCount: number | null;
  createdAt: number;
  updatedAt: number;
  /** 112: cách trích đã dùng cho văn bản/chunk hiện tại (1 = trước 112; PDF bố cục = PDF_EXTRACTION_VERSION). */
  extractionVersion: number;
  /** 186: chỉ có với kind="meeting" — giai đoạn phiên ghi (nhãn UI thay cho status). */
  meetingPhase?: MeetingPhase;
  /** 186: chỉ có với kind="meeting" đã hoàn tất — transcript chốt hay dùng tạm bản nháp. */
  transcriptQuality?: TranscriptQuality;
}

/** 112: phiên bản cách trích PDF có bố cục (dòng/cột/bảng). PDF có version thấp hơn ⇒ gợi ý "Xử lý lại". */
export const PDF_EXTRACTION_VERSION = 3; // 147: trang xoay + bảng số căn phải + gạch nối

/** Chunk (đoạn) — đơn vị embed & trích dẫn. */
export interface Chunk {
  id: string;
  sourceId: string;
  ordinal: number;
  text: string;
  locator: Locator;
}

export type AddSourceInput =
  | { notebookId: string; kind: "url"; url: string }
  | {
      notebookId: string;
      kind: Exclude<SourceKind, "url">;
      filePath: string;
    };

export interface AddSourceResult {
  source: Source;
  /** true nếu trùng content_hash/URL trong cùng notebook (renderer hỏi xác nhận). */
  duplicateWarning: boolean;
}

/** Bước xử lý hiện thời của pipeline (cho thanh tiến độ). */
export type IngestStep =
  "parse" | "clean" | "chunk" | "embed" | "store" | "done";

/** Event push main→renderer khi trạng thái/tiến độ một nguồn đổi (kênh source:progress). */
export interface SourceProgressEvent {
  sourceId: string;
  notebookId: string;
  status: SourceStatus;
  step: IngestStep;
  progress: number; // 0..1
  errorCode?: SourceErrorCode;
  /** 112: sự kiện của một lần "Xử lý lại" — nguồn vẫn `ready` (dùng dữ liệu cũ) trong lúc chạy. */
  reprocess?: true;
}

/**
 * 112: kết quả yêu cầu "Xử lý lại" (contracts/ipc-reprocess.md). queued = đã xếp hàng (theo dõi qua source:progress
 * có `reprocess`); missing = tệp gốc không còn ⇒ dẫn sang "Chọn lại tệp gốc…"; mismatch = tệp gốc đã bị sửa ⇒ chặn.
 */
export type SourceReprocessResult =
  { status: "queued" } | { status: "missing" } | { status: "mismatch" };

/**
 * Kết quả "chọn lại tệp gốc" (101). mismatch = tệp khác nội dung tệp đã nạp (trích dẫn sẽ sai ⇒ từ chối);
 * wrongType = đuôi không thuộc loại nguồn; notApplicable = nguồn URL/không tồn tại; busy = nguồn đang xếp hàng/xử
 * lý hoặc đang có 1 lần chọn lại khác; locked = vault đang sao lưu/khôi phục.
 */
export type SourceRelinkResult = {
  status:
    | "ok"
    | "cancelled"
    | "mismatch"
    | "wrongType"
    | "notApplicable"
    | "busy"
    | "locked"
    | "error";
};

// ===== rag-qa (013) — nguồn: specs/.../rag-qa/data-model.md =====

/** Chế độ trả lời: theo nguồn (grounded, không bịa) / mở rộng (open, dùng thêm kiến thức chung). */
export type RagMode = "grounded" | "open";

/** Một lượt hội thoại (renderer giữ in-memory, gửi ~6 lượt gần nhất cho multi-turn). */
export interface RagTurn {
  role: "user" | "assistant";
  content: string;
}

/** Đích AI của 1 lượt (098): mặc định provider đang bật; "local" = Ollama (sau lỗi online, người dùng chọn). */
export type AiTarget = "active" | "local";

export type RagSearchScope = "current" | "all";

export interface RagAskInput {
  notebookId: string;
  question: string;
  mode: RagMode;
  history: RagTurn[];
  target?: AiTarget;
  scope?: RagSearchScope;
}

/** Trích dẫn: số [n] trong câu trả lời → chunk/nguồn/vị trí thật (dữ liệu cho source-viewer 006). */
export interface Citation {
  n: number;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  locator: Locator;
  notebookId?: string;
  notebookName?: string;
}

// ===== content-search (073) — tìm toàn văn nội dung nguồn (FTS5 BM25) =====

/** Input tìm toàn văn trong 1 notebook. */
export interface ContentSearchInput {
  notebookId: string;
  query: string;
  scope?: RagSearchScope;
}

/** 1 kết quả tìm: mở rộng Citation (bấm → openCitation mở Source Viewer + highlight) + đoạn trích. */
export interface ContentSearchHit extends Citation {
  /** Đoạn trích ngắn của chunk (đã gọn khoảng trắng, cắt tối đa ~160 ký tự). */
  snippet: string;
}

/** Kết quả hỏi đáp — answer đã hậu kiểm (gỡ chip lỗi), citations chỉ gồm [n] hợp lệ & thực xuất hiện. */
export interface RagAnswer {
  answer: string;
  citations: Citation[];
  notFound: boolean; // true khi grounded không đủ căn cứ
  modeUsed: RagMode;
  /** 123: notebook đang tái lập chỉ mục (059) — giao diện hiện câu dịch; không lưu lịch sử. */
  reindexing?: boolean;
}

// ===== streaming (039) — Chat trả lời chạy dần =====

/** Input rag:askStream = RagAskInput + streamId (renderer sinh, để tương quan token + huỷ). */
export interface RagAskStreamInput extends RagAskInput {
  streamId: string;
}

/** Sự kiện token đẩy từ main → renderer trong lúc stream (push, không phải invoke/response). */
export interface RagStreamTokenEvent {
  streamId: string;
  delta: string;
}

/** Một tin trong lịch sử hội thoại đã lưu bền theo notebook (027-chat-history). */
export interface StoredChatMessage {
  role: "user" | "assistant";
  content: string;
  citations: Citation[]; // assistant; user = []
  notFound: boolean;
  /** 071: chế độ đã dùng cho câu trả lời (assistant). "open" → badge "không dựa trên nguồn". */
  modeUsed?: RagMode;
  createdAt: number;
}

// ===== source-viewer (019) — nguồn: specs/.../source-viewer/data-model.md =====

/** Mốc trang PDF: offset ký tự toàn cục nơi mỗi trang bắt đầu trong `SourceContent.text`. */
export interface PageBreak {
  page: number; // 1-based
  offset: number; // charStart của trang trong text
}

/** Nội dung nguồn để hiển thị ở viewer — tái dựng runtime từ chunk, không lưu bền. */
export interface SourceContent {
  kind: SourceKind;
  title: string;
  pageCount: number | null; // PDF: số trang; khác: null
  text: string; // toàn văn đã-làm-sạch tái dựng (== T gốc lúc chunk)
  pageBreaks: PageBreak[]; // chỉ PDF; non-PDF: []
  /** 112: chỉ có khi yêu cầu kèm chunkId — false ⇒ trích dẫn cũ (nguồn đã được xử lý lại), không tô sáng. */
  citationValid?: boolean;
}

// ===== studio (021) — nguồn: specs/.../studio/data-model.md =====

/** Loại bản tổng hợp Studio (khác nhau ở system prompt). 178: + 4 loại mới (PR 2). */
export type StudioKind =
  | "summary"
  | "keyPoints"
  | "faq"
  | "outline"
  | "studyGuide"
  | "briefing"
  | "timeline"
  | "keyTerms"
  | "custom"; // 178 (PR 3): yêu cầu tuỳ chỉnh

/** Kết quả tổng hợp Studio = một PHIÊN BẢN (178) — content dạng text kèm chip [n]; citations đã hậu kiểm (Constitution II). */
export interface StudioResult {
  id: string;
  notebookId: string;
  kind: StudioKind;
  content: string; // text kèm token [n]
  citations: Citation[]; // đã hậu kiểm; rỗng chỉ khi content rỗng (không lưu bản rỗng)
  createdAt: number;
  truncated?: boolean; // true khi còn phần tài liệu KHÔNG được tổng hợp (vượt số phần tối đa)
  /** 105: số phần đã tổng hợp (>1 ⇒ map-reduce; chip [n] vẫn trỏ đúng đoạn). 178: lưu cùng phiên bản (thiếu ở dòng cũ). */
  parts?: number;
  /** 178 (G4): phiên bản tạo bằng "Tạo bằng AI cục bộ" (target local, 098) — lưu DB, thiếu ở dòng cũ. */
  local?: boolean;
  /** 178 (PR 3): yêu cầu tuỳ chỉnh đã chuẩn hoá — chỉ có ở kind "custom". Hiển thị dạng văn bản thường. */
  customPrompt?: string;
  /** 178 (PR 4): phạm vi nguồn đã chuẩn hoá của phiên bản; thiếu = mọi nguồn ready lúc tạo (hoặc dòng cũ). */
  sourceIds?: string[];
}

/** 178: xoá một phiên bản Studio — main chỉ xoá khi `id` thuộc `notebookId`. */
export interface StudioDeleteVersionInput {
  notebookId: string;
  id: string;
}

/** Input sinh 1 bản tổng hợp cho notebook theo loại. */
export interface StudioGenerateInput {
  notebookId: string;
  kind: StudioKind;
  sourceId?: string; // 025: lọc theo 1 nguồn; bỏ trống = toàn bộ nguồn ready
  /** 178 (PR 4): nhiều nguồn (thắng `sourceId`); main kiểm thuộc notebook + ready, ≤ 50; rỗng = mọi nguồn ready. */
  sourceIds?: string[];
  /** 178 (PR 3): bắt buộc khi kind = "custom" (main kiểm ≤ 500 code point); loại khác ⇒ bỏ qua. */
  customPrompt?: string;
  target?: AiTarget; // 098: "local" = tạo bằng Ollama sau lỗi online
  /** 123 (FR-018): ngôn ngữ đầu ra = ngôn ngữ giao diện lúc bấm tạo; sai/thiếu ⇒ ngôn ngữ hiệu lực của main. */
  outputLanguage?: "vi" | "en";
  /** 146: định danh lượt tạo (renderer sinh) — thiếu/không hợp lệ ⇒ main không phát tiến độ. */
  generationId?: string;
}

/** 146: pha tiến độ Studio — thứ tự tăng dần (renderer bỏ sự kiện lùi). */
export type StudioProgressPhase = "reading" | "condensing" | "writing";

/** 146: sự kiện push `studio:progress` — KHÔNG mang nội dung tài liệu/ghi chú. `index`/`total` chỉ ở pha `reading`. */
export interface StudioProgressEvent {
  generationId: string;
  notebookId: string;
  kind: StudioKind;
  phase: StudioProgressPhase;
  /** Phần đang đọc, 1-based. */
  index?: number;
  /** Số phần thực chạy (= `parts`). */
  total?: number;
}

/**
 * 178 (PR 4): sự kiện push `studio:streamToken` — một mẩu chữ của LƯỢT VIẾT CUỐI, chỉ gửi về cửa sổ đã gọi studio:generate.
 * KHÔNG mang notebookId / kind / nội dung nguồn / yêu cầu tuỳ chỉnh. Renderer lọc theo generationId hiện hành.
 */
export interface StudioStreamTokenEvent {
  generationId: string;
  delta: string;
}

/** Input xuất kết quả Studio ra tệp .md (025). */
export interface StudioExportInput {
  content: string;
  suggestedName: string;
}

/** Kết quả xuất tệp: saved=false khi người dùng huỷ hộp thoại. */
export interface StudioExportResult {
  saved: boolean;
  path?: string;
}

// ── vault-backup (085) — sao lưu / khôi phục vault. Renderer KHÔNG nhận/gửi đường dẫn file (token thay path).

/** Mã lỗi sao lưu/khôi phục (không kèm path/nội dung). `badPasswordOrCorrupt` gộp sai mật khẩu + file hỏng. */
export type VaultBackupErrorCode =
  | "busy"
  | "passwordTooShort"
  | "notBackup"
  | "unsupportedFormat"
  | "badPasswordOrCorrupt"
  | "passwordRequired"
  | "newerSchema"
  | "diskFull"
  | "tokenInvalid"
  | "ioError";

export interface VaultBackupState {
  busy: boolean;
  reason: "processing" | "reindexing" | "operation" | null;
}

export type VaultBackupStep =
  "snapshot" | "pack" | "decrypt" | "verify" | "preBackup";

/** Event push `backup:progress` (main→renderer). */
export interface VaultBackupProgress {
  op: "backup" | "restore";
  step: VaultBackupStep;
}

export type VaultBackupError = { status: "error"; code: VaultBackupErrorCode };

export type BackupCreateResult =
  | { status: "ok"; fileName: string; sizeBytes: number; dir: string }
  | { status: "cancelled" }
  | VaultBackupError;

export type RestorePickResult =
  | { status: "ok"; token: string; encrypted: boolean }
  | { status: "cancelled" }
  | VaultBackupError;

/** Tóm tắt bản sao lưu hiển thị trước khi xác nhận khôi phục (từ manifest đã xác thực). */
export interface BackupSummary {
  createdAt: string;
  appVersion: string;
  notebookCount: number;
  sourceCount: number;
  encrypted: boolean;
  /** Mô hình embedding khác app hiện tại → sẽ tái lập chỉ mục nền sau khôi phục (059). */
  needsReindex: boolean;
}

export type RestorePrepareResult =
  { status: "ok"; summary: BackupSummary } | VaultBackupError;

/** `restore:confirm` — thành công thì app thoát + khởi động lại (renderer thường không kịp nhận). */
export type RestoreConfirmResult = { status: "relaunching" } | VaultBackupError;

/** Kết quả lần khôi phục gần nhất — đọc 1 lần ở lần mở app đầu sau hoán đổi (FR-016a). */
export type RestoreResult =
  | { ok: true; backupCreatedAt: string; preRestorePath: string | null }
  | { ok: false; reason: "swapFailed" };

// ===== meeting capture (186) — nguồn: specs/20261012-072338-meeting-capture/{data-model,contracts/meeting-ipc}.md =====

/** Giai đoạn phiên ghi (data-model §5). Ánh xạ status: done|incomplete ⇒ ready; còn lại ⇒ processing. */
export type MeetingPhase =
  | "recording"
  | "paused"
  | "stopping"
  | "finalizing"
  | "interrupted"
  | "incomplete"
  | "done";

/** Chế độ ngôn ngữ ghi (D6) — KHÁC uiLanguage (123). */
export type LanguageMode = "auto" | "vi" | "en" | "multi";

export type TranscriptQuality = "final" | "draft";

/** 186 PR B — một dòng nháp (cửa sổ 10 s, id ổn định `w<index>`); `pending` = lượt 5 s chưa đủ cửa sổ ("Đang nhận dạng"). */
export interface MeetingDraftLine {
  id: string;
  tStart: number;
  tEnd: number;
  text: string;
  pending: boolean;
}

export type MeetingMarkerKind = "decision" | "actionItem" | "question";

export interface MeetingMarker {
  id: string;
  kind: MeetingMarkerKind;
  /** Giây thời gian audio. Đánh dấu điểm: tEnd = tStart. */
  tStart: number;
  tEnd: number;
}

export type PauseGapReason = "user" | "deviceLost" | "interrupted";

/** Khoảng ngừng — metadata, KHÔNG vào văn bản lập chỉ mục (D2). */
export interface PauseGap {
  /** Vị trí trên trục thời gian audio (giây). */
  atSec: number;
  /** Độ dài thực (giây) của lần ngừng. */
  wallSeconds: number;
  reason: PauseGapReason;
}

export type MicStatus =
  "granted" | "notDetermined" | "denied" | "restricted" | "unknown";

export interface MeetingPrepareResult {
  micStatus: MicStatus;
  modelReady: boolean;
  modelSizeMb: number;
  minutesRemaining: number;
  canStart: boolean;
  onlineActive: boolean;
  recordingActive: boolean;
  lastDeviceLabel?: string;
  lastLanguageMode?: LanguageMode;
  /** 186: CHỈ bản chưa đóng gói chạy e2e (IV_E2E_FAKE_MIC) — renderer thay micro bằng tín hiệu thử. */
  testFakeMic?: true;
}

export interface MeetingStartInput {
  notebookId: string;
  title: string;
  languageMode: LanguageMode;
  deviceLabel?: string;
}

export interface MeetingStartResult {
  sessionId: string;
  sourceId: string;
}

export type DiskLevel = "ok" | "warn" | "urgent" | "stop";

export interface CaptureSegmentInfo {
  index: number;
  durationSec: number;
  closed: boolean;
}

/** Trạng thái phiên đang hoạt động (push meeting:state, invoke meeting:status). */
export interface MeetingState {
  sessionId: string;
  sourceId: string;
  notebookId: string;
  title: string;
  phase: "recording" | "paused" | "stopping" | "finalizing" | "interrupted";
  /** Thời gian audio đã ghi (giây) — không tính khoảng tạm dừng. */
  durationSec: number;
  segments: CaptureSegmentInfo[];
  pauseReason?: "user" | "deviceLost";
  /** Main tự kết thúc phiên (review B1): renderer tắt micro + hiện lý do. Không có ⇒ người dùng kết thúc. */
  endReason?:
    "diskFull" | "noAudio" | "rendererGone" | "crash" | "limitReached";
  diskLevel: Exclude<DiskLevel, "stop">;
  minutesRemaining: number;
  /** PR B. */
  transcriptLagging: boolean;
  /** PR B. */
  modelReady: boolean;
  /** PR B — ngôn ngữ nhận dạng (R7, D6). */
  language: MeetingLanguageState;
  /** PR B — khoảng tạm dừng (dòng phân cách "Tạm dừng N phút" trong nháp). */
  pauseGaps: PauseGap[];
}

/** PR B — trạng thái ngôn ngữ hiển thị ở thanh dưới màn ghi. */
export interface MeetingLanguageState {
  mode: LanguageMode;
  current: "vi" | "en" | null;
  status: "detecting" | "locked" | "manual" | "multi";
  suggestion?: "vi" | "en";
}

/** Push `meeting:draft` (main→renderer, chỉ cửa sổ ghi). `full` = danh sách đầy đủ (gắn lại sau reload) thay vì phần đổi. */
export interface MeetingDraftEvent {
  sessionId: string;
  windows: MeetingDraftLine[];
  full: boolean;
}

export type MeetingSetLanguageInput =
  | { sessionId: string; action: "lock"; lang: "vi" | "en" }
  | { sessionId: string; action: "acceptSuggestion" }
  | { sessionId: string; action: "dismissSuggestion" };

export interface MeetingMarkInput {
  sessionId: string;
  kind: MeetingMarkerKind;
  tStart: number;
  tEnd?: number;
}

/** PR C2 — dữ liệu trình xem cuộc họp (văn bản lấy từ source:getContent). */
export interface MeetingTranscript {
  spans: { charStart: number; charEnd: number; tStart: number; tEnd: number }[];
  /** Đánh dấu kèm trích đoạn (câu chứa mốc / các câu trong khoảng). */
  markers: (MeetingMarker & { excerpt: string })[];
  pauseGaps: PauseGap[];
  language: "vi" | "en" | null;
  quality: TranscriptQuality | null;
  durationSec: number;
  startedAt: number;
  endedAt: number | null;
}

/** PR C1 — phiên bị gián đoạn chờ người dùng chọn cách phục hồi (thẻ phục hồi). */
export interface RecoverableSession {
  sessionId: string;
  sourceId: string;
  notebookId: string;
  title: string;
  durationSec: number;
  startedAt: number;
}

export type MeetingRecoverAction = "finalize" | "keepIncomplete" | "discard";

/** Lô PCM renderer→main (kênh send meeting:audio). */
export interface MeetingAudioBatch {
  sessionId: string;
  seq: number;
  pcm: ArrayBuffer;
}

// ===== enterprise-license (226) — nguồn: specs/20261024-194623-enterprise-license/{data-model,contracts/license-ipc}.md =====

/** Commercial tier of the application. */
export type LicenseTier = "free" | "pro" | "enterprise";

/** B2B feature flags unlocked by a license payload. */
export type LicenseFeature =
  | "multimedia"
  | "studioPro"
  | "meetingLong"
  | "lanAi"
  | "sharedNotebooks"
  | "itPolicy"
  | "crossNotebookSearch";

/** Signed payload inside a `.sclicense` file. */
export interface LicensePayload {
  schemaVersion: 1;
  /** Unique license identifier (UUID v4). */
  licenseId: string;
  /** Organization or customer display name (1..120 chars). */
  orgName: string;
  /** Target tier (`pro` or `enterprise`). */
  tier: Exclude<LicenseTier, "free">;
  /** Number of licensed seats (integer >= 1). */
  seats: number;
  /** ISO-8601 UTC timestamp when the license was issued. */
  issuedAt: string;
  /** ISO-8601 UTC timestamp when the license expires, or `null` for perpetual. */
  expiresAt: string | null;
  /** Explicit feature flags enabled for this license. */
  features: LicenseFeature[];
}

/** Structure of a `.sclicense` JSON file on disk. */
export interface LicenseFile {
  payload: LicensePayload;
  /** Base64url-encoded 64-byte Ed25519 signature over canonical JSON of `payload`. */
  sig: string;
}

/** Effective entitlements computed from the active license state. */
export interface Entitlements {
  tier: LicenseTier;
  /** Max notebooks allowed (`3` for free, `null` for unlimited). */
  maxNotebooks: number | null;
  /** Max sources per notebook (`10` for free, `null` for unlimited). */
  maxSourcesPerNotebook: number | null;
  /** Max seconds per meeting recording (`900` for free, `null` for unlimited). */
  maxMeetingSeconds: number | null;
  /** Allowed source kinds for `source:add`. */
  allowedSourceKinds: SourceKind[];
  /** Allowed Studio synthesis kinds for `studio:generate`. */
  allowedStudioKinds: StudioKind[];
  /** Enabled B2B feature flags. */
  features: LicenseFeature[];
}

/** Validation state of the stored license. */
export type LicenseState =
  "free" | "valid" | "expired" | "invalid" | "clockTampered";

/** Full license status returned to the renderer (`license:getStatus` / `license:changed`). */
export interface LicenseStatus {
  state: LicenseState;
  tier: LicenseTier;
  orgName: string | null;
  seats: number | null;
  issuedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  entitlements: Entitlements;
}

/** Error codes specific to `.sclicense` file activation. */
export type LicenseActivationErrorCode =
  | "invalidFormat"
  | "invalidSignature"
  | "expired"
  | "clockTampered"
  | "ioError";

/** Result of `license:activateFile` IPC call. */
export type ActivateLicenseResult =
  | { status: "ok"; license: LicenseStatus }
  | { status: "cancelled" }
  | { status: "error"; code: LicenseActivationErrorCode };

/** 237 — kết quả `license:openPurchasePage` (mở trang mua bằng trình duyệt hệ thống). */
export type OpenPurchasePageResult =
  { ok: true } | { ok: false; throttled?: true };

// 228 — LAN AI Server & Enterprise IT Policy Types

export type LanAiProviderKind = "lan-ollama" | "lan-openai";

export interface PreconfiguredLanAi {
  enabled: boolean;
  provider: LanAiProviderKind;
  baseUrl: string;
  chatModel?: string;
}

export interface EnterprisePolicy {
  schemaVersion: 1;
  policyId: string;
  organization: string;
  /** When true, disables all commercial cloud AI providers (OpenAI, Anthropic, Gemini). */
  forceLocalOnly: boolean;
  /** Optional extra allowed domain suffixes or exact hostnames for LAN AI SSRF check. */
  allowedLanHosts?: string[];
  /** Optional preconfigured LAN AI server settings provided by IT admin. */
  preconfiguredLanAi?: PreconfiguredLanAi;
  /** Enforces password protection when creating backups. */
  enforceBackupEncryption?: boolean;
}

export interface LanAiConfig {
  enabled: boolean;
  provider: LanAiProviderKind;
  baseUrl: string;
  chatModel: string | null;
  hasCustomToken: boolean;
}

export interface LanAiTestResult {
  ok: boolean;
  error?: string;
  models?: string[];
}

// 229 — Shared Team Notebooks (.scnb) Types

export interface NotebookPackageManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  color?: string;
  createdAt: number;
  exportedAt: number;
  sourceCount: number;
  chunkCount: number;
  checksum: string;
}

export interface PackageSourceRecord {
  id: string;
  title: string;
  kind: SourceKind;
  charCount?: number;
  tokenCount?: number;
}

export interface PackageChunkRecord {
  id: string;
  sourceId: string;
  text: string;
  charStart?: number;
  charEnd?: number;
}

export interface PackageVectorRecord {
  chunkId: string;
  vector: number[];
}

export interface NotebookPackageData {
  manifest: NotebookPackageManifest;
  sources: PackageSourceRecord[];
  chunks: PackageChunkRecord[];
  vectors: PackageVectorRecord[];
}

export interface ExportPackageResult {
  ok: boolean;
  filePath?: string;
  cancelled?: boolean;
}

export interface ImportPackageResult {
  ok: boolean;
  notebook?: Notebook;
  cancelled?: boolean;
}
