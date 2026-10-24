import { summarizeLlmRuns, type LlmRun, type LlmSummary } from "./llm-metrics";
import {
  selectLlmSample,
  summarizeRefusals,
  type LlmSampleMode,
  type RefusalRun,
  type RefusalSummary,
} from "./llm-sample";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { openDatabase, type Db } from "../../../src/main/db/database";
import { runMigrations } from "../../../src/main/db/migrations";
import { createNotebookRepo } from "../../../src/main/services/notebooks/notebook-repo";
import { createSourceRepo } from "../../../src/main/services/ingestion/source-repo";
import { createLanceVectorStore } from "../../../src/main/services/ingestion/vector-store";
import { createIngestionPipeline } from "../../../src/main/services/ingestion/pipeline";
import { createKeywordStore } from "../../../src/main/services/ingestion/keyword-store";
import { parseText } from "../../../src/main/services/ingestion/parsers/text";
import { parsePdf } from "../../../src/main/services/ingestion/parsers/pdf";
import { createEmbedder } from "../../../src/main/services/embedding/embed-model";
import { createOllamaClient } from "../../../src/main/services/ai-runtime/ollama-client";
import {
  retrieve,
  type RetrievalDeps,
} from "../../../src/main/services/rag/retrieval";
import { createRagService } from "../../../src/main/services/rag/rag-service";
import type { RelevanceConfig } from "../../../src/main/services/rag/relevance-filter";
import type { RerankConfig } from "../../../src/main/services/rag/rerank-filter";
import { DEFAULT_COLOR } from "../../../src/shared/notebook-palette";
import {
  chunkContainsAnyQuote,
  docFile,
  docFormat,
  type Dataset,
  type EvalFormat,
  type EvalQuestion,
} from "./dataset";
import { outcomeFormat, type QuestionOutcome } from "./metrics";
import type { RerankCandidate } from "./rerank-diagnose";

// 108: phần I/O của công cụ đo (KHÔNG tính coverage). Dựng SQLite + LanceDB + FTS5 THẬT trên thư mục tạm, nạp mọi
// tài liệu (kể cả nhiễu) vào MỘT notebook qua pipeline thật (chia đoạn + e5 passage), rồi gọi ĐÚNG retrieve() của app
// với từng cấu hình. Embed/tìm kiếm của mỗi câu chạy MỘT lần (cache) — các cấu hình chỉ lọc lại trên hit đã có.
// KHÔNG đọc/ghi data dir người dùng (FR-005); mô hình chỉ tải vào cacheDir.

export interface EvalIndex {
  notebookId: string;
  /** 177: id tài liệu → định dạng (gắn `format` cho từng QuestionOutcome) */
  formats: ReadonlyMap<string, EvalFormat>;
  /** deps có cache — gọi retrieve() lặp lại cho nhiều cấu hình mà không embed/tìm lại */
  deps: RetrievalDeps;
  /** deps KHÔNG cache (đo độ trễ thật một lượt) */
  rawDeps: RetrievalDeps;
  /** điểm bm25 của mọi hit BM25 trên các câu (để chọn mốc minScore) */
  bm25Scores: number[];
  distances: {
    answerHit: number[];
    answerMiss: number[];
    unanswerable: number[];
  };
  /** độ trễ trung bình một lượt retrieve() không cache (ms) */
  coldRetrieveMs: number;
  close(): Promise<void>;
}

function memo<K, V>(fn: (k: K) => Promise<V>, keyOf: (k: K) => string) {
  const cache = new Map<string, Promise<V>>();
  return (k: K): Promise<V> => {
    const key = keyOf(k);
    let p = cache.get(key);
    if (!p) {
      p = fn(k);
      cache.set(key, p);
    }
    return p;
  };
}

function cachedDeps(raw: RetrievalDeps): RetrievalDeps {
  const embed = memo(raw.embed, (t) => t);
  const search = memo(
    (a: { v: number[]; nb: string | null | undefined; k: number }) =>
      raw.search(a.v, a.nb, a.k),
    (a) => `${a.nb ?? "all"}|${a.k}|${a.v.join(",")}`,
  );
  const bm25 = new Map<string, { id: string; score: number }[]>();
  const vecCache = new Map<string, number[]>();
  return {
    ...raw,
    embed,
    search: (v, nb, k) => search({ v, nb, k }),
    searchBm25: raw.searchBm25
      ? (nb, q, k) => {
          const key = `${nb ?? "all"}|${k}|${q}`;
          const hit = bm25.get(key);
          if (hit) return hit;
          const r = raw.searchBm25!(nb, q, k);
          bm25.set(key, r);
          return r;
        }
      : undefined,
    getVectorsByIds: raw.getVectorsByIds
      ? async (ids) => {
          const missing = ids.filter((id) => !vecCache.has(id));
          if (missing.length > 0) {
            const got = await raw.getVectorsByIds!(missing);
            for (const [id, v] of got) vecCache.set(id, v);
          }
          return new Map(
            ids
              .filter((id) => vecCache.has(id))
              .map((id) => [id, vecCache.get(id)!]),
          );
        }
      : undefined,
  };
}

/** Dựng chỉ mục thật trên thư mục tạm và nạp mọi tài liệu. */
export async function buildIndex(
  ds: Dataset,
  corpusDir: string,
  cacheDir: string,
): Promise<EvalIndex> {
  const dir = mkdtempSync(join(tmpdir(), "iv-eval-"));
  const db = openDatabase(join(dir, "insightvault.db"));
  const close = async (): Promise<void> => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    return await populate(ds, corpusDir, cacheDir, dir, db, close);
  } catch (e) {
    await close(); // lỗi giữa chừng ⇒ vẫn dọn thư mục tạm + đóng DB
    throw e;
  }
}

async function populate(
  ds: Dataset,
  corpusDir: string,
  cacheDir: string,
  dir: string,
  db: Db,
  close: () => Promise<void>,
): Promise<EvalIndex> {
  runMigrations(db);
  const notebook = createNotebookRepo(db).create({
    name: "eval",
    color: DEFAULT_COLOR,
  });
  const sourceRepo = createSourceRepo(db);
  const vectorStore = await createLanceVectorStore(join(dir, "vectors"));
  const keywordStore = createKeywordStore(db);
  const embedder = createEmbedder({ cacheDir });

  const pipeline = createIngestionPipeline({
    sourceRepo,
    vectorStore,
    getProvider: () => ({
      embed: async ({ text }) => ({
        vector: (await embedder.embed([text], "passage"))[0],
      }),
    }),
    embedBatch: async (texts) => {
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += 32) {
        vectors.push(
          ...(await embedder.embed(texts.slice(i, i + 32), "passage")),
        );
      }
      return { vectors, dim: vectors[0]?.length ?? 0 };
    },
    isRuntimeReady: async () => true,
    readFile: async (p) => new Uint8Array(readFileSync(p)),
    // 177: PDF qua ĐÚNG parsePdf của app với cấu hình mặc định (y hệt src/main/services/ingestion/ingestion.ts — nhánh "pdf");
    // còn lại (md) như 108.
    parseFile: async (kind, bytes) =>
      kind === "pdf"
        ? parsePdf(bytes)
        : parseText(new TextDecoder().decode(bytes)),
    emit: () => {},
  });

  for (const d of ds.documents) {
    await pipeline.add({
      notebookId: notebook.id,
      kind: docFormat(d),
      filePath: join(corpusDir, docFile(d)),
    });
  }
  await pipeline.whenIdle();
  const notReady = sourceRepo
    .listByNotebook(notebook.id)
    .filter((s) => s.status !== "ready");
  if (notReady.length > 0) {
    throw new Error(
      `Nạp tài liệu lỗi: ${notReady.map((s) => `${s.title} (${s.status})`).join(", ")}`,
    );
  }

  const rawDeps: RetrievalDeps = {
    embed: async (text) => (await embedder.embed([text], "query"))[0],
    search: (v, nb, k) => vectorStore.search(v, nb, k),
    getChunksByIds: (ids) => sourceRepo.getChunksByIds(ids),
    sourceTitle: (sid) => sourceRepo.getById(sid)?.title ?? "Nguồn",
    searchBm25: (nb, q, k) => keywordStore.searchBm25(nb, q, k),
    getVectorsByIds: (ids) => vectorStore.getVectorsByIds(ids),
  };

  return {
    notebookId: notebook.id,
    formats: new Map(ds.documents.map((d) => [d.id, docFormat(d)])),
    deps: cachedDeps(rawDeps),
    rawDeps,
    bm25Scores: [],
    distances: { answerHit: [], answerMiss: [], unanswerable: [] },
    coldRetrieveMs: 0,
    close,
  };
}

/**
 * Lượt đầu (không cache) cho mọi câu: đo độ trễ thật, thu điểm bm25 + phân bố khoảng cách (FR-006), đồng thời làm
 * ấm cache cho các lượt quét cấu hình.
 */
export async function warmUp(
  index: EvalIndex,
  questions: readonly EvalQuestion[],
  baseline: RelevanceConfig,
): Promise<void> {
  let total = 0;
  for (const q of questions) {
    const t0 = performance.now();
    await retrieve(q.text, index.notebookId, index.rawDeps, [], baseline);
    total += performance.now() - t0;

    const v = await index.deps.embed(q.text);
    const vHits = await index.deps.search(v, index.notebookId, 10);
    const kHits = index.deps.searchBm25?.(index.notebookId, q.text, 10) ?? [];
    index.bm25Scores.push(...kHits.map((h) => h.score));
    if (vHits.length === 0) continue;
    if (q.type === "unanswerable") {
      index.distances.unanswerable.push(vHits[0].score);
      continue;
    }
    const chunks = new Map(
      index.deps.getChunksByIds(vHits.map((h) => h.id)).map((c) => [c.id, c]),
    );
    const isHit = (id: string) =>
      chunkContainsAnyQuote(chunks.get(id)?.text ?? "", q.quotes);
    const bestHit = vHits.find((h) => isHit(h.id));
    const bestMiss = vHits.find((h) => !isHit(h.id));
    if (bestHit) index.distances.answerHit.push(bestHit.score);
    if (bestMiss) index.distances.answerMiss.push(bestMiss.score);
  }
  index.coldRetrieveMs = questions.length === 0 ? 0 : total / questions.length;
}

/** 109: bộ chấm độ liên quan gắn vào retrieve() của app (deps.rerank) + cấu hình rerank cần đo. */
export interface RerankRun {
  score: NonNullable<RetrievalDeps["rerank"]>;
  cfg: RerankConfig;
  /** đếm số lần bước chấm bị bỏ qua (fail-open) — phải bằng 0 khi đo */
  onSkip?: (reason: string) => void;
  /**
   * 187 (research R1): ghi điểm của MỌI ứng viên mỗi lượt chấm (kể cả câu bị từ chối) ⇒ `QuestionOutcome.rerankCandidates`.
   * `windowText` (scorer) cho cờ trích dẫn còn trong cửa sổ token của đoạn đúng.
   */
  record?: { windowText: (query: string, passageText: string) => string };
}

type Scored = { id: string; text: string; score: number };

/** 187: ô ghi lượt chấm của câu ĐANG đo (đặt lại trước mỗi câu ⇒ không lẫn câu trùng chữ; null = câu không được chấm). */
type ScoreSlot = { last: Scored[] | null };

/** 187: bọc hàm chấm để nhớ ứng viên theo ĐÚNG thứ tự retrieve() gửi + điểm (thiếu điểm ⇒ NaN, không âm thầm thành 0). */
function recordingScore(
  score: RerankRun["score"],
  slot: ScoreSlot,
): RerankRun["score"] {
  return async (query, passages) => {
    const scores = await score(query, passages);
    slot.last = passages.map((p) => ({
      ...p,
      score: scores.get(p.id) ?? Number.NaN,
    }));
    return scores;
  };
}

/** 187: ứng viên đã ghi của một câu ⇒ `RerankCandidate[]` (hit + trích dẫn trong cửa sổ cho đoạn đúng). */
function toCandidates(
  q: EvalQuestion,
  scored: readonly Scored[],
  deps: RetrievalDeps,
  windowText: (query: string, passageText: string) => string,
): RerankCandidate[] {
  const sourceOf = new Map(
    deps.getChunksByIds(scored.map((s) => s.id)).map((c) => [c.id, c.sourceId]),
  );
  return scored.map((s) => {
    const hit =
      q.type === "answerable" && chunkContainsAnyQuote(s.text, q.quotes);
    const sid = sourceOf.get(s.id);
    return {
      chunkId: s.id,
      source: sid ? deps.sourceTitle(sid) : "?",
      score: s.score,
      hit,
      quoteInWindow: hit
        ? chunkContainsAnyQuote(windowText(q.text, s.text), q.quotes)
        : null,
    };
  });
}

/**
 * Chạy retrieve() của app với một cấu hình cho mọi câu ⇒ kết quả từng câu + độ trễ trung bình (cache ấm). 109: `rerank`
 * gắn bộ chấm vào ĐÚNG retrieve() của app (không dựng đường truy xuất riêng — bài học 108).
 */
export async function evaluateConfig(
  index: EvalIndex,
  questions: readonly EvalQuestion[],
  cfg: RelevanceConfig,
  rerank?: RerankRun,
): Promise<{ outcomes: QuestionOutcome[]; avgRetrieveMs: number }> {
  const slot: ScoreSlot = { last: null };
  const score =
    rerank?.record && rerank.score
      ? recordingScore(rerank.score, slot)
      : rerank?.score;
  const deps: RetrievalDeps = rerank
    ? { ...index.deps, rerank: score, onRerankSkip: rerank.onSkip }
    : index.deps;
  const outcomes: QuestionOutcome[] = [];
  let total = 0;
  for (const q of questions) {
    slot.last = null;
    const t0 = performance.now();
    const scored = await retrieve(
      q.text,
      index.notebookId,
      deps,
      [],
      cfg,
      rerank?.cfg ?? null,
    );
    total += performance.now() - t0;
    const recorded = slot.last;
    const rank =
      q.type === "answerable"
        ? scored.findIndex((s) => chunkContainsAnyQuote(s.chunk.text, q.quotes))
        : -1;
    outcomes.push({
      questionId: q.id,
      lang: q.lang,
      type: q.type,
      split: q.split,
      rejected: scored.length === 0,
      hitRank: rank >= 0 ? rank + 1 : null,
      format: outcomeFormat(q, index.formats),
      topSources: scored.slice(0, 6).map((s) => s.sourceTitle),
      // Câu không được chấm (không ứng viên / fail-open) ⇒ không gắn ứng viên ⇒ diagnoseRerank bỏ qua, không đoán nguyên nhân.
      ...(rerank?.record && recorded
        ? {
            rerankCandidates: toCandidates(
              q,
              recorded,
              index.deps,
              rerank.record.windowText,
            ),
          }
        : {}),
    });
  }
  return {
    outcomes,
    avgRetrieveMs: questions.length === 0 ? 0 : total / questions.length,
  };
}

export type LlmResult =
  | {
      notFoundRate: number;
      n: number;
      model: string;
      summary: LlmSummary;
      /** 205: từng câu không đáp án qua `repeats` lần chạy (chỉ có khi mẫu `unanswerable`) */
      refusals?: RefusalSummary[];
      sample: LlmSampleMode;
      repeats: number;
    }
  | { skipped: string };

/**
 * Phần end-to-end THAM KHẢO (FR-008, research R9): rag-service thật + Ollama cục bộ, chế độ theo nguồn, câu hold-out
 * tiếng Việt CÓ đáp án ⇒ tỉ lệ bị trả "không tìm thấy". Không dùng để xét ĐẠT. Ollama không chạy ⇒ bỏ qua.
 */
export async function runWithLlm(
  index: EvalIndex,
  questions: readonly EvalQuestion[],
  cfg: RelevanceConfig,
  modelName?: string,
  /** 109: bộ chấm độ liên quan đã hiệu chuẩn (retrieve() của rag-service dùng cấu hình mặc định = bản ghi) */
  rerank?: NonNullable<RetrievalDeps["rerank"]>,
  /** 205: `unanswerable` = mọi câu không đáp án vi + en; `repeats` = số lần chạy lặp mỗi câu (tầng trả lời không tất định) */
  opts: { sample?: LlmSampleMode; repeats?: number } = {},
): Promise<LlmResult> {
  const mode = opts.sample ?? "default";
  const repeats = Math.max(1, opts.repeats ?? 1);
  const client = createOllamaClient();
  if (!(await client.ping())) {
    return { skipped: "Ollama không chạy ở máy này — bỏ phần LLM" };
  }
  const model =
    modelName ??
    (await client.listModels()).find((m) => m.kind === "chat")?.name;
  if (!model) return { skipped: "Ollama không có model chat nào" };

  const svc = createRagService({
    ...index.deps,
    ...(rerank ? { rerank } : {}),
    relevanceConfig: cfg,
    chat: async (messages) => (await client.chat({ model, messages })).content,
    chatStream: async (messages) =>
      (await client.chat({ model, messages })).content,
  });
  // 123 (SC-006): câu tiếng Việt hold-out (có + không đáp án) và MỌI câu English ⇒ đo [n] hợp lệ, từ chối đúng,
  // trả nhầm "không tìm thấy", ngôn ngữ câu trả lời khớp câu hỏi. Giữ chỉ số cũ (vi hold-out có đáp án).
  const sample = selectLlmSample(questions, mode);
  const runs: LlmRun[] = [];
  const refusalRuns: RefusalRun[] = [];
  for (const q of sample) {
    for (let i = 0; i < repeats; i += 1) {
      const res = await svc.ask({
        notebookId: index.notebookId,
        question: q.text,
        mode: "grounded",
        history: [],
      });
      runs.push({
        lang: q.lang,
        type: q.type,
        notFound: res.notFound,
        citationCount: res.citations.length,
        answer: res.answer,
      });
      refusalRuns.push({
        questionId: q.id,
        notFound: res.notFound,
        citationCount: res.citations.length,
        answer: res.answer,
      });
    }
  }
  const viAns = runs.filter((r) => r.lang === "vi" && r.type === "answerable");
  return {
    notFoundRate:
      viAns.length === 0
        ? 0
        : viAns.filter((r) => r.notFound).length / viAns.length,
    n: viAns.length,
    model,
    summary: summarizeLlmRuns(runs),
    sample: mode,
    repeats,
    ...(mode === "unanswerable"
      ? { refusals: summarizeRefusals(refusalRuns) }
      : {}),
  };
}
