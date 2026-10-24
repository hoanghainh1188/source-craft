import type {
  LanguageMode,
  MeetingDraftEvent,
  MeetingMarker,
  MeetingPrepareResult,
  MeetingStartResult,
  MeetingState,
  MicStatus,
  RecoverableSession,
  PauseGap,
  Source,
} from "@shared/ipc/types";
import { UserFacingError } from "@shared/codes/user-error";
import type { MicGate } from "../app-shell/permissions";
import type { IngestionPipeline } from "../ingestion/pipeline";
import { validateAudioBatch, type IngressState } from "./audio-ingress";
import { canStart, diskLevel, minutesRemaining } from "./disk-guard";
import {
  BYTES_PER_MIN,
  CHECKPOINT_SEC,
  NO_AUDIO_TIMEOUT_MS,
  RESUME_GRACE_MS,
} from "./meeting-constants";
import type { DraftAsrClient, DraftEngine } from "./draft-engine";
import { initialLanguageState } from "./language-policy";
import {
  PREF_DEVICE,
  PREF_LANGUAGE,
  cleanTitle,
  parseStartInput,
  prepareMeeting,
} from "./meeting-prepare";
import { checkpointOf } from "./checkpoint";
import { createMeetingRecovery } from "./meeting-recovery";
import { languageView, parseMark, parseSetLanguage } from "./meeting-input";
import { createDraftWiring, type LiveSession } from "./meeting-draft-wiring";
import type { MeetingRepo } from "./meeting-repo";
import { finalizeSession } from "./meeting-finalizer";
import type {
  AsrFinalClient,
  CaptureSegmentWriter,
  MeetingFiles,
} from "./meeting-io";
import {
  segmentFileName,
  segmentShouldRotate,
  toSegmentInfo,
  totalDurationSec,
  type CaptureSegment,
} from "./segments";
import {
  sessionTransition,
  type SessionEvent,
  type SessionSnapshot,
} from "./session-state";

export {
  AsrError,
  type AsrFinalClient,
  type CaptureSegmentWriter,
  type MeetingFiles,
} from "./meeting-io";

// 186 — điều phối phiên ghi (research R4, R8, R12; data-model §5). Mọi I/O tiêm vào ⇒ unit-test không cần Electron/đĩa.
// Việc GHI tệp (writer) không phụ thuộc ASR (A3): ASR chốt chạy ở asr-worker sau khi kết thúc, tuần tự từng phiên.
// KHÔNG log nội dung (audio, transcript, tiêu đề) — Constitution III.

export interface MeetingServiceDeps {
  repo: MeetingRepo;
  pipeline: Pick<IngestionPipeline, "createMeetingSource" | "ingestParsed">;
  sources: {
    getById(id: string): Source | null;
    setTitle(id: string, title: string): void;
  };
  notebookExists(id: string): boolean;
  files: MeetingFiles;
  asr: AsrFinalClient & DraftAsrClient;
  freeBytes(): Promise<number>;
  micGate: MicGate;
  mediaAccess: { status(): MicStatus; ask(): Promise<boolean> };
  isOnlineActive(): boolean;
  isModelReady(): Promise<boolean>;
  prefs: { get(key: string): unknown; set(key: string, value: unknown): void };
  push(webContentsId: number, state: MeetingState): void;
  /** PR B: dòng nháp tới cửa sổ ghi. */
  pushDraft(webContentsId: number, ev: MeetingDraftEvent): void;
  /** PR B: tải model nhận dạng (worker nạp model ⇒ chỉ báo riêng tư "đang tải model"). */
  downloadModel(): Promise<void>;
  /** PR B: model nháp dự phòng đã có trên máy (chỉ khi đó mới tự hạ cấp — không tự tải giữa cuộc họp). */
  fallbackReady(): boolean;
  /** PR B: thông tin máy cho dòng chẩn đoán hiệu năng (ADR meeting-asr-spike mục 7) — không định danh người dùng. */
  machineInfo(): MachineInfo;
  /** PR C1: xoá nguồn như kênh source:remove (thẻ phục hồi "Xoá bản ghi"). */
  removeSource(sourceId: string): Promise<void>;
  /** PR C1: số phiên cần phục hồi tới mọi cửa sổ (push meeting:recoverable). */
  pushRecoverable(count: number): void;
  /** PR C1 (D12): giữ máy không ngủ khi đang có phiên ghi. */
  keepAwake(on: boolean): void;
  emitProgress(sourceId: string, notebookId: string, frac: number): void;
  notifyReady(sourceId: string, notebookId: string, title: string): void;
  logEvent?(
    event: string,
    meta?: Record<string, string | number | boolean>,
  ): void;
  now(): number;
  uuid(): string;
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(handle: ReturnType<typeof setInterval>): void;
  segmentSeconds: number;
  sampleRate: number;
  /** e2e (bản chưa đóng gói, IV_E2E_FAKE_MIC): renderer dùng tín hiệu thử thay micro ⇒ coi như đã có quyền. */
  testFakeMic?: boolean;
  /** e2e soak (bản chưa đóng gói, IV_E2E_AUDIO_PUMP): cho phép pumpTestAudio. */
  testAudioPump?: boolean;
  /** 226: optional maximum recording duration in seconds (e.g. 900s on Free tier); null = unlimited. */
  maxDurationSec?: () => number | null;
}

export interface MachineInfo {
  platform: string;
  arch: string;
  cpu: string;
  cores: number;
  ramGb: number;
}

export interface MeetingService {
  prepare(senderId: number, input: unknown): Promise<MeetingPrepareResult>;
  start(senderId: number, input: unknown): Promise<MeetingStartResult>;
  acceptAudio(
    senderId: number,
    msg: { sessionId: unknown; seq: unknown; pcm: unknown },
  ): void;
  /** CHỈ e2e soak (bản chưa đóng gói, `testAudioPump`): main tự bơm PCM tăng tốc, bỏ qua giới hạn tần suất (T127). */
  pumpTestAudio(bytes: Uint8Array): void;
  pause(senderId: number, input: unknown): Promise<MeetingState>;
  resume(senderId: number, input: unknown): Promise<MeetingState>;
  stop(senderId: number, input: unknown): Promise<{ sourceId: string }>;
  status(): MeetingState | null;
  rename(input: unknown): Promise<{ ok: true }>;
  setLanguage(senderId: number, input: unknown): Promise<MeetingState>;
  mark(senderId: number, input: unknown): Promise<{ markerId: string }>;
  listMarkers(input: unknown): Promise<MeetingMarker[]>;
  downloadModel(): Promise<{ ok: true }>;
  /** Đẩy lại toàn bộ dòng nháp cho cửa sổ ghi (sau khi renderer gắn lại — meeting:status). */
  resendDrafts(): void;
  onRendererGone(webContentsId: number): void;
  onSourceRemoved(sourceId: string): Promise<void>;
  isRecordingNotebook(notebookId: string): boolean;
  isActive(): boolean;
  recoverOnStartup(): Promise<void>;
  listRecoverable(input: unknown): RecoverableSession[];
  recover(input: unknown): Promise<{ ok: true }>;
  finalizeAgain(input: unknown): Promise<{ ok: true }>;
  /** Thoát app có xác nhận khi đang ghi ⇒ kết thúc như người dùng bấm (endedByUser) rồi mới thoát. */
  stopForQuit(): Promise<void>;
  /** Chờ mọi việc I/O + hoàn tất đang xếp hàng (test, thoát app). */
  whenIdle(): Promise<void>;
  dispose(): void;
}

/** Trần số đánh dấu mỗi phiên (chống renderer spam DB — review bảo mật). */
const MAX_MARKERS = 5000;

interface Active extends LiveSession {
  notebookId: string;
  title: string;
  languageMode: LanguageMode;
  snap: SessionSnapshot;
  ingress: IngressState;
  writer: CaptureSegmentWriter | null;
  segments: CaptureSegment[];
  pauseGaps: PauseGap[];
  pausedAtWall: number | null;
  pauseReason: "user" | "deviceLost" | undefined;
  lastBatchAt: number;
  /** B3: sau Tiếp tục, micro cần thời gian mở lại ⇒ không coi là mất audio trước mốc này. */
  graceUntil: number;
  minutesRemaining: number;
  lastDiskCheck: number;
  lastPersist: number;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

type EndReason = NonNullable<MeetingState["endReason"]>;

/** Gộp khoảng mất lô vào khoảng liền trước nếu cùng vị trí thời gian (review M3 — mảng không phình). */
function addGap(gaps: readonly PauseGap[], gap: PauseGap): PauseGap[] {
  const last = gaps[gaps.length - 1];
  if (last && last.reason === gap.reason && last.atSec === gap.atSec) {
    return [
      ...gaps.slice(0, -1),
      { ...last, wallSeconds: last.wallSeconds + gap.wallSeconds },
    ];
  }
  return [...gaps, gap];
}

export function createMeetingService(deps: MeetingServiceDeps): MeetingService {
  const { repo, files, sampleRate } = deps;
  const segmentSamples = deps.segmentSeconds * sampleRate;
  let active: Active | null = null;
  let starting = false;
  let watchdog: ReturnType<typeof setInterval> | null = null;
  let ioChain: Promise<void> = Promise.resolve();
  let finalizeChain: Promise<void> = Promise.resolve();
  const removed = new Set<string>();

  const log = (
    event: string,
    meta?: Record<string, string | number | boolean>,
  ): void => deps.logEvent?.(event, meta);
  const errName = (e: unknown): string =>
    e instanceof Error ? e.name : "unknown";

  /** Việc I/O tuần tự; lỗi được ghi log (không nội dung) và không làm hỏng chuỗi. */
  const enqueueIo = (fn: () => Promise<void>): Promise<void> => {
    const run = ioChain.then(fn);
    ioChain = run.catch((e: unknown) =>
      log("meeting.ioError", { name: errName(e) }),
    );
    return run;
  };

  const durationSec = (a: Active): number =>
    totalDurationSec(a.segments, sampleRate);

  const state = (a: Active, endReason?: EndReason): MeetingState => {
    const level = diskLevel(a.minutesRemaining);
    return {
      sessionId: a.sessionId,
      sourceId: a.sourceId,
      notebookId: a.notebookId,
      title: a.title,
      phase: a.snap.phase as MeetingState["phase"],
      durationSec: durationSec(a),
      segments: toSegmentInfo(a.segments, sampleRate),
      ...(a.snap.phase === "paused" && a.pauseReason
        ? { pauseReason: a.pauseReason }
        : {}),
      ...(endReason ? { endReason } : {}),
      diskLevel: level === "stop" ? "urgent" : level,
      minutesRemaining: a.minutesRemaining,
      transcriptLagging: a.lagging,
      modelReady: a.modelReady,
      language: languageView(a.lang),
      pauseGaps: a.pauseGaps,
    };
  };

  const pushState = (a: Active, endReason?: EndReason): void =>
    deps.push(a.ownerId, state(a, endReason));

  const persist = (a: Active): void => {
    a.lastPersist = deps.now();
    repo.update(a.sourceId, {
      phase: a.snap.phase,
      endedByUser: a.snap.endedByUser,
      segments: a.segments,
      pauseGaps: a.pauseGaps,
      durationMs: Math.round(durationSec(a) * 1000),
    });
    // PR C1 (R12): checkpoint session.json phủ phần của phân đoạn đang mở; lỗi ghi chỉ log (DB vẫn là nguồn sự thật).
    const cp = checkpointOf(a, a.snap, deps.now());
    void enqueueIo(() => files.writeCheckpoint(a.sessionId, cp)).catch(
      () => undefined,
    );
  };

  const transition = (a: Active, event: SessionEvent): void => {
    const r = sessionTransition(a.snap, event);
    if (!r.ok) throw new UserFacingError("meetingInvalidInput");
    a.snap = r.state;
    a.ingress = { ...a.ingress, phase: r.state.phase };
  };

  const requireOwned = (senderId: number, input: unknown): Active => {
    const sid = isObj(input) ? str(input["sessionId"]) : null;
    if (!active || sid !== active.sessionId || senderId !== active.ownerId) {
      throw new UserFacingError("meetingNotFound");
    }
    return active;
  };

  const openSegment = (a: Active): void => {
    const index =
      a.segments.length === 0
        ? 0
        : (a.segments[a.segments.length - 1]?.index ?? -1) + 1;
    a.writer = files.openWriter(a.sessionId, index, () => onWriterError(a));
    a.segments = [
      ...a.segments,
      { index, file: segmentFileName(index), samples: 0, closed: false },
    ];
  };

  /** Đóng phân đoạn đang mở (chờ đĩa). Lỗi đóng chỉ ghi log — phân đoạn sửa được lúc phục hồi. */
  const closeSegment = async (a: Active): Promise<void> => {
    const w = a.writer;
    if (!w) return;
    a.writer = null;
    a.segments = a.segments.map((s, i) =>
      i === a.segments.length - 1 ? { ...s, closed: true } : s,
    );
    await enqueueIo(async () => {
      await w.close();
    }).catch(() => undefined);
  };

  const stopWatchdog = (): void => {
    if (watchdog !== null) deps.clearInterval(watchdog);
    watchdog = null;
  };

  const deactivate = (): void => {
    stopWatchdog();
    if (active) deps.keepAwake(false);
    active = null;
    deps.micGate.disarm();
  };

  const live = createDraftWiring({
    deps,
    isActive: (a) => active === a,
    pushState: (a) => pushState(a as Active),
    enqueueIo,
    log,
  });
  const { applyLanguage, endDraft } = live;

  const queueFinalize = (sourceId: string, after?: Promise<void>): void => {
    finalizeChain = finalizeChain.then(async () => {
      await after?.catch(() => undefined);
      await finalizeSession(
        {
          repo,
          files,
          asr: deps.asr,
          pipeline: deps.pipeline,
          sources: deps.sources,
          emitProgress: deps.emitProgress,
          notifyReady: deps.notifyReady,
          sampleRate,
          isRemoved: (id) => removed.has(id),
          enqueueIo,
          log,
          now: deps.now,
        },
        sourceId,
      ).catch((e: unknown) =>
        log("meeting.finalizeError", { name: errName(e) }),
      );
    });
  };
  const recovery = createMeetingRecovery({
    repo,
    files,
    pipeline: deps.pipeline,
    sources: deps.sources,
    sampleRate,
    removeSource: deps.removeSource,
    pushRecoverable: deps.pushRecoverable,
    queueFinalize: (id) => queueFinalize(id),
    enqueueIo,
    log,
  });

  /**
   * Kết thúc phiên rồi xếp hàng hoàn tất. Luôn persist + hoàn tất kể cả khi đóng phân đoạn lỗi (S5), và PUSH trạng thái
   * cuối tới cửa sổ ghi (B1) — renderer tắt micro + chuyển màn hoàn tất.
   */
  const endSession = async (
    a: Active,
    events: SessionEvent[],
    endReason?: EndReason,
  ): Promise<void> => {
    for (const e of events.slice(0, 1)) transition(a, e);
    deactivate();
    const drained = endDraft(a);
    try {
      await closeSegment(a);
    } finally {
      for (const e of events.slice(1)) transition(a, e);
      persist(a);
      repo.update(a.sourceId, { endedAt: deps.now() });
      pushState(a, endReason);
      if (a.snap.phase === "finalizing") queueFinalize(a.sourceId, drained);
      else void drained.catch(() => undefined).then(() => recovery.notify());
    }
  };

  /**
   * Phiên bị cắt ngang (renderer chết / mất audio / lỗi ghi). PR C1 (US5): KHÔNG tự hoàn tất — phiên `interrupted`, audio đã
   * ghi giữ nguyên, người dùng chọn ở thẻ phục hồi (Hoàn tất / Giữ chưa hoàn thiện / Xoá).
   */
  const interrupt = async (
    a: Active,
    cause: "rendererGone" | "noAudio" | "crash",
  ): Promise<void> => {
    if (active !== a) return;
    log("meeting.interrupted", { cause });
    await endSession(a, [{ type: "interrupt", cause }], cause);
  };

  function onWriterError(a: Active): void {
    void interrupt(a, "crash");
  }

  const stopActive = (
    a: Active,
    cause: "user" | "diskFull" | "quitConfirmed" | "limitReached",
  ): Promise<void> =>
    endSession(
      a,
      [
        {
          type: "stop",
          cause: cause === "limitReached" ? "user" : cause,
        },
        { type: "segmentsClosed" },
      ],
      cause === "diskFull" || cause === "limitReached" ? cause : undefined,
    );

  const checkDisk = async (a: Active): Promise<void> => {
    const recordedBytes = durationSec(a) * sampleRate * 2;
    a.minutesRemaining = minutesRemaining({
      freeBytes: await deps.freeBytes(),
      recordedBytes,
      bytesPerMin: BYTES_PER_MIN,
    });
    if (
      active === a &&
      a.snap.phase === "recording" &&
      diskLevel(a.minutesRemaining) === "stop"
    ) {
      await stopActive(a, "diskFull");
    }
  };

  /** Ghi PCM đã kiểm vào phân đoạn + bộ máy nháp; xoay phân đoạn / checkpoint / kiểm đĩa theo nhịp. */
  const ingest = (
    a: Active,
    writer: CaptureSegmentWriter,
    bytes: Uint8Array,
    now: number,
  ): void => {
    writer.append(bytes);
    a.draft.push(
      bytes.byteOffset % 2 === 0
        ? new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1)
        : new Int16Array(bytes.slice().buffer),
    );
    const last = a.segments.length - 1;
    const samples = (a.segments[last]?.samples ?? 0) + bytes.byteLength / 2;
    a.segments = a.segments.map((s, i) => (i === last ? { ...s, samples } : s));
    const maxSec = deps.maxDurationSec?.() ?? null;
    if (maxSec !== null && durationSec(a) >= maxSec) {
      log("meeting.limitReached", { maxSec });
      void stopActive(a, "limitReached");
      return;
    }
    if (segmentShouldRotate(samples, segmentSamples)) {
      void closeSegment(a);
      openSegment(a);
      persist(a);
    } else if (now - a.lastPersist >= CHECKPOINT_SEC * 1000) {
      persist(a);
    }
    if (now - a.lastDiskCheck >= CHECKPOINT_SEC * 1000) {
      a.lastDiskCheck = now;
      void checkDisk(a).catch((e: unknown) =>
        log("meeting.diskCheckError", { name: errName(e) }),
      );
    }
    pushState(a);
  };

  const startWatchdog = (): void => {
    stopWatchdog();
    watchdog = deps.setInterval(() => {
      const a = active;
      if (!a || a.snap.phase !== "recording") return;
      const now = deps.now();
      if (now > a.graceUntil && now - a.lastBatchAt > NO_AUDIO_TIMEOUT_MS) {
        void interrupt(a, "noAudio");
      }
    }, 1000);
  };

  return {
    prepare: (_senderId, input) =>
      prepareMeeting(deps, active === null && !starting, input),

    async start(senderId, input) {
      const { notebookId, languageMode, deviceLabel, title } =
        parseStartInput(input);
      // B4: cờ đồng bộ đặt TRƯỚC await đầu tiên ⇒ hai lệnh start song song không cùng lọt qua.
      if (active || starting)
        throw new UserFacingError("meetingAlreadyRecording");
      starting = true;
      try {
        if (!deps.notebookExists(notebookId))
          throw new UserFacingError("notebookNotFound");
        const minutes = minutesRemaining({
          freeBytes: await deps.freeBytes(),
          recordedBytes: 0,
          bytesPerMin: BYTES_PER_MIN,
        });
        if (!canStart(minutes)) throw new UserFacingError("meetingDiskLow");
        const sessionId = deps.uuid();
        await files.ensureSessionDir(sessionId);
        const source = deps.pipeline.createMeetingSource({
          notebookId,
          title,
          sessionId,
        });
        const now = deps.now();
        repo.create({
          sourceId: source.id,
          sessionId,
          languageMode,
          ...(typeof deviceLabel === "string" ? { deviceLabel } : {}),
          startedAt: now,
        });
        const a: Active = {
          sessionId,
          sourceId: source.id,
          notebookId,
          title,
          ownerId: senderId,
          languageMode,
          snap: { phase: "recording", endedByUser: false },
          ingress: {
            sessionId,
            ownerId: senderId,
            phase: "recording",
            expectedSeq: 0,
            windowStartMs: 0,
            batchesInWindow: 0,
          },
          writer: null,
          segments: [],
          pauseGaps: [],
          pausedAtWall: null,
          pauseReason: undefined,
          lastBatchAt: now,
          graceUntil: now,
          minutesRemaining: minutes,
          lastDiskCheck: now,
          lastPersist: now,
          lang: initialLanguageState(languageMode),
          draft: null as unknown as DraftEngine,
          lagging: false,
          modelReady: await deps.isModelReady(),
        };
        a.draft = live.createDraft(a);
        openSegment(a);
        persist(a);
        if (a.lang.changes.length > 0)
          repo.update(a.sourceId, {
            language: a.lang.locked?.lang ?? null,
            languageChanges: a.lang.changes,
          });
        active = a;
        if (typeof deviceLabel === "string")
          deps.prefs.set(PREF_DEVICE, deviceLabel);
        deps.prefs.set(PREF_LANGUAGE, languageMode);
        deps.micGate.disarm();
        deps.keepAwake(true);
        startWatchdog();
        pushState(a);
        log("meeting.started", { languageMode });
        return { sessionId, sourceId: source.id };
      } finally {
        starting = false;
      }
    },

    acceptAudio(senderId, msg) {
      const a = active;
      const now = deps.now();
      const v = validateAudioBatch(
        a?.ingress ?? null,
        { senderId, ...msg },
        now,
      );
      if (!a) return;
      if (v.verdict === "rateLimited") {
        a.ingress = v.next;
        return;
      }
      if (v.verdict !== "accept" || !a.writer) return;
      a.ingress = v.next;
      a.lastBatchAt = now;
      if (v.gapBatches > 0) {
        a.pauseGaps = addGap(a.pauseGaps, {
          atSec: durationSec(a),
          wallSeconds: v.gapBatches,
          reason: "interrupted",
        });
        persist(a);
      }
      ingest(a, a.writer, v.bytes, now);
    },

    pumpTestAudio(bytes) {
      const a = active;
      if (!deps.testAudioPump || !a?.writer || a.snap.phase !== "recording")
        return;
      const now = deps.now();
      a.lastBatchAt = now;
      ingest(a, a.writer, bytes, now);
    },

    async pause(senderId, input) {
      const a = requireOwned(senderId, input);
      const reason =
        isObj(input) && input["reason"] === "deviceLost"
          ? "deviceLost"
          : "user";
      transition(a, { type: "pause", reason });
      // N3: đặt mốc tạm dừng TRƯỚC await (resume chen vào không bị ghi đè).
      a.pausedAtWall = deps.now();
      a.pauseReason = reason;
      a.draft.flush();
      await closeSegment(a);
      persist(a);
      pushState(a);
      return state(a);
    },

    async resume(senderId, input) {
      const a = requireOwned(senderId, input);
      transition(a, { type: "resume" });
      deps.micGate.arm();
      const now = deps.now();
      const wallSeconds =
        a.pausedAtWall === null ? 0 : (now - a.pausedAtWall) / 1000;
      a.pauseGaps = addGap(a.pauseGaps, {
        atSec: durationSec(a),
        wallSeconds,
        reason: a.pauseReason === "deviceLost" ? "deviceLost" : "user",
      });
      a.pausedAtWall = null;
      a.pauseReason = undefined;
      a.lastBatchAt = now;
      a.graceUntil = now + RESUME_GRACE_MS;
      openSegment(a);
      persist(a);
      pushState(a);
      return state(a);
    },

    async stop(senderId, input) {
      const a = requireOwned(senderId, input);
      await stopActive(a, "user");
      return { sourceId: a.sourceId };
    },

    status: () => (active ? state(active) : null),

    resendDrafts() {
      const a = active;
      if (a)
        deps.pushDraft(a.ownerId, {
          sessionId: a.sessionId,
          windows: a.draft.lines(),
          full: true,
        });
    },

    async setLanguage(senderId, input) {
      const a = requireOwned(senderId, input);
      applyLanguage(a, parseSetLanguage(input, durationSec(a)));
      return state(a);
    },

    async mark(senderId, input) {
      const a = requireOwned(senderId, input);
      if (a.snap.phase !== "recording" && a.snap.phase !== "paused")
        throw new UserFacingError("meetingNotFound");
      const m = parseMark(input, durationSec(a));
      if (repo.listMarkers(a.sourceId).length >= MAX_MARKERS)
        throw new UserFacingError("meetingInvalidInput");
      const markerId = deps.uuid();
      repo.addMarker({ id: markerId, sourceId: a.sourceId, ...m });
      log("meeting.marked", { kind: m.kind });
      return { markerId };
    },

    async listMarkers(input) {
      const sourceId = isObj(input) ? str(input["sourceId"]) : null;
      const src = sourceId ? deps.sources.getById(sourceId) : null;
      if (!src || src.kind !== "meeting")
        throw new UserFacingError("meetingNotFound");
      return repo.listMarkers(src.id);
    },

    async downloadModel() {
      await live.downloadModel();
      const a = active;
      if (a) {
        a.modelReady = true;
        a.draft.resumeModel();
        pushState(a);
      }
      return { ok: true as const };
    },

    async rename(input) {
      if (!isObj(input)) throw new UserFacingError("meetingInvalidInput");
      const sourceId = str(input["sourceId"]);
      const src = sourceId ? deps.sources.getById(sourceId) : null;
      if (!src || src.kind !== "meeting")
        throw new UserFacingError("meetingNotFound");
      const title = cleanTitle(input["title"]);
      deps.sources.setTitle(src.id, title);
      if (active?.sourceId === src.id) {
        active.title = title;
        pushState(active);
      }
      return { ok: true as const };
    },

    onRendererGone(webContentsId) {
      if (active && active.ownerId === webContentsId)
        void interrupt(active, "rendererGone");
    },

    async onSourceRemoved(sourceId) {
      removed.add(sourceId);
      const s = repo.get(sourceId);
      if (active?.sourceId === sourceId) {
        const a = active;
        deactivate();
        a.draft.stop();
        await closeSegment(a);
      }
      if (s) await enqueueIo(() => files.deleteSession(s.sessionId));
    },

    isRecordingNotebook: (notebookId) => active?.notebookId === notebookId,
    isActive: () => active !== null,

    recoverOnStartup: () => recovery.recoverOnStartup(),
    listRecoverable: (input) => recovery.listRecoverable(input),
    recover: (input) => recovery.recover(input),
    finalizeAgain: (input) => recovery.finalizeAgain(input),

    async stopForQuit() {
      const a = active;
      if (a) await stopActive(a, "quitConfirmed");
    },

    async whenIdle() {
      // Hoàn tất có thể sinh thêm I/O và ngược lại ⇒ chờ tới khi cả hai chuỗi ổn định.
      for (;;) {
        const io = ioChain;
        const fin = finalizeChain;
        await io.catch(() => undefined);
        await fin;
        if (io === ioChain && fin === finalizeChain) return;
      }
    },

    dispose() {
      stopWatchdog();
      if (active) deps.keepAwake(false);
    },
  };
}
