import {
  createMicGate,
  decideMediaPermission,
  decidePermissionCheck,
} from "./services/app-shell/permissions";
import {
  ARM_WINDOW_MS,
  DRAFT_FALLBACK_MODEL,
  FINAL_MODEL,
  FSYNC_SEC,
  SAMPLE_RATE,
  segmentSeconds,
} from "./services/meeting-capture/meeting-constants";
import {
  createMeetingService,
  type MeetingService,
} from "./services/meeting-capture/meeting-service";
import { UserFacingError } from "@shared/codes/user-error";
import { createMeetingRepo } from "./services/meeting-capture/meeting-repo";
import { createMeetingViewerApi } from "./services/meeting-capture/meeting-viewer";
import { getSourceContent } from "./services/source-viewer/source-content";
import { exportMarkdown } from "./services/studio/export";
import { formatDateTime } from "@shared/i18n/format";
import { createMeetingFiles } from "./services/meeting-capture/meeting-files";
import {
  createAsrClient,
  type UtilityProcessLike,
} from "./services/meeting-capture/asr-client";
import { playbackTarget } from "./services/meeting-capture/segments";
import {
  createQuitGuard,
  type QuitGuard,
} from "./services/meeting-capture/quit-guard";
import type { MicStatus } from "@shared/ipc/types";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { createLicenseService } from "./services/license/license-service";
import { createPolicyService } from "./services/policy/policy-service";
import { createPackageService } from "./services/notebooks/package/package-service";
import { setLanProviderActive } from "./services/app-shell/privacy-state";
import {
  app,
  BrowserWindow,
  crashReporter,
  dialog,
  Menu,
  nativeImage,
  Notification,
  powerSaveBlocker,
  protocol,
  session,
  shell,
  systemPreferences,
  utilityProcess,
  webContents,
} from "electron";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import Store from "electron-store";
import { CHANNELS } from "@shared/ipc/channels";
import type { SourceProgressEvent } from "@shared/ipc/types";
import { ensureDataDir } from "./services/app-shell/data-dir";
import { resolveLegacyUserDataPath } from "./services/app-shell/user-data-path";
import { buildAboutPanelOptions } from "./services/app-shell/about-panel";
import { loadLibraries } from "./services/app-shell/about-licenses";
import { registerIpc } from "./ipc/register";
import { openDatabase } from "./db/database";
import { runMigrations } from "./db/migrations";
import { createNotebookRepo } from "./services/notebooks/notebook-repo";
import { createAiRuntime } from "./services/ai-runtime/ai-runtime";
import { createIngestion } from "./services/ingestion/ingestion";
import { createRagService } from "./services/rag/rag-service";
import { rewriteQuery } from "./services/rag/rewrite";
import { createKeywordStore } from "./services/ingestion/keyword-store";
import { createChatRepo } from "./services/rag/chat-repo";
import { createStudioRepo } from "./services/studio/studio-repo";
import { createStudioService } from "./services/studio/studio-service";
import { createContentSearch } from "./services/search/content-search";
import {
  getPrivacyState,
  onPrivacyChange,
  setEgressActive,
} from "./services/app-shell/privacy-state";
import { startupErrorDialog } from "./services/app-shell/startup-error";
import { createMediaHandler } from "./services/source-viewer/media-serve";
import { logError, logEvent, setLogSink } from "./logging";
import { createFileSink, resolveLogsDir } from "./services/app-log/log-file";
import { createNodeLogFs } from "./services/app-log/log-fs";
import { createSessionMarker } from "./services/crash-report/session-marker";
import {
  createNodeMarkerFs,
  listCrashDumps,
  readLogTail,
  restrictDumpDir,
} from "./services/crash-report/crash-fs";
import { createCrashService } from "./services/crash-report/crash-service";
import { createPurchasePageOpener } from "./services/license-upsell/purchase-page";
import { createRelink } from "./services/ingestion/relink";
import { createReprocessRequest } from "./services/ingestion/reprocess-request";
import { pickSourceFile } from "./services/ingestion/relink-dialog";
import { hashFileStreaming } from "./services/ingestion/ingestion";
import {
  pickProvider as pickProviderFor,
  type AiTarget,
} from "./services/ai-runtime/ai-target";
import { numCtxFor, studioContextFor } from "./services/studio/context-window";
import { runReindex, needsReindex } from "./services/embedding/reindex-runner";
import { createReindexingCheck } from "./services/embedding/reindex-check";
import { recommendChatModel } from "./services/ai/model-recommend";
import { checkOllama } from "./services/ai/ollama-health";
import type { ReindexStatus } from "@shared/ipc/types";
import { arch, cpus, homedir, release, totalmem } from "node:os";
import { applyPendingRestore } from "./services/vault-backup/restore-swap";
import { createBackupService } from "./services/vault-backup/backup-service";
import {
  createVaultLock,
  isMaintenanceBusy,
} from "./services/vault-backup/vault-lock";
import {
  createVectorMaintenance,
  type VectorMaintenance,
} from "./services/vector-maintenance/maintenance";
import { BACKUP_WAIT_TIMEOUT_MS } from "./services/vector-maintenance/constants";
import { createFsOps } from "./services/app-shell/storage-fs";
import { dirSize } from "./services/app-shell/storage-info";
import { createElectronDialogs } from "./services/vault-backup/dialogs";
import {
  createUiLanguageService,
  startupLanguage,
} from "./services/ui-language";
import { createTranslator } from "@shared/i18n";
import { createReranker, type Reranker } from "./services/rerank/rerank-model";
import { appMenuTemplate } from "./services/ui-language/app-menu";
import {
  RERANK_MODEL,
  RERANK_MODEL_REVISION,
  RERANK_MODEL_VERSION,
  rerankModelFile,
} from "./services/rerank/model-version";
import {
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_VERSION,
} from "./services/embedding/model-version";
import { RELEVANCE_CALIBRATION } from "./services/rag/relevance-calibration";

/** 123: locale OS ưu tiên đầu tiên; an toàn cả trước app.whenReady (getLocale có thể rỗng). */
function systemLocale(): string | undefined {
  try {
    return app.getPreferredSystemLanguages()[0] ?? app.getLocale();
  } catch {
    return undefined;
  }
}

// 049: đăng ký scheme iv-media:// là privileged (stream + fetch API) TRƯỚC khi app ready — cho <audio> phát
// file audio gốc qua main (renderer sandbox không đọc FS). Handler đăng ký ở whenReady (cần sourceRepo).
// 186 PR C2: `standard` + `secure` — thiếu hai quyền này, Chromium phát media qua iv-media được vài trăm ms rồi báo
// "PIPELINE_ERROR_READ: data source error" ở yêu cầu Range kế tiếp (phát/tua audio-video-cuộc họp). stream: <audio>/<video>.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "iv-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

// Hardening cấp session (Constitution I & III): mặc định TỪ CHỐI mọi permission; chặn mở device (USB/HID/serial).
// 186: ngoại lệ DUY NHẤT — micro (media, audio-only) cho cửa sổ chính của app, chỉ trong cổng ngắn sau khi người dùng
// bấm Bắt đầu ghi/Tiếp tục (micGate). Chính sách là hàm thuần ở services/app-shell/permissions.ts (có test).
const micGate = createMicGate(Date.now, ARM_WINDOW_MS);
// 186: tạo trong whenReady (cần DB/pipeline); createWindow dùng cho render-process-gone.
let meetingService: MeetingService | null = null;
// 186 PR C1: hỏi xác nhận khi thoát/đóng cửa sổ lúc đang ghi (tạo sau khi có meetingService).
let quitGuard: QuitGuard | null = null;
let mainWebContentsId: number | null = null;

function installSecurity(): void {
  const ses = session.defaultSession;
  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  const appIndexUrl = pathToFileURL(
    join(__dirname, "../renderer/index.html"),
  ).href;
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    const granted = decideMediaPermission({
      permission,
      mediaTypes: (details as { mediaTypes?: string[] }).mediaTypes,
      requestingUrl: details.requestingUrl,
      isMainFrame: details.isMainFrame,
      isMainWindow: wc.id === mainWebContentsId,
      armedUntil: micGate.armedUntil(),
      now: Date.now(),
      devUrl,
      appIndexUrl,
    });
    // Review M1: cổng dùng MỘT lần — đã cấp cho lần getUserMedia này thì đóng (Tiếp tục/đổi thiết bị mở lại).
    if (granted) micGate.disarm();
    cb(granted);
  });
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin, details) =>
    decidePermissionCheck({
      permission,
      mediaType: (details as { mediaType?: string }).mediaType,
      requestingUrl: details.requestingUrl ?? requestingOrigin,
      isMainWindow: wc !== null && wc.id === mainWebContentsId,
      devUrl,
      appIndexUrl,
    }),
  );
  ses.setDevicePermissionHandler(() => false);
}

// Icon runtime (041/045): dock macOS lúc DEV + window/taskbar Windows/Linux đều dùng icon Electron mặc định
// nếu không set (bản đóng gói mac dùng .icns từ bundle; win dùng .ico của exe). Tìm build/icon.png ở dev
// (app root) hoặc resources (đóng gói, qua extraResources). Trả null nếu không có → giữ mặc định.
function resolveIconPath(): string | null {
  const candidates = [
    join(app.getAppPath(), "build", "icon.png"),
    join(process.resourcesPath, "icon.png"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

// Đã từng dựng cửa sổ chưa (chốt một chiều) — phân biệt lỗi giai đoạn khởi động vs lỗi runtime muộn.
let everShownWindow = false;

function createWindow(): void {
  everShownWindow = true;
  const iconPath = resolveIconPath();
  const win = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 900, // #128: đủ chỗ 3 cột Workspace (Chat ≥ 320px khi Nguồn/Studio co về tối thiểu)
    minHeight: 480,
    show: false,
    ...(iconPath ? { icon: iconPath } : {}), // Windows/Linux taskbar + window
    // Frame OS mặc định (clarify A3) — nút minimize/maximize/close native.
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      // Ranh giới bảo mật bất biến (Constitution III / ADR D5).
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWebContentsId = win.webContents.id; // 186: chỉ cửa sổ chính được xin micro
  // 186 (P1): renderer của cửa sổ ghi chết ⇒ đóng phiên an toàn + hoàn tất (không để phiên "đang ghi" mồ côi).
  const wcId = win.webContents.id;
  win.webContents.on("render-process-gone", () =>
    meetingService?.onRendererGone(wcId),
  );
  win.once("ready-to-show", () => win.show());
  // 186 PR C1 (FR-038): đóng cửa sổ chính khi đang ghi ⇒ hỏi; đồng ý ⇒ kết thúc phiên rồi mới đóng.
  win.on("close", (e) => quitGuard?.intercept(e, () => win.close()));

  // Local-first: chặn mọi điều hướng ra ngoài + cửa sổ popup ngoài (Constitution I).
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, url) => {
    // Chỉ cho phép nội bộ app (dev server localhost hoặc file:// đã load). Mọi URL khác → chặn cứng.
    const allowed = process.env["ELECTRON_RENDERER_URL"] ?? "file://";
    if (!url.startsWith(allowed) && !url.startsWith("file://")) {
      e.preventDefault();
      logEvent("navigation.blocked", { blocked: true });
    }
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// Xử lý lỗi khởi động: hiện dialog rõ ràng thay vì "chết âm thầm" (cửa sổ show:false, không catch →
// createWindow không chạy → app mở nhưng biến mất). Chỉ THOÁT khi lỗi xảy ra TRƯỚC khi có cửa sổ
// (giai đoạn khởi động); nếu đã có cửa sổ, lỗi runtime muộn chỉ log — không giết phiên người dùng.
// Constitution III: chỉ log errorType (không path/nội dung); detail dialog do hàm thuần startupErrorDialog dựng.
// Trạng thái nhật ký/phiên (088/093) khai báo TRƯỚC mọi handler dùng tới — uncaughtException có thể bắn ngay lúc
// nạp module, đọc biến `let` khai báo sau sẽ dính TDZ.
let logsDir = "";
/** Phiên trước kết thúc bất thường? (tính lúc khởi động, đọc bởi crash service). */
let abnormalExit = false;
/** Khởi động thất bại ⇒ GIỮ tệp đánh dấu phiên: lần mở sau vẫn mời gửi báo cáo (093). */
let keepSessionMarker = false;

let fatalHandled = false;
function handleFatalStartup(err: unknown): void {
  if (fatalHandled) return;
  // 123: ngôn ngữ OS (cài đặt có thể chưa đọc được ở giai đoạn này).
  const { title, detail, errorType } = startupErrorDialog(
    err,
    createTranslator(startupLanguage(systemLocale())),
  );
  // 088: lỗi muộn (đã có cửa sổ) ghi riêng "runtime.uncaught" để phân biệt khi đọc nhật ký.
  logError(everShownWindow ? "runtime.uncaught" : "startup.error", {
    errorType,
  });
  // Chốt một chiều: chỉ THOÁT nếu chưa từng dựng cửa sổ (giai đoạn khởi động). Không dùng số cửa sổ
  // hiện tại vì trên macOS đóng hết cửa sổ KHÔNG thoát app (idle ở dock) → sẽ về 0 và hiểu nhầm lỗi
  // runtime muộn là lỗi khởi động rồi giết phiên người dùng. Sau khi UI đã lên, lỗi muộn chỉ log.
  if (everShownWindow) return;
  fatalHandled = true;
  keepSessionMarker = true;
  dialog.showErrorBox(title, detail);
  app.quit();
}

process.on("uncaughtException", handleFatalStartup);
process.on("unhandledRejection", handleFatalStartup);

// Single-instance lock (#70): 2 tiến trình cùng ghi SQLite/LanceDB + cùng chạy reindex nền lúc khởi động
// → hỏng dữ liệu/race migration. Instance thứ 2 KHÔNG lấy được lock → thoát ngay và focus cửa sổ đang có
// (không chạy init). Guard trong whenReady chặn init kể cả khi handler kịp chạy trước lúc quit hoàn tất.
// Đổi tên sản phẩm → SourceCraft: bản cài thật đã có dữ liệu ở thư mục userData cũ → ghim lại để không "mất" dữ liệu.
// PHẢI chạy trước requestSingleInstanceLock/getPath("userData") (khoá + log + DB đều nằm trong userData).
const legacyUserData = resolveLegacyUserDataPath({
  isPackaged: app.isPackaged,
  hasUserDataSwitch: app.commandLine.hasSwitch("user-data-dir"),
  appData: app.getPath("appData"),
  exists: existsSync,
});
if (legacyUserData) app.setPath("userData", legacyUserData);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}
const sessionMarker = (dir: string) =>
  createSessionMarker({ dir, fs: createNodeMarkerFs() });
/** Thoát sạch ⇒ xoá tệp đánh dấu phiên. Gọi cả ở đường app.exit (không phát will-quit). */
const endSession = (): void => {
  if (logsDir && !keepSessionMarker) sessionMarker(logsDir).end();
};
app.on("will-quit", endSession);

// 088: nhật ký ra file — chỉ instance giữ lock (instance thứ 2 thoát ngay, không tranh ghi cùng tệp). Lỗi dựng
// sink ⇒ chỉ còn console, app vẫn chạy (nhật ký là phụ trợ, không được làm hỏng khởi động).
if (gotSingleInstanceLock) {
  try {
    logsDir = resolveLogsDir({
      packaged: app.isPackaged,
      osLogsPath: app.getPath("logs"),
      userDataPath: app.getPath("userData"),
    });
    setLogSink(
      createFileSink({
        dir: logsDir,
        fs: createNodeLogFs(),
        onError: (errorType) =>
          console.error("[SourceCraft] logfile.disabled", { errorType }),
      }),
    );
  } catch (e) {
    console.error("[SourceCraft] logfile.init.error", {
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
  }
  logEvent("app.start", {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged,
  });

  // 093: crash native ghi minidump CHỈ trên máy (ADR crash-report-clarify) — không bao giờ tự tải lên; dump có
  // thể chứa nội dung tài liệu trong bộ nhớ nên cũng không đính kèm vào báo cáo.
  crashReporter.start({ uploadToServer: false });
  try {
    restrictDumpDir(app.getPath("crashDumps"));
  } catch (e) {
    logEvent("crash.dumpDirRestrictFailed", {
      errorType: e instanceof Error ? e.constructor.name : typeof e,
    });
  }
  // Tệp đánh dấu phiên: còn sót lúc khởi động ⇒ lần trước không thoát sạch ⇒ mời người dùng gửi báo cáo.
  if (logsDir) {
    abnormalExit = sessionMarker(logsDir).begin();
    if (abnormalExit) logEvent("app.previousSessionAbnormal", {});
  }
}

// 088: tiến trình renderer/GPU/utility chết — trước đây không để lại dấu vết. Chỉ log lý do + mã thoát.
app.on("render-process-gone", (_e, _wc, details) => {
  logError("renderer.gone", {
    reason: details.reason,
    exitCode: details.exitCode,
  });
});
app.on("child-process-gone", (_e, details) => {
  logError("childProcess.gone", {
    type: details.type,
    reason: details.reason,
    exitCode: details.exitCode,
  });
});

app.on("second-instance", () => {
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app
  .whenReady()
  .then(async () => {
    // Instance thứ 2 (không có lock) đã gọi app.quit() — KHÔNG chạy init để tránh chạm DB/LanceDB.
    if (!gotSingleInstanceLock) return;
    // Icon dock macOS: bản đóng gói lấy từ bundle .icns; khi DEV thì phải set thủ công (nếu không → icon
    // Electron mặc định). Không lỗi nếu thiếu file/không phải macOS.
    if (process.platform === "darwin" && app.dock) {
      const ic = resolveIconPath();
      if (ic) app.dock.setIcon(nativeImage.createFromPath(ic));
    }
    // Đảm bảo data dir tồn tại (FR-011/012). userData = chuẩn OS (F1).
    const dataDir = await ensureDataDir(app.getPath("userData"));
    if (!dataDir.ready) {
      // 088: không log đường dẫn (chứa tên tài khoản) — dialog bên dưới đã hiện cho người dùng.
      logError("datadir.error", { ready: false });
      keepSessionMarker = true;
      const trStartup = createTranslator(startupLanguage(systemLocale()));
      dialog.showErrorBox(
        trStartup.t("dialogs.dataDir.title"),
        trStartup.t("dialogs.dataDir.detail", { path: dataDir.path }),
      );
      app.quit();
      return;
    }

    // 085: hoán đổi vault đã dàn dựng (khôi phục) TRƯỚC khi mở config/DB/LanceDB. Lỗi rollback ⇒ ném (fatal
    // startup dialog) thay vì mở DB rỗng. Không log path.
    const restoreOutcome = await applyPendingRestore(
      dataDir.path,
      undefined,
      logEvent,
    );
    if (restoreOutcome !== "none") {
      logEvent("vaultBackup.restoreApplied", { outcome: restoreOutcome });
    }

    const store = new Store();
    // 123: ngôn ngữ giao diện — lựa chọn ở store, auto ⇒ locale OS; IV_UI_LANG chỉ cho bản chưa đóng gói (e2e/dev).
    const uiLanguage = createUiLanguageService({
      store,
      osLocale: systemLocale,
      envOverride: process.env.IV_UI_LANG,
      isPackaged: app.isPackaged,
    });

    // SQLite (009): mở DB trong data dir, chạy migration (nay tới v2 — bảng source/chunk), tạo repo.
    const db = openDatabase(join(dataDir.path, "insightvault.db"));
    runMigrations(db);
    const notebookRepo = createNotebookRepo(db);

    // ai-runtime (007) — một instance dùng chung cho kênh ai:* và pipeline embed.
    const aiRuntime = createAiRuntime(store);

    // 228 — Enterprise IT Policy Service (reads enterprise-policy.json)
    const policyService = createPolicyService({
      userDataPath: join(dataDir.path, "enterprise-policy.json"),
      fileExists: (p) => existsSync(p),
      readFileText: (p) => readFileSync(p, "utf-8"),
      logEvent: (event, meta) =>
        logEvent(
          event,
          (meta as Record<string, string | number | boolean>) ?? {},
        ),
    });

    const lanConfigRaw = store.get("lanAi.config") as
      Record<string, unknown> | undefined;
    if (lanConfigRaw && Boolean(lanConfigRaw["enabled"])) {
      setLanProviderActive(true);
    }

    // 226 — Enterprise License & Feature Gate (100% offline Ed25519 signature verification).
    // E2E seam (unpackaged only): IV_E2E_LICENSE_TIER allows existing feature E2E suites (Studio, Ingestion, etc.)
    // to run with unlocked capabilities unless specifically testing Free-tier restrictions.
    const e2eTierEnv = !app.isPackaged
      ? process.env["IV_E2E_LICENSE_TIER"]
      : undefined;
    const defaultTier =
      e2eTierEnv === "enterprise" ||
      e2eTierEnv === "pro" ||
      e2eTierEnv === "free"
        ? e2eTierEnv
        : "free";
    const licenseService = createLicenseService({
      store,
      defaultTier,
      ...(!app.isPackaged && process.env["SC_LICENSE_PUBKEY_PEM"]
        ? { publicKeyPem: process.env["SC_LICENSE_PUBKEY_PEM"] }
        : {}),
      pickFile: async () => {
        const parent = BrowserWindow.getFocusedWindow();
        const opts = {
          properties: ["openFile" as const],
          filters: [{ name: "SourceCraft License", extensions: ["sclicense"] }],
        };
        const res = parent
          ? await dialog.showOpenDialog(parent, opts)
          : await dialog.showOpenDialog(opts);
        if (res.canceled || res.filePaths.length === 0) return null;
        return res.filePaths[0] ?? null;
      },
      readFileBytes: async (filePath) =>
        new Uint8Array(await readFile(filePath)),
      broadcast: (status) => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed())
            w.webContents.send(CHANNELS.licenseChanged, status);
        }
      },
      logEvent: (event, meta) => logEvent(event, meta ?? {}),
    });

    // ingestion (011): LanceDB + pipeline. Progress push tới mọi cửa sổ qua source:progress.
    // 109: bộ chấm độ liên quan (cross-encoder in-process) — chỉ khi bản ghi hiệu chuẩn bật. Tải nền một lần vào data dir
    // (badge egress "model"); chưa sẵn sàng/lỗi ⇒ retrieve() bỏ qua bước chấm (fail-open).
    const rerankCal = RELEVANCE_CALIBRATION.rerank;
    const reranker: Reranker | null = rerankCal
      ? createReranker({
          cacheDir: join(dataDir.path, "models"),
          model: rerankCal.model,
          revision: RERANK_MODEL_REVISION,
          modelFile: rerankModelFile(),
          maxTokens: rerankCal.maxTokens,
          setOnline: (online, kind) => setEgressActive(online, kind ?? "model"),
        })
      : null;

    const emitProgress = (e: SourceProgressEvent): void => {
      // 109: nguồn đầu tiên sẵn sàng ⇒ tải nền bộ chấm (idempotent) để lượt hỏi đầu không phải chờ.
      if (e.status === "ready" && !e.reprocess) reranker?.prefetch();
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send(CHANNELS.sourceProgress, e);
      }
    };
    // 116: tạo sau vaultLock (bên dưới); ingestion gọi qua ref lười như isVaultLocked.
    let vectorMaintenance: VectorMaintenance | null = null;
    const ingestion = await createIngestion({
      db,
      dataDir: dataDir.path,
      aiRuntime,
      emit: emitProgress,
      // bật chỉ báo khi fetch URL (FR-019) / tải model lần đầu — 103: loại egress quyết định nhãn badge.
      setOnline: (online, kind) => setEgressActive(online, kind ?? "url"),
      // 112: gọi lúc hoán đổi dữ liệu của "Xử lý lại" (sau khi vaultLock đã được tạo bên dưới).
      isVaultLocked: () => vaultLock.isLocked(),
      // 116: đếm ghi cho bảo trì kho vector (bộ điều phối tạo bên dưới, sau vaultLock).
      onVectorWrite: () => vectorMaintenance?.notifyWrite(),
      // 186: meetingService tạo bên dưới (cần pipeline) ⇒ ref lười.
      onRemoveMeeting: async (sourceId) =>
        meetingService?.onSourceRemoved(sourceId),
    });

    // 109 (review): người dùng đã có nguồn sẵn sàng từ trước (nâng cấp, không thêm nguồn mới) ⇒ tải nền bộ chấm sau khi mở app
    // (trễ nhẹ để không tranh tài nguyên lúc khởi động), thay vì đợi nguồn mới sẵn sàng.
    if (reranker) {
      setTimeout(() => {
        if (ingestion.sourceRepo.listByStatus("ready").length > 0) {
          reranker.prefetch();
        }
      }, 5000).unref?.();
    }

    // 186: Ghi cuộc họp — tệp trong <userData>/meetings/, ASR trong utilityProcess (tách khỏi việc ghi audio).
    const meetingRepo = createMeetingRepo(db);
    const meetingFiles = createMeetingFiles(join(dataDir.path, "meetings"), {
      fsyncSec: FSYNC_SEC,
    });
    const modelsDir = join(dataDir.path, "models");
    const asrClient = createAsrClient({
      workerPath: join(__dirname, "asr-worker.js"),
      meetingsRoot: meetingFiles.meetingsRoot,
      cacheDir: modelsDir,
      finalModel: FINAL_MODEL,
      fallbackModel: DRAFT_FALLBACK_MODEL,
      // ASR giả tất định CHỈ cho e2e trên bản chưa đóng gói (R15).
      fake: process.env["IV_ASR_FAKE"] === "1" && !app.isPackaged,
      fork: (path, args) =>
        utilityProcess.fork(path, args, {
          serviceName: "SourceCraft ASR",
          stdio: "ignore",
        }) as unknown as UtilityProcessLike,
      onModelDownload: (active) => setEgressActive(active, "model"),
    });
    const toMicStatus = (s: string): MicStatus =>
      s === "not-determined"
        ? "notDetermined"
        : s === "granted" || s === "denied" || s === "restricted"
          ? s
          : "unknown";
    let keepAwakeId: number | null = null;
    // 186 PR C1 (T127): e2e soak — main tự bơm PCM tăng tốc N× (CHỈ bản chưa đóng gói).
    const audioPumpSpeed = app.isPackaged
      ? 0
      : Math.max(0, Number(process.env["IV_E2E_AUDIO_PUMP"]) || 0);
    meetingService = createMeetingService({
      repo: meetingRepo,
      pipeline: ingestion.pipeline,
      sources: ingestion.sourceRepo,
      notebookExists: (id) => notebookRepo.list().some((n) => n.id === id),
      files: meetingFiles,
      asr: asrClient,
      freeBytes: async () => {
        try {
          const s = await createFsOps().statfs(dataDir.path);
          return s.bavail * s.bsize;
        } catch {
          return 0;
        }
      },
      micGate,
      mediaAccess: {
        status: () =>
          process.env["IV_E2E_MIC_DENIED"] === "1" && !app.isPackaged
            ? "denied"
            : process.platform === "darwin" || process.platform === "win32"
              ? toMicStatus(
                  systemPreferences.getMediaAccessStatus("microphone"),
                )
              : "unknown",
        ask: () =>
          process.platform === "darwin"
            ? systemPreferences.askForMediaAccess("microphone")
            : Promise.resolve(true),
      },
      isOnlineActive: () => getPrivacyState().mode !== "local",
      isModelReady: async () =>
        process.env["IV_ASR_FAKE"] === "1" && !app.isPackaged
          ? true
          : existsSync(join(modelsDir, FINAL_MODEL)),
      prefs: { get: (k) => store.get(k), set: (k, v) => store.set(k, v) },
      push: (id, state) => {
        const wc = webContents.fromId(id);
        if (wc && !wc.isDestroyed()) wc.send(CHANNELS.meetingState, state);
      },
      pushDraft: (id, ev) => {
        const wc = webContents.fromId(id);
        if (wc && !wc.isDestroyed()) wc.send(CHANNELS.meetingDraft, ev);
      },
      // Người dùng bấm "Tải model": worker nạp (tải lần đầu) model chốt + model nháp dự phòng — chỉ báo riêng tư "đang tải
      // model" qua onModelDownload. Mọi lỗi (thiếu mạng, worker sập, quá giờ) ⇒ báo lỗi, KHÔNG coi là đã có model.
      downloadModel: async () => {
        try {
          await asrClient.load("primary");
          await asrClient.load("fallback");
        } catch {
          throw new UserFacingError("meetingModelDownloadFailed");
        }
      },
      // Quyết định 2026-10-13: chỉ hạ cấp nháp khi model dự phòng ĐÃ có trên máy — không tự tải giữa cuộc họp.
      fallbackReady: () =>
        (process.env["IV_ASR_FAKE"] === "1" && !app.isPackaged) ||
        existsSync(join(modelsDir, DRAFT_FALLBACK_MODEL)),
      removeSource: async (sourceId) => {
        await ingestion.pipeline.remove(sourceId);
      },
      pushRecoverable: (count) => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed())
            w.webContents.send(CHANNELS.meetingRecoverable, { count });
        }
      },
      keepAwake: (on) => {
        if (on && keepAwakeId === null)
          keepAwakeId = powerSaveBlocker.start("prevent-app-suspension");
        else if (!on && keepAwakeId !== null) {
          powerSaveBlocker.stop(keepAwakeId);
          keepAwakeId = null;
        }
      },
      machineInfo: () => ({
        platform: process.platform,
        arch: arch(),
        cpu: (cpus()[0]?.model ?? "unknown").trim().slice(0, 80),
        cores: cpus().length,
        ramGb: Math.round(totalmem() / 1024 ** 3),
      }),
      emitProgress: (sourceId, notebookId, frac) =>
        emitProgress({
          sourceId,
          notebookId,
          status: "processing",
          step: "parse",
          progress: frac,
        }),
      notifyReady: (_sourceId, _notebookId, title) => {
        // D15: thông báo hệ điều hành khi cửa sổ không focus (toast trong app do renderer hiện theo source:progress).
        if (BrowserWindow.getFocusedWindow() || !Notification.isSupported())
          return;
        new Notification({
          title: app.getName(),
          body: uiLanguage
            .translator()
            .t("meeting.finalize.readyToast", { title }),
        }).show();
      },
      logEvent: (event, meta) => logEvent(event, meta ?? {}),
      now: Date.now,
      uuid: randomUUID,
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => clearInterval(h),
      segmentSeconds: segmentSeconds(app.isPackaged, process.env),
      sampleRate: SAMPLE_RATE,
      // e2e (R15, spike S1): tín hiệu thử thay micro / giả lập bị từ chối — CHỈ bản chưa đóng gói.
      testFakeMic: process.env["IV_E2E_FAKE_MIC"] === "1" && !app.isPackaged,
      testAudioPump: audioPumpSpeed > 0,
      maxDurationSec: () =>
        licenseService.gate.getEntitlements().maxMeetingSeconds,
    });
    const meeting = meetingService;
    quitGuard = createQuitGuard({
      isRecording: () => meeting.isActive(),
      ask: async () => {
        // e2e (chỉ bản chưa đóng gói): trả lời hộp thoát không cần bấm.
        const seam = process.env["IV_E2E_QUIT_ANSWER"];
        if (!app.isPackaged && (seam === "confirm" || seam === "cancel"))
          return seam === "confirm";
        const t = uiLanguage.translator();
        const opts = {
          type: "warning" as const,
          buttons: [t.t("meeting.quit.cancel"), t.t("meeting.quit.confirm")],
          defaultId: 0,
          cancelId: 0,
          message: t.t("meeting.quit.title"),
          detail: t.t("meeting.quit.body"),
        };
        const parent = BrowserWindow.getAllWindows().find(
          (w) => !w.isDestroyed(),
        );
        const r = parent
          ? await dialog.showMessageBox(parent, opts)
          : await dialog.showMessageBox(opts);
        return r.response === 1;
      },
      stopForQuit: () => meeting.stopForQuit(),
      log: logEvent,
    });
    const guard = quitGuard;
    const pumpFixture = process.env["IV_E2E_AUDIO_FIXTURE"];
    let pumpPcm: Buffer | null = null;
    try {
      pumpPcm =
        audioPumpSpeed > 0 && pumpFixture
          ? readFileSync(pumpFixture).subarray(44)
          : null;
    } catch {
      logEvent("meeting.pumpFixtureMissing");
    }
    if (pumpPcm && pumpPcm.length >= SAMPLE_RATE * 2) {
      const pcm = pumpPcm;
      const CHUNK = SAMPLE_RATE * 2; // 1 s
      let at = 0;
      setInterval(() => {
        if (meeting.status()?.phase !== "recording") return;
        // 0,1 s thời gian thực ⇒ N × 0,1 s audio, theo lô 1 s, lặp lại fixture.
        for (let i = 0; i < Math.max(1, audioPumpSpeed / 10); i++) {
          if (at + CHUNK > pcm.length) at = 0;
          meeting.pumpTestAudio(new Uint8Array(pcm.subarray(at, at + CHUNK)));
          at += CHUNK;
        }
      }, 100).unref();
    }
    app.on("before-quit", (e) => guard.intercept(e, () => app.quit()));
    app.on("will-quit", () => {
      meeting.dispose();
      asrClient.dispose();
    });

    // 049 (2a-player): phục vụ file audio gốc cho <audio> qua iv-media:// (đọc file CHỈ main, tra sourceId→
    // path từ DB, chỉ nguồn kind=audio). Local: không egress. 186: nguồn cuộc họp — tệp do main tra từ phiên ghi.
    protocol.handle(
      "iv-media",
      createMediaHandler(ingestion.sourceRepo, (sourceId, seg) => {
        const s = meetingRepo.get(sourceId);
        if (!s) return null;
        const t = playbackTarget(
          s.segments,
          meetingFiles.hasMerged(s.sessionId),
          seg,
        );
        if (!t) return null;
        return t.kind === "merged"
          ? meetingFiles.mergedPath(s.sessionId)
          : meetingFiles.segmentPath(s.sessionId, t.index);
      }),
    );

    // chat-history (027): lưu bền hội thoại theo notebook (migration #4).
    const chatRepo = createChatRepo(db);
    // 055: keyword store BM25 (FTS5, migration #7) — cùng DB SQLite.
    const keywordStore = createKeywordStore(db);

    // rag-qa (013): hỏi đáp theo nguồn. embed/chat qua provider active (007); search/getChunks (011).
    // 027: persist mỗi lượt qua chatRepo.saveTurn (best-effort, không log nội dung).
    // 059: trạng thái tái lập chỉ mục (đổi engine embedding). rag:ask báo "đang tái lập" khi inProgress.
    const reindex: ReindexStatus = { inProgress: false, done: 0, total: 0 };

    // 098 (ADR online-fallback-clarify): đích AI theo lượt — "local" lấy thẳng Ollama, không đổi provider đang bật.
    const pickProvider = (target: AiTarget) =>
      pickProviderFor(aiRuntime.registry, target);
    // 105 (review S5): CÙNG num_ctx cho mọi lượt chat Ollama (hỏi đáp + Studio). Ollama nạp lại model khi num_ctx đổi
    // ⇒ dùng chung tránh nạp lại mỗi lần chuyển Chat ↔ Studio; hỏi đáp cũng không bị cắt ở cửa sổ mặc định nhỏ.
    const chatNumCtx = async (
      target: AiTarget,
    ): Promise<number | undefined> => {
      const p = pickProvider(target);
      if (p.id !== "ollama") return undefined;
      const tokens = (await p.contextTokens?.().catch(() => null)) ?? null;
      return numCtxFor(tokens) ?? undefined;
    };

    const makeRagService = (target: AiTarget) =>
      createRagService({
        // 059: embed CÂU TRUY VẤN in-process (e5 query) — thay Ollama. Dùng CHUNG embedder với ingestion
        // (passage) → cùng không gian vector, nhất quán index. Không cần Ollama cho embed.
        embed: async (text) =>
          (await ingestion.embedder.embed([text], "query"))[0],
        // 059 PER-NOTEBOOK (research R4): chỉ chặn notebook CHƯA nhúng đủ vector. Notebook đã xong (số vector =
        // số chunk) hỏi đáp bình thường dù reindex toàn cục còn chạy. Notebook rỗng (0 chunk) → không chặn.
        // 231: null (tìm toàn cục) → chặn khi còn notebook nào chưa nhúng xong.
        reindexing: createReindexingCheck({
          inProgress: () => reindex.inProgress,
          listNotebookIds: () => notebookRepo.list().map((n) => n.id),
          countChunks: (nb) => ingestion.sourceRepo.countChunksByNotebook(nb),
          countVectors: (nb) => ingestion.vectorStore.countByNotebook(nb),
        }),
        search: (v, nb, k) => ingestion.vectorStore.search(v, nb, k),
        getChunksByIds: (ids) => ingestion.sourceRepo.getChunksByIds(ids),
        sourceTitle: (sid) =>
          ingestion.sourceRepo.getById(sid)?.title ?? "Source",
        sourceNotebook: (sid) => {
          const src = ingestion.sourceRepo.getById(sid);
          if (!src) return null;
          const nb = notebookRepo.list().find((n) => n.id === src.notebookId);
          return {
            notebookId: src.notebookId,
            notebookName: nb?.name,
          };
        },
        // 055 hybrid: BM25 keyword (FTS5) + vector cho MMR. rewrite qua provider active (badge egress 031).
        searchBm25: (nb, query, k) => keywordStore.searchBm25(nb, query, k),
        getVectorsByIds: (ids) => ingestion.vectorStore.getVectorsByIds(ids),
        // 109: bộ chấm độ liên quan (cấu hình từ RELEVANCE_CALIBRATION.rerank); bỏ qua ⇒ chỉ ghi mã lý do, không nội dung.
        ...(reranker
          ? {
              rerank: (q: string, ps: { id: string; text: string }[]) =>
                reranker.score(q, ps),
              onRerankSkip: (reason: string) =>
                logEvent("rerank.skip", { reason }),
            }
          : {}),
        rewrite: (question, history) =>
          rewriteQuery(
            question,
            history,
            async (messages) =>
              (
                await pickProvider(target).chat({
                  messages,
                  numCtx: await chatNumCtx(target),
                })
              ).content,
          ),
        chat: async (messages) =>
          (
            await pickProvider(target).chat({
              messages,
              numCtx: await chatNumCtx(target),
            })
          ).content,
        // Streaming (039): cùng provider active, truyền onToken/signal xuống chat.
        chatStream: async (messages, opts) =>
          (
            await pickProvider(target).chat(
              { messages, numCtx: await chatNumCtx(target) },
              opts,
            )
          ).content,
        saveTurn: (nb, userContent, assistant) =>
          chatRepo.saveTurn(nb, userContent, assistant),
      });
    // 098: bản "active" (provider đang bật) + bản "local" (Ollama cho MỌI lệnh LLM, kể cả rewrite) — người dùng
    // bấm "Trả lời bằng AI cục bộ" sau lỗi online. Provider chọn LÚC GỌI ⇒ đổi provider trong Cài đặt có hiệu lực ngay.
    const ragServices = {
      active: makeRagService("active"),
      local: makeRagService("local"),
    };

    // studio (021): tổng hợp toàn notebook. Gom chunk qua source-repo (011), chat qua provider active (007),
    // lưu bền vào studio_result (migration #3). KHÔNG log nội dung.
    const makeStudioService = (target: AiTarget) =>
      createStudioService({
        defaultOutputLanguage: () => uiLanguage.get().effective,
        listSources: (nb) => ingestion.sourceRepo.listByNotebook(nb),
        listChunks: (sid) => ingestion.sourceRepo.listChunks(sid),
        studioRepo: createStudioRepo(db),
        // 149: signal huỷ đi xuống provider (nhánh không-stream huỷ được fetch, ném ChatAbortedError ≠ timeout).
        // 178 (PR 4): onToken (chỉ lượt viết cuối) ⇒ nhánh STREAM của provider — huỷ trả phần dở, KHÔNG ném (service tự chặn).
        chat: async (messages, o) =>
          (
            await pickProvider(target).chat(
              { messages, numCtx: o?.numCtx },
              o?.signal || o?.onToken
                ? {
                    ...(o.signal ? { signal: o.signal } : {}),
                    ...(o.onToken ? { onToken: o.onToken } : {}),
                  }
                : undefined,
            )
          ).content,
        // 105: ngân sách + num_ctx theo cửa sổ ngữ cảnh của model đang dùng (ADR studio-large-clarify).
        contextInfo: async () => {
          const p = pickProvider(target);
          const tokens = (await p.contextTokens?.().catch(() => null)) ?? null;
          return studioContextFor(p.id, tokens);
        },
      });
    const studioServices = {
      active: makeStudioService("active"),
      local: makeStudioService("local"),
    };

    // content-search (073): tìm toàn văn nội dung nguồn (BM25 FTS5) → chunk → ContentSearchHit. Chỉ đọc.
    const contentSearch = createContentSearch({
      searchBm25: (nb, query, k) => keywordStore.searchBm25(nb, query, k),
      getChunksByIds: (ids) => ingestion.sourceRepo.getChunksByIds(ids),
      getSourceTitle: (sid) =>
        ingestion.sourceRepo.getById(sid)?.title ?? "Source",
    });

    // 085 vault-backup: busy = nguồn queued/processing hoặc reindex nền; khoá chặn ghi lúc chụp/sau xác nhận.
    const vaultLock = createVaultLock({
      hasActiveSources: () =>
        ingestion.sourceRepo.listByStatus("queued").length > 0 ||
        ingestion.sourceRepo.listByStatus("processing").length > 0 ||
        // 112: "Xử lý lại" giữ nguồn ở `ready` ⇒ phải hỏi pipeline (đang ghi vector/chunk mới).
        ingestion.pipeline.isReprocessing(),
      isReindexing: () => reindex.inProgress,
    });
    // 116: bảo trì kho vector ngầm (gộp fragment + dọn phiên bản cũ) — chỉ chạy khi kho yên (isVaultBusy),
    // không UI/IPC; quan sát qua main.log (vector.maintenance.*). Chỉ đo kích thước/dung lượng trống, không đọc nội dung.
    const vectorsDir = join(dataDir.path, "vectors");
    const fsOps = createFsOps();
    vectorMaintenance = createVectorMaintenance({
      store: ingestion.vectorStore,
      // 186 PR C1 (T116, D8): phiên đang ghi không chặn bảo trì vector (ghi audio không đụng LanceDB).
      isBusy: () =>
        isMaintenanceBusy(vaultLock, {
          isReindexing: () => reindex.inProgress,
          processingSourceIds: () =>
            ingestion.sourceRepo.listByStatus("processing").map((s) => s.id),
          queuedCount: () => ingestion.sourceRepo.listByStatus("queued").length,
          isReprocessing: () => ingestion.pipeline.isReprocessing(),
          recordingSourceId: () => meetingService?.status()?.sourceId ?? null,
        }),
      freeBytes: async () => {
        const st = await fsOps.statfs(dataDir.path);
        return st.bavail * st.bsize;
      },
      storeBytes: () => dirSize(vectorsDir, fsOps),
      now: () => Date.now(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
      log: logEvent,
      logError,
    });
    const maintenance = vectorMaintenance;
    app.on("will-quit", () => maintenance.dispose());
    const backupService = createBackupService({
      dataDir: dataDir.path,
      db,
      appVersion: app.getVersion(),
      getConfig: () => ({ ...(store.store as Record<string, unknown>) }),
      lock: vaultLock,
      dialogs: createElectronDialogs(() => uiLanguage.translator()),
      emit: (p) => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) w.webContents.send(CHANNELS.backupProgress, p);
        }
      },
      relaunch: () => {
        // E2E (chỉ khi CHƯA đóng gói): thoát mà không tự mở lại — test tự khởi chạy lại trên cùng userData
        // (tiến trình relaunch mồ côi sẽ giữ single-instance lock).
        if (!(process.env.IV_E2E_NO_RELAUNCH === "1" && !app.isPackaged)) {
          app.relaunch();
        }
        endSession(); // app.exit không phát will-quit — khởi động lại sau khôi phục là thoát sạch (093)
        app.exit(0);
      },
      log: logEvent,
      // 116: không chụp vectors/ giữa lúc bảo trì kho vector đang chạy.
      waitVectorIdle: () => maintenance.whenIdle(BACKUP_WAIT_TIMEOUT_MS),
    });

    // Renderer reload/crash giữa phiên khôi phục ⇒ huỷ phiên để nút không kẹt "bận" (code review S1).
    app.on("web-contents-created", (_e, contents) => {
      const abandon = (): void => void backupService.abandonRestore();
      contents.on("did-start-loading", abandon);
      contents.on("render-process-gone", abandon);
    });

    // 093: báo lỗi opt-in — soạn bản nháp từ nhật ký, mở GitHub issue điền sẵn (người dùng tự gửi). Lần chạy đầu
    // (chưa có mốc) lấy "bây giờ" làm mốc ⇒ dump có sẵn từ trước không bị báo là crash "mới".
    if (store.get("crashReport.ackedAt") === undefined) {
      store.set("crashReport.ackedAt", Date.now());
    }
    const crashService = createCrashService({
      env: {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        platform: process.platform,
        arch: process.arch,
        osRelease: release(),
      },
      home: homedir(),
      abnormalExit,
      readLogLines: () => (logsDir ? readLogTail(logsDir, 400) : []),
      listDumps: () => listCrashDumps(app.getPath("crashDumps")),
      getAckedAt: () =>
        (store.get("crashReport.ackedAt") as number | undefined) ?? 0,
      setAckedAt: (ms) => store.set("crashReport.ackedAt", ms),
      openExternal: (url) => shell.openExternal(url),
      now: Date.now,
      log: logEvent,
    });

    // 186 PR C2: trình xem cuộc họp — văn bản từ chunk đã lưu (như source:getContent), xuất Markdown qua hộp thoại lưu.
    const meetingViewer = createMeetingViewerApi({
      repo: meetingRepo,
      sources: ingestion.sourceRepo,
      getText: (id) => getSourceContent(ingestion.sourceRepo, id)?.text ?? null,
      translator: () => uiLanguage.translator(),
      formatDate: (ms) => formatDateTime(ms, uiLanguage.get().effective),
      saveMarkdown: (content, name) =>
        exportMarkdown(
          BrowserWindow.getFocusedWindow(),
          content,
          name,
          uiLanguage.translator(),
        ),
      log: logEvent,
    });

    registerIpc({
      store,
      uiLanguage,
      version: app.getVersion(),
      dataDir,
      notebookRepo,
      sourceRepo: ingestion.sourceRepo,
      pipeline: ingestion.pipeline,
      vectorStore: ingestion.vectorStore,
      aiRuntime,
      ragServices,
      chatRepo,
      studioServices,
      contentSearch,
      // 059 — gợi ý model theo RAM (thuần) + health Ollama (ping + /api/tags) + trạng thái reindex.
      recommendChatModel: () => recommendChatModel(totalmem()),
      ollamaHealth: () =>
        checkOllama({
          ping: async () => (await aiRuntime.getRuntimeStatus()).reachable,
          listModels: () => aiRuntime.listModels(),
          selectedChatModel: () =>
            aiRuntime.getSelectedModels().chatModel ?? undefined,
        }),
      reindexStatus: () => reindex,
      rerankerStatus: () => reranker?.status() ?? "unavailable",
      backupService,
      vaultLock,
      logsDir,
      crashService,
      // 101: chọn lại tệp gốc — hộp thoại ở main + kiểm cùng nội dung (cùng hàm băm lúc nạp).
      relinkSource: createRelink({
        repo: ingestion.sourceRepo,
        pickFile: (opts) => pickSourceFile(opts, uiLanguage.translator()),
        hashFile: hashFileStreaming,
        realpath: (p) => realpath(p),
        isLocked: () => vaultLock.isLocked(),
        log: logEvent,
      }),
      // 112: xử lý lại PDF — kiểm tệp gốc còn + cùng nội dung (cùng hàm băm lúc nạp) rồi xếp hàng.
      reprocessSource: createReprocessRequest({
        repo: ingestion.sourceRepo,
        pipeline: ingestion.pipeline,
        isVaultLocked: () => vaultLock.isLocked(),
        fileExists: async (p) => existsSync(p),
        hashFile: hashFileStreaming,
      }),
      meeting,
      meetingViewer,
      licenseService,
      openPurchasePage: createPurchasePageOpener({
        openExternal: (url) => shell.openExternal(url),
        log: logEvent,
        now: Date.now,
      }),
      policyService,
      packageService: createPackageService({
        getNotebook: (id) =>
          notebookRepo.list().find((n) => n.id === id) ?? null,
        listSources: (nbId) => ingestion.sourceRepo.listByNotebook(nbId),
        listChunks: (srcId) => ingestion.sourceRepo.listChunks(srcId),
        getVectorsByChunkIds: async (ids) => {
          const map = await ingestion.vectorStore.getVectorsByIds(ids);
          return Array.from(map.entries()).map(([chunkId, vector]) => ({
            chunkId,
            vector,
          }));
        },
        showSaveDialog: async (defaultFilename) => {
          const parent = BrowserWindow.getFocusedWindow();
          const opts = {
            defaultPath: defaultFilename,
            filters: [
              { name: "SourceCraft Notebook Package", extensions: ["scnb"] },
            ],
          };
          const res = parent
            ? await dialog.showSaveDialog(parent, opts)
            : await dialog.showSaveDialog(opts);
          return res.canceled ? null : (res.filePath ?? null);
        },
        writeFileBytes: async (targetPath, bytes) => {
          const { writeFile } = await import("node:fs/promises");
          await writeFile(targetPath, bytes);
        },
        showOpenDialog: async () => {
          const parent = BrowserWindow.getFocusedWindow();
          const opts = {
            properties: ["openFile" as const],
            filters: [
              { name: "SourceCraft Notebook Package", extensions: ["scnb"] },
            ],
          };
          const res = parent
            ? await dialog.showOpenDialog(parent, opts)
            : await dialog.showOpenDialog(opts);
          return res.canceled || res.filePaths.length === 0
            ? null
            : (res.filePaths[0] ?? null);
        },
        readFileBytes: async (filePath) =>
          new Uint8Array(await readFile(filePath)),
        createNotebook: (input) =>
          notebookRepo.create({ name: input.name, color: input.color }),
        insertSource: (src) => {
          return ingestion.sourceRepo.create({
            notebookId: src.notebookId,
            kind: src.kind,
            title: src.title,
            origin: src.origin,
            contentHash: src.contentHash,
          });
        },
        markSourceReady: (id) => {
          ingestion.sourceRepo.updateStatus(id, "ready");
        },
        insertChunks: (sourceId, drafts) => {
          return ingestion.sourceRepo.insertChunks(sourceId, drafts);
        },
        writeVectors: async (records) => {
          await ingestion.vectorStore.add(records);
        },
      }),
    });

    // 145: menu ứng dụng theo ngôn ngữ giao diện — dựng lúc khởi động và dựng lại ngay khi đổi ngôn ngữ.
    // 213: nội dung hộp "Giới thiệu" MẶC ĐỊNH của hệ điều hành theo ngôn ngữ giao diện (dựng lại cùng menu). Thư viện đọc một lần.
    const aboutLibraries = loadLibraries(app.getAppPath());
    const applyAboutPanel = (): void => {
      app.setAboutPanelOptions(
        buildAboutPanelOptions({
          t: uiLanguage.translator(),
          version: app.getVersion(),
          arch: process.arch,
          packaged: app.isPackaged,
          runtime: {
            electron: process.versions.electron ?? "",
            chromium: process.versions.chrome ?? "",
            node: process.versions.node ?? "",
          },
          models: [
            {
              role: "embedding",
              name: EMBEDDING_MODEL,
              version: EMBEDDING_MODEL_VERSION,
            },
            {
              role: "reranker",
              name: RERANK_MODEL,
              version: RERANK_MODEL_VERSION,
            },
            { role: "asrFinal", name: FINAL_MODEL, version: "fp32" },
            { role: "asrFallback", name: DRAFT_FALLBACK_MODEL, version: "q8" },
          ],
          libraries: aboutLibraries,
          iconPath: resolveIconPath() ?? undefined,
        }),
      );
    };
    const applyAppMenu = (): void => {
      applyAboutPanel();
      Menu.setApplicationMenu(
        Menu.buildFromTemplate(
          appMenuTemplate(uiLanguage.translator(), {
            platform: process.platform,
            isPackaged: app.isPackaged,
            appName: app.getName(),
          }),
        ),
      );
    };
    applyAppMenu();

    // 123: đẩy ngôn ngữ giao diện mới tới mọi cửa sổ — renderer re-render ngay, không khởi động lại (FR-004).
    uiLanguage.onChange((state) => {
      applyAppMenu(); // 145
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed())
          w.webContents.send(CHANNELS.uiLanguageChanged, state);
      }
    });

    // 103: đẩy trạng thái riêng tư mới tới mọi cửa sổ mỗi khi mode đổi (badge cập nhật tức thì — Constitution I).
    onPrivacyChange((state) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed())
          w.webContents.send(CHANNELS.privacyChanged, state);
      }
    });

    installSecurity();
    createWindow();

    // Phục hồi trạng thái nguồn dở từ phiên trước:
    // - queued/processing (kẹt do đóng/crash giữa chừng) → error retry được (B3).
    // - awaiting_embedding → tự nhúng tiếp khi runtime AI sẵn sàng (US4, FR-009).
    ingestion.pipeline.resumeInterrupted();
    // 186: phiên ghi dang dở (sập/thoát giữa chừng) — sửa header phân đoạn; người dùng đã kết thúc ⇒ tự hoàn tất, bị
    // gián đoạn ⇒ thẻ phục hồi (PR C1).
    void meeting.recoverOnStartup();
    void ingestion.pipeline.resumeAwaiting();
    // 116: một lần bắt kịp sau khởi động (vault cũ chưa từng bảo trì) — trễ, không chặn cửa sổ.
    maintenance.scheduleStartup();

    // 059: tái lập chỉ mục NỀN nếu đổi engine embedding (version lệch). Không chặn khởi động. Idempotent +
    // resume (bỏ chunk đã có vector). Trong lúc chạy, rag:ask báo "đang tái lập" (reindex.inProgress).
    const storedVersion = store.get("embeddingModelVersion") as
      string | undefined;
    if (needsReindex(storedVersion)) {
      reindex.inProgress = true;
      const emitReindex = (): void => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) {
            w.webContents.send(CHANNELS.embedReindexProgress, {
              inProgress: reindex.inProgress,
              done: reindex.done,
              total: reindex.total,
            });
          }
        }
      };
      void runReindex({
        listAllChunkRefs: () => ingestion.sourceRepo.allChunkRefs(),
        getChunkTexts: (ids) =>
          new Map(
            ingestion.sourceRepo.getChunksByIds(ids).map((c) => [c.id, c.text]),
          ),
        embedPassage: (texts) => ingestion.embedder.embed(texts, "passage"),
        vectorStore: ingestion.vectorStore,
        readVersion: () =>
          store.get("embeddingModelVersion") as string | undefined,
        writeVersion: (v) => store.set("embeddingModelVersion", v),
        onProgress: (done, total) => {
          reindex.done = done;
          reindex.total = total;
          emitReindex();
        },
      })
        // KHÔNG log message/String(e) thô (key 'message' không được redact — có thể dính nội dung chunk từ
        // lib); chỉ log loại lỗi (Constitution III).
        .catch((e) =>
          logEvent("embed.reindex.error", {
            errorType: e instanceof Error ? e.constructor.name : typeof e,
          }),
        )
        .finally(() => {
          reindex.inProgress = false;
          emitReindex();
          // 116: reindex ghi rất nhiều lô nhỏ ⇒ gộp ngay khi kho yên.
          maintenance.notifyReindexDone();
        });
    }
    // Lưu ý: cài mới (chưa có chunk) → needsReindex=true nhưng runReindex chạy tức thì (0 chunk) rồi bump
    // version → lần sau "done".

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  // Bắt mọi lỗi khởi động (migration/DB/native…) → dialog + thoát sạch thay vì unhandled rejection âm thầm.
  .catch(handleFatalStartup);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
