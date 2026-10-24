import { open, stat } from "node:fs/promises";
import type { Segment } from "../ingestion/audio/audio-transcript";
import {
  parseMainMessage,
  type DraftTier,
  type MainToWorker,
  type WorkerToMain,
} from "./asr-protocol";
import { fakeTranscribe } from "./fake-asr";
import { dedupeHallucination } from "./hallucination";
import { pickLanguage, type DetectedLanguage } from "./language-detect";
import { SAMPLE_RATE } from "./meeting-constants";
import { WAV_HEADER_BYTES } from "./wav";

// 186 — entry utilityProcess "SourceCraft ASR" (research R5). Nhận lệnh từ main qua parentPort (đã kiểm bằng
// parseMainMessage, đường dẫn bắt buộc nằm trong <userData>/meetings/ — argv[2]). Chạy Whisper (transformers.js) TUẦN TỰ;
// lỗi ở đây không ảnh hưởng việc ghi audio ở main. Không log nội dung. Kết quả: thời gian TƯƠNG ĐỐI đầu phân đoạn hiện
// tại (vùng ngữ cảnh lấy từ cuối phân đoạn trước có giá trị âm).

type Port = {
  on(ev: "message", cb: (e: { data: unknown }) => void): void;
  postMessage(m: WorkerToMain): void;
};
const port = (process as unknown as { parentPort: Port }).parentPort;
const meetingsRoot = process.argv[2] ?? "";
/** Whisper nhìn tối đa 30 s cho một lượt encoder — đủ để phát hiện ngôn ngữ. */
const DETECT_SEC = 30;

interface AsrChunk {
  text: string;
  timestamp: [number | null, number | null];
}
type Pipe = (
  input: Float32Array,
  opts: object,
) => Promise<{ chunks?: AsrChunk[] }>;

let config: Extract<MainToWorker, { type: "init" }> | null = null;
/** Pipeline theo model: model chốt (nháp dùng chung — nạp một lần) và model dự phòng q8 khi máy chậm (ADR spike mục 4). */
const pipes = new Map<string, Promise<Pipe>>();
let loading = 0;
const cancelled = new Set<string>();
let queue: Promise<void> = Promise.resolve();

/** PCM của cả tệp, hoặc chỉ `last` giây cuối (vùng chồng lấn) / `first` giây đầu (phát hiện ngôn ngữ). */
async function readPcm(
  path: string,
  range: { last?: number; first?: number } = {},
): Promise<Int16Array> {
  const size = (await stat(path)).size;
  const dataBytes = Math.max(0, size - WAV_HEADER_BYTES);
  const limitSec = range.last ?? range.first;
  const want =
    limitSec === undefined
      ? dataBytes
      : Math.min(dataBytes, Math.floor(limitSec * SAMPLE_RATE) * 2);
  const start =
    WAV_HEADER_BYTES + (range.last !== undefined ? dataBytes - want : 0);
  const buf = Buffer.alloc(want - (want % 2));
  const fh = await open(path, "r");
  try {
    await fh.read(buf, 0, buf.length, start);
  } finally {
    await fh.close();
  }
  return new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}

function loadPipeline(
  cfg: NonNullable<typeof config>,
  tier: DraftTier = "primary",
): Promise<Pipe> {
  const model = tier === "primary" ? cfg.finalModel : cfg.fallbackModel;
  const existing = pipes.get(model);
  if (existing) return existing;
  if (loading++ === 0)
    port.postMessage({ type: "modelDownload", active: true });
  const p = (async () => {
    const tf = await import("@huggingface/transformers");
    tf.env.cacheDir = cfg.cacheDir;
    return (await tf.pipeline(
      "automatic-speech-recognition",
      model,
      tier === "fallback" ? { dtype: "q8" } : {},
    )) as unknown as Pipe;
  })()
    .catch((e: unknown) => {
      pipes.delete(model); // lần sau thử lại (vd. có Internet trở lại)
      throw e;
    })
    .finally(() => {
      if (--loading === 0)
        port.postMessage({ type: "modelDownload", active: false });
    });
  pipes.set(model, p);
  return p;
}

const toFloat = (pcm: Int16Array): Float32Array => {
  const f32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f32[i] = (pcm[i] ?? 0) / 0x8000;
  return f32;
};

/** Phần của pipeline ASR dùng cho bước phát hiện ngôn ngữ (cùng model đã nạp — không tải/nạp thêm). */
interface PipeParts {
  model: (
    x: object,
  ) => Promise<{ logits: { dims: number[]; data: ArrayLike<number> } }>;
  processor: (x: Float32Array) => Promise<{ input_features: unknown }>;
  tokenizer: { convert_tokens_to_ids(t: string): number };
}

/** Logits của <|vi|>, <|en|> ở bước decoder đầu sau <|startoftranscript|> (ADR spike S2). */
async function languageLogits(
  pipe: Pipe,
  pcm: Float32Array,
): Promise<[number, number]> {
  const { model, processor, tokenizer } = pipe as unknown as PipeParts;
  const tf = await import("@huggingface/transformers");
  const sot = tokenizer.convert_tokens_to_ids("<|startoftranscript|>");
  const { input_features } = await processor(pcm);
  const { logits } = await model({
    input_features,
    decoder_input_ids: new tf.Tensor(
      "int64",
      BigInt64Array.from([BigInt(sot)]),
      [1, 1],
    ),
  });
  const vocab = logits.dims[logits.dims.length - 1] ?? 0;
  const steps = logits.dims[logits.dims.length - 2] ?? 1;
  const base = (steps - 1) * vocab;
  const at = (tok: string): number =>
    logits.data[base + tokenizer.convert_tokens_to_ids(tok)] ?? Number.NaN;
  return [at("<|vi|>"), at("<|en|>")];
}

async function detectOn(
  pipe: Pipe,
  pcm: Float32Array,
): Promise<DetectedLanguage | null> {
  return pickLanguage(...(await languageLogits(pipe, pcm)));
}

type AsrOut = { text: string; tStart: number; tEnd: number }[];

/** Nhận dạng có timestamp; `language` tường minh (không bao giờ để Whisper tự chọn — spike S2). */
async function transcribe(
  pipe: Pipe,
  pcm: Float32Array,
  language: "vi" | "en" | null,
): Promise<AsrOut> {
  const out = await pipe(pcm, {
    return_timestamps: true,
    chunk_length_s: 30,
    ...(language ? { language, task: "transcribe" } : {}),
  });
  return (out.chunks ?? [])
    .filter((c) => typeof c.text === "string")
    .map((c) => ({
      text: c.text,
      tStart: c.timestamp?.[0] ?? 0,
      tEnd: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
    }));
}

/** Đa ngôn ngữ (ADR spike mục 6): mỗi cửa sổ ≤ 30 s phát hiện rồi nhận dạng với ngôn ngữ đó. */
async function transcribePerWindow(
  pipe: Pipe,
  pcm: Float32Array,
): Promise<AsrOut> {
  const win = DETECT_SEC * SAMPLE_RATE;
  const out: AsrOut = [];
  for (let start = 0; start < pcm.length; start += win) {
    const chunk = pcm.subarray(start, Math.min(pcm.length, start + win));
    const lang = (await detectOn(pipe, chunk))?.language ?? null;
    const offset = start / SAMPLE_RATE;
    for (const s of await transcribe(pipe, chunk, lang))
      out.push({
        text: s.text,
        tStart: s.tStart + offset,
        tEnd: s.tEnd + offset,
      });
  }
  return out;
}

async function handleDraft(
  msg: Extract<MainToWorker, { type: "draft" }>,
): Promise<void> {
  const fail = (code: "asrFailed" | "modelMissing" | "cancelled"): void =>
    port.postMessage({ type: "error", reqId: msg.reqId, code });
  if (cancelled.delete(msg.reqId)) return fail("cancelled");
  const cfg = config;
  if (!cfg) return fail("asrFailed");
  const pcm16 = new Int16Array(msg.pcm);
  let started = performance.now();
  if (cfg.fake) {
    port.postMessage({
      type: "draftResult",
      reqId: msg.reqId,
      segments: dedupeHallucination(fakeTranscribe(pcm16, SAMPLE_RATE)),
      language: msg.language === "perWindow" ? "vi" : msg.language,
      ...(msg.language === "perWindow" ? { confidence: 1 } : {}),
      elapsedMs: performance.now() - started,
    });
    return;
  }
  let pipe: Pipe;
  try {
    pipe = await loadPipeline(cfg, msg.tier);
  } catch {
    return fail("modelMissing");
  }
  // Review PR B (B2): không tính thời gian nạp/tải model vào RTF (mẫu đầu lớn ⇒ hạ cấp oan).
  started = performance.now();
  try {
    const f32 = toFloat(pcm16);
    const picked =
      msg.language === "perWindow" ? await detectOn(pipe, f32) : null;
    const language =
      msg.language === "perWindow" ? (picked?.language ?? null) : msg.language;
    const segments = dedupeHallucination(await transcribe(pipe, f32, language));
    if (cancelled.delete(msg.reqId)) return;
    port.postMessage({
      type: "draftResult",
      reqId: msg.reqId,
      segments,
      language: segments.length > 0 ? language : null,
      ...(picked ? { confidence: picked.confidence } : {}),
      elapsedMs: performance.now() - started,
    });
  } catch {
    fail("asrFailed");
  }
}

async function handleDetectPcm(
  msg: Extract<MainToWorker, { type: "detectPcm" }>,
): Promise<void> {
  const fail = (code: "asrFailed" | "modelMissing" | "cancelled"): void =>
    port.postMessage({ type: "error", reqId: msg.reqId, code });
  if (cancelled.delete(msg.reqId)) return fail("cancelled");
  const cfg = config;
  if (!cfg) return fail("asrFailed");
  if (cfg.fake) {
    port.postMessage({
      type: "language",
      reqId: msg.reqId,
      language: "vi",
      confidence: 1,
    });
    return;
  }
  let pipe: Pipe;
  try {
    pipe = await loadPipeline(cfg);
  } catch {
    return fail("modelMissing");
  }
  try {
    const picked = await detectOn(pipe, toFloat(new Int16Array(msg.pcm)));
    if (!picked) return fail("asrFailed");
    if (cancelled.delete(msg.reqId)) return;
    port.postMessage({ type: "language", reqId: msg.reqId, ...picked });
  } catch {
    fail("asrFailed");
  }
}

async function handleLoad(
  msg: Extract<MainToWorker, { type: "load" }>,
): Promise<void> {
  const cfg = config;
  if (!cfg) {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
    return;
  }
  try {
    if (!cfg.fake) await loadPipeline(cfg, msg.tier);
    port.postMessage({ type: "loaded", reqId: msg.reqId });
  } catch {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "modelMissing" });
  }
}

async function handleDetect(
  msg: Extract<MainToWorker, { type: "detect" }>,
): Promise<void> {
  const fail = (code: "asrFailed" | "modelMissing" | "cancelled"): void =>
    port.postMessage({ type: "error", reqId: msg.reqId, code });
  if (cancelled.delete(msg.reqId)) return fail("cancelled");
  const cfg = config;
  if (!cfg) return fail("asrFailed");
  if (cfg.fake) {
    port.postMessage({
      type: "language",
      reqId: msg.reqId,
      language: "vi",
      confidence: 1,
    });
    return;
  }
  let pcm: Int16Array;
  let pipe: Pipe;
  try {
    pcm = await readPcm(msg.segmentPath, { first: DETECT_SEC });
  } catch {
    return fail("asrFailed");
  }
  try {
    pipe = await loadPipeline(cfg);
  } catch {
    return fail("modelMissing");
  }
  try {
    const picked = await detectOn(pipe, toFloat(pcm));
    if (!picked) return fail("asrFailed");
    if (cancelled.delete(msg.reqId)) return;
    port.postMessage({ type: "language", reqId: msg.reqId, ...picked });
  } catch {
    fail("asrFailed");
  }
}

async function handleFinal(
  msg: Extract<MainToWorker, { type: "final" }>,
): Promise<void> {
  if (cancelled.delete(msg.reqId)) {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "cancelled" });
    return;
  }
  const cfg = config;
  if (!cfg) {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
    return;
  }
  let combined: Int16Array;
  let tailSec = 0;
  try {
    const current = await readPcm(msg.segmentPath);
    const tail =
      msg.prevSegmentPath && msg.overlapSec > 0
        ? await readPcm(msg.prevSegmentPath, { last: msg.overlapSec })
        : new Int16Array(0);
    tailSec = tail.length / SAMPLE_RATE;
    combined = new Int16Array(tail.length + current.length);
    combined.set(tail, 0);
    combined.set(current, tail.length);
  } catch {
    port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
    return;
  }

  let segments: Segment[];
  if (cfg.fake) {
    segments = fakeTranscribe(combined, SAMPLE_RATE);
  } else {
    let pipe: Pipe;
    try {
      pipe = await loadPipeline(cfg);
    } catch {
      port.postMessage({
        type: "error",
        reqId: msg.reqId,
        code: "modelMissing",
      });
      return;
    }
    try {
      const f32 = toFloat(combined);
      segments = dedupeHallucination(
        msg.language === "perWindow"
          ? await transcribePerWindow(pipe, f32)
          : await transcribe(pipe, f32, msg.language),
      );
    } catch {
      port.postMessage({ type: "error", reqId: msg.reqId, code: "asrFailed" });
      return;
    }
  }
  if (cancelled.delete(msg.reqId)) return;
  port.postMessage({
    type: "result",
    reqId: msg.reqId,
    segments: segments.map((s) => ({
      text: s.text,
      tStart: s.tStart - tailSec,
      tEnd: Math.max(s.tStart, s.tEnd) - tailSec,
    })),
  });
}

port.on("message", (e) => {
  const msg = parseMainMessage(e.data, meetingsRoot);
  if (!msg) return;
  if (msg.type === "init") {
    config = msg;
    port.postMessage({ type: "ready" });
  } else if (msg.type === "cancel") {
    cancelled.add(msg.reqId);
  } else {
    const run =
      msg.type === "detect"
        ? () => handleDetect(msg)
        : msg.type === "detectPcm"
          ? () => handleDetectPcm(msg)
          : msg.type === "draft"
            ? () => handleDraft(msg)
            : msg.type === "load"
              ? () => handleLoad(msg)
              : () => handleFinal(msg);
    queue = queue.then(run).catch(() => undefined);
  }
});
