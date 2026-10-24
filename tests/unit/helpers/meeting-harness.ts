// 186 — harness dùng chung cho test meeting-service (fake I/O tiêm vào). Không phải tệp test.
import { openDatabase } from "../../../src/main/db/database";
import { runMigrations } from "../../../src/main/db/migrations";
import {
  createMeetingRepo,
  type MeetingRepo,
} from "../../../src/main/services/meeting-capture/meeting-repo";
import {
  createMeetingService,
  type MeetingService,
  type MeetingFiles,
  type CaptureSegmentWriter,
  type AsrFinalClient,
  type MeetingServiceDeps,
} from "../../../src/main/services/meeting-capture/meeting-service";
import { createMicGate } from "../../../src/main/services/app-shell/permissions";
import type { Segment } from "../../../src/main/services/ingestion/audio/audio-transcript";
import type {
  MeetingDraftEvent,
  MeetingState,
  Source,
} from "@shared/ipc/types";
import type {
  DraftAsrClient,
  PersistedDraftLine,
} from "../../../src/main/services/meeting-capture/draft-engine";

// 186 — điều phối phiên ghi (research R4, R8, R12; data-model §5). Mọi I/O (tệp, ASR, đĩa, cửa sổ) là fake tiêm vào.

export const RATE = 16000;
export const SEC = RATE * 2; // byte / giây
export const OWNER = 7;

export interface Harness {
  svc: MeetingService;
  repo: MeetingRepo;
  sources: Map<string, Source>;
  writers: { index: number; bytes: number; closed: boolean }[];
  files: Map<string, Map<number, Segment[]>>; // sessionId → index → final
  merged: string[];
  deletedSegments: string[];
  deletedSessions: string[];
  pushes: MeetingState[];
  progress: number[];
  ingested: { sourceId: string; text: string; timeMap: unknown }[];
  notified: string[];
  asrCalls: {
    segmentPath: string;
    prevSegmentPath?: string;
    overlapSec: number;
    language: string | null;
  }[];
  detectCalls: string[];
  draftCalls: { language: string; tier: string; bytes: number }[];
  detectPcmCalls: number[];
  drafts: Map<string, PersistedDraftLine[]>;
  draftPushes: { id: number; ev: MeetingDraftEvent }[];
  logs: { event: string; meta?: Record<string, string | number | boolean> }[];
  downloads: number[];
  setDraft: (fn: DraftAsrClient["draft"]) => void;
  checkpoints: Map<string, unknown>;
  recoverablePushes: number[];
  awake: boolean[];
  removedSources: string[];
  setDetectPcm: (fn: DraftAsrClient["detectPcm"]) => void;
  clock: { now: number };
  tick: () => void;
  setAsr: (fn: AsrFinalClient["final"]) => void;
  setDetect: (fn: AsrFinalClient["detectLanguage"]) => void;
  setFree: (bytes: number) => void;
  /** Kết quả trả về của ingestParsed (mặc định true). */
  setIngestOk: (ok: boolean) => void;
  /** Giả lập lỗi I/O của writer đang mở. */
  failWriter: () => void;
  gate: ReturnType<typeof createMicGate>;
  idle: () => Promise<void>;
  recreate: () => MeetingService;
}

export function harness(
  opts: {
    segmentSeconds?: number;
    micStatus?: "granted" | "denied";
    testFakeMic?: boolean;
    maxDurationSec?: () => number | null;
  } = {},
): Harness {
  const db = openDatabase(":memory:");
  runMigrations(db);
  db.prepare(
    "INSERT INTO notebook (id, name, color, created_at, updated_at) VALUES ('nb1','N','#4F46E5',1,1)",
  ).run();
  const clock = { now: 1_000_000 };
  const repo = createMeetingRepo(db, { now: () => clock.now });
  const sources = new Map<string, Source>();
  const writers: Harness["writers"] = [];
  const finals = new Map<string, Map<number, Segment[]>>();
  const merged: string[] = [];
  const deletedSegments: string[] = [];
  const deletedSessions: string[] = [];
  const pushes: MeetingState[] = [];
  const progress: number[] = [];
  const ingested: Harness["ingested"] = [];
  const notified: string[] = [];
  const asrCalls: Harness["asrCalls"] = [];
  let free = 50 * 1024 * 1024 * 1024;
  let ingestOk = true;
  let writerError: ((e: unknown) => void) | null = null;
  const gate = createMicGate(() => clock.now, 15_000);
  let idSeq = 0;
  let intervalFn: (() => void) | null = null;
  // Mặc định ASR trả một câu cho mỗi phân đoạn, thời gian tương đối đầu phân đoạn.
  const detectCalls: string[] = [];
  let detectImpl: AsrFinalClient["detectLanguage"] = async () => ({
    language: "en",
    confidence: 0.9,
  });
  const draftCalls: Harness["draftCalls"] = [];
  const detectPcmCalls: number[] = [];
  const drafts = new Map<string, PersistedDraftLine[]>();
  const draftPushes: Harness["draftPushes"] = [];
  const logs: Harness["logs"] = [];
  const downloads: number[] = [];
  const checkpoints = new Map<string, unknown>();
  const recoverablePushes: number[] = [];
  const awake: boolean[] = [];
  const removedSources: string[] = [];
  // eslint-disable-next-line prefer-const
  let svcRef: { current: MeetingService | null } = { current: null };
  let draftImpl: DraftAsrClient["draft"] = async () => ({
    segments: [{ text: "nháp", tStart: 0, tEnd: 1 }],
    language: "vi",
    elapsedMs: 100,
  });
  let detectPcmImpl: DraftAsrClient["detectPcm"] = async () => ({
    language: "vi",
    confidence: 0.95,
  });
  let asrImpl: AsrFinalClient["final"] = async (req) => [
    { text: `câu của ${req.segmentPath.split("/").pop()}`, tStart: 1, tEnd: 3 },
  ];

  const files: MeetingFiles = {
    meetingsRoot: "/data/meetings",
    segmentPath: (sid, i) =>
      `/data/meetings/${sid}/seg-${String(i).padStart(4, "0")}.wav`,
    ensureSessionDir: async () => undefined,
    openWriter: (_sid, index, onError): CaptureSegmentWriter => {
      const w = { index, bytes: 0, closed: false };
      writers.push(w);
      writerError = onError;
      return {
        append: (b) => {
          w.bytes += b.byteLength;
        },
        samples: () => w.bytes / 2,
        close: async () => {
          w.closed = true;
          return w.bytes / 2;
        },
      };
    },
    repairSegments: async (_sid, segs) =>
      segs.map((s) => ({ ...s, samples: s.samples + RATE, closed: true })),
    readFinal: async (sid, i) => finals.get(sid)?.get(i) ?? null,
    writeFinal: async (sid, i, segs) => {
      if (!finals.has(sid)) finals.set(sid, new Map());
      finals.get(sid)!.set(i, [...segs]);
    },
    mergeSegments: async (sid) => {
      merged.push(sid);
    },
    deleteSegments: async (sid) => {
      deletedSegments.push(sid);
    },
    deleteSession: async (sid) => {
      deletedSessions.push(sid);
    },
    appendDraft: async (sid, line) => {
      drafts.set(sid, [...(drafts.get(sid) ?? []), line]);
    },
    writeCheckpoint: async (sid, cp) => {
      checkpoints.set(sid, cp);
    },
    readCheckpoint: async (sid) => (checkpoints.get(sid) as never) ?? null,
    readDrafts: async (sid) =>
      (drafts.get(sid) ?? []).map((l) => ({
        text: l.text,
        tStart: l.tStart,
        tEnd: l.tEnd,
      })),
  };

  const deps: MeetingServiceDeps = {
    repo,
    pipeline: {
      createMeetingSource: ({ notebookId, title, sessionId }) => {
        const s: Source = {
          id: `src-${++idSeq}`,
          notebookId,
          kind: "meeting",
          title,
          status: "processing",
          errorCode: null,
          pageCount: null,
          createdAt: 1,
          updatedAt: 1,
          extractionVersion: 1,
        };
        sources.set(s.id, s);
        db.prepare(
          `INSERT INTO source (id, notebook_id, kind, title, origin, status, content_hash, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        ).run(
          s.id,
          notebookId,
          "meeting",
          title,
          `meeting:${sessionId}`,
          "processing",
          `h-${sessionId}`,
          1,
          1,
        );
        return s;
      },
      ingestParsed: async (sourceId, parsed) => {
        ingested.push({
          sourceId,
          text: parsed.pages.map((p) => p.text).join(""),
          timeMap: parsed.timeMap,
        });
        return ingestOk;
      },
    },
    sources: {
      getById: (id) => sources.get(id) ?? null,
      setTitle: (id, title) => {
        const s = sources.get(id);
        if (s) sources.set(id, { ...s, title });
      },
    },
    notebookExists: (id) => id === "nb1",
    files,
    asr: {
      final: (req) => (asrCalls.push(req), asrImpl(req)),
      detectLanguage: (req) => (
        detectCalls.push(req.segmentPath),
        detectImpl(req)
      ),
      draft: (req) => (
        draftCalls.push({
          language: req.language,
          tier: req.tier,
          bytes: req.pcm.byteLength,
        }),
        draftImpl(req)
      ),
      detectPcm: (req) => (
        detectPcmCalls.push(req.pcm.byteLength),
        detectPcmImpl(req)
      ),
      cancelDrafts: () => undefined,
    },
    fallbackReady: () => true,
    removeSource: async (id) => {
      removedSources.push(id);
      await svcRef.current?.onSourceRemoved(id);
      sources.delete(id);
      db.prepare("DELETE FROM source WHERE id = ?").run(id);
    },
    pushRecoverable: (n) => recoverablePushes.push(n),
    keepAwake: (on) => awake.push(on),
    pushDraft: (id, ev) => draftPushes.push({ id, ev }),
    downloadModel: async () => {
      downloads.push(clock.now);
    },
    machineInfo: () => ({
      platform: "darwin",
      arch: "arm64",
      cpu: "Test CPU",
      cores: 8,
      ramGb: 16,
    }),
    logEvent: (event, meta) => logs.push({ event, ...(meta ? { meta } : {}) }),
    freeBytes: async () => free,
    micGate: gate,
    mediaAccess: {
      status: () => opts.micStatus ?? "granted",
      ask: async () => (opts.micStatus ?? "granted") === "granted",
    },
    isOnlineActive: () => false,
    isModelReady: async () => true,
    prefs: { get: () => undefined, set: () => undefined },
    push: (_id, st) => pushes.push(st),
    emitProgress: (_src, _nb, frac) => progress.push(frac),
    notifyReady: (sourceId) => notified.push(sourceId),
    now: () => clock.now,
    uuid: () => `sess-${++idSeq}`,
    setInterval: (fn) => {
      intervalFn = fn;
      return 1 as unknown as ReturnType<typeof setInterval>;
    },
    clearInterval: () => {
      intervalFn = null;
    },
    segmentSeconds: opts.segmentSeconds ?? 300,
    sampleRate: RATE,
    ...(opts.testFakeMic ? { testFakeMic: true } : {}),
    ...(opts.maxDurationSec ? { maxDurationSec: opts.maxDurationSec } : {}),
  };
  const svc = createMeetingService(deps);
  svcRef.current = svc;
  return {
    svc,
    repo,
    sources,
    writers,
    files: finals,
    merged,
    deletedSegments,
    deletedSessions,
    pushes,
    progress,
    ingested,
    notified,
    asrCalls,
    detectCalls,
    draftCalls,
    detectPcmCalls,
    drafts,
    draftPushes,
    logs,
    downloads,
    setDraft: (fn) => (draftImpl = fn),
    checkpoints,
    recoverablePushes,
    awake,
    removedSources,
    setDetectPcm: (fn) => (detectPcmImpl = fn),
    clock,
    tick: () => intervalFn?.(),
    setAsr: (fn) => (asrImpl = fn),
    setDetect: (fn) => (detectImpl = fn),
    setFree: (b) => (free = b),
    setIngestOk: (ok) => (ingestOk = ok),
    failWriter: () => writerError?.(new Error("EIO")),
    gate,
    idle: () => svc.whenIdle(),
    recreate: () => createMeetingService(deps),
  };
}

/** Gửi `seconds` lô 1 s liên tiếp, mỗi lô cách 1000 ms. */
export function feed(
  h: Harness,
  sessionId: string,
  seconds: number,
  startSeq = 0,
): number {
  let seq = startSeq;
  for (let i = 0; i < seconds; i++) {
    h.clock.now += 1000;
    h.svc.acceptAudio(OWNER, {
      sessionId,
      seq: seq++,
      pcm: new ArrayBuffer(SEC),
    });
  }
  return seq;
}

/** Như feed nhưng lô có lời nói (sóng sin) ⇒ qua VAD, sinh nháp. */
export function feedSpeech(
  h: Harness,
  sessionId: string,
  seconds: number,
  startSeq = 0,
): number {
  const one = new Int16Array(RATE);
  for (let i = 0; i < RATE; i++)
    one[i] = Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / RATE));
  let seq = startSeq;
  for (let i = 0; i < seconds; i++) {
    h.clock.now += 1000;
    h.svc.acceptAudio(OWNER, {
      sessionId,
      seq: seq++,
      pcm: one.slice().buffer,
    });
  }
  return seq;
}

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

export async function startSession(
  h: Harness,
  title = "Cuộc họp 12/10, 14:30",
  languageMode: "vi" | "en" | "auto" | "multi" = "vi",
) {
  await h.svc.prepare(OWNER, { notebookId: "nb1" });
  return h.svc.start(OWNER, {
    notebookId: "nb1",
    title,
    languageMode,
    deviceLabel: "Mic A",
  });
}
