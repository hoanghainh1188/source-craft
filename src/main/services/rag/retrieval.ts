import type { RagTurn } from "@shared/ipc/types";
import type { VectorSearchHit } from "../ingestion/vector-store";
import type { ScoredChunk } from "./rag-types";
import { RETRIEVAL_TOP_K, HYBRID_BRANCH_TOPK } from "./constants";
import { reciprocalRankFusion, mmrSelect, cosine } from "./fusion";
import { selectRelevant, type RelevanceConfig } from "./relevance-filter";
import { RELEVANCE_CALIBRATION } from "./relevance-calibration";
import {
  applyRerank,
  RerankBusyError,
  RerankNotReadyError,
  type RerankConfig,
} from "./rerank-filter";

// Truy hồi hybrid (055, nâng 013): rewrite câu hỏi → vector ∥ BM25 → RRF → MMR → ScoredChunk (GIỮ locator
// — Constitution II). DI để test không cần LanceDB/FTS/Ollama.

export interface RetrievalDeps {
  embed: (text: string) => Promise<number[]>;
  search: (
    vector: number[],
    notebookId: string | null | undefined,
    topK: number,
  ) => Promise<VectorSearchHit[]>;
  getChunksByIds: (ids: string[]) => import("@shared/ipc/types").Chunk[];
  sourceTitle: (sourceId: string) => string;
  sourceNotebook?: (
    sourceId: string,
  ) => { notebookId?: string; notebookName?: string } | null;
  // 055 (tuỳ chọn — thiếu thì lùi về hành vi 013 chỉ-vector, không rewrite):
  rewrite?: (question: string, history: RagTurn[]) => Promise<string>;
  searchBm25?: (
    notebookId: string | null | undefined,
    query: string,
    topK: number,
  ) => { id: string; score: number }[];
  getVectorsByIds?: (ids: string[]) => Promise<Map<string, number[]>>;
  // 109 (tuỳ chọn — thiếu thì không chấm, hành vi 108): bộ chấm độ liên quan cục bộ, id → điểm 0..1.
  rerank?: (
    query: string,
    passages: { id: string; text: string }[],
  ) => Promise<Map<string, number>>;
  /** 109: bước chấm bị bỏ qua (fail-open) — main ghi mã sự kiện, không nội dung. */
  onRerankSkip?: (reason: RerankSkipReason) => void;
}

export type RerankSkipReason = "notReady" | "busy" | "timeout" | "error";

class RerankTimeoutError extends Error {}

/** Chấm có giới hạn thời gian; lỗi/quá giờ/chưa sẵn sàng ⇒ null + báo lý do (fail-open, FR-013). */
async function scoreWithin(
  deps: RetrievalDeps,
  query: string,
  passages: { id: string; text: string }[],
  timeoutMs: number,
): Promise<Map<string, number> | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      deps.rerank!(query, passages),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RerankTimeoutError()), timeoutMs);
      }),
    ]);
  } catch (e) {
    deps.onRerankSkip?.(
      e instanceof RerankTimeoutError
        ? "timeout"
        : e instanceof RerankNotReadyError
          ? "notReady"
          : e instanceof RerankBusyError
            ? "busy"
            : "error",
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function retrieve(
  question: string,
  notebookId: string | null | undefined,
  deps: RetrievalDeps,
  history: RagTurn[] = [],
  // 108: cấu hình bộ lọc độ liên quan; công cụ đo (tests/eval) truyền vào để quét. Mặc định = bản ghi hiệu chuẩn.
  cfg: RelevanceConfig = RELEVANCE_CALIBRATION.config,
  // 109: cấu hình bộ chấm độ liên quan; null = tắt (hành vi 108). Mặc định = bản ghi hiệu chuẩn; công cụ đo truyền vào để quét.
  rerankCfg: RerankConfig | null = RELEVANCE_CALIBRATION.rerank?.config ?? null,
): Promise<ScoredChunk[]> {
  // 1. Query rewriting — CHỈ khi CÓ hội thoại (giải đại từ/tham chiếu). Câu đầu (không history) DÙNG
  // NGUYÊN câu gốc: model local hay "phình" câu đã rõ → truy xuất tệ hơn (thực nghiệm). Chỉ đổi TRUY VẤN,
  // không đổi chunk/locator. Fallback câu gốc khi lỗi/rỗng.
  let q = question;
  if (deps.rewrite && history.length > 0) {
    try {
      const rw = (await deps.rewrite(question, history)).trim();
      if (rw !== "") q = rw;
    } catch {
      /* lỗi rewrite → dùng câu gốc (FR-004) */
    }
  }

  // 2. Hai nhánh: vector (ngữ nghĩa) + BM25 (từ khoá).
  const vector = await deps.embed(q);
  const vHits = await deps.search(vector, notebookId, HYBRID_BRANCH_TOPK);
  let kHits: { id: string; score: number }[] = [];
  if (deps.searchBm25) {
    try {
      kHits = deps.searchBm25(notebookId, q, HYBRID_BRANCH_TOPK);
    } catch {
      kHits = []; // FTS lỗi → vector-only (FR-008)
    }
  }

  // Vector chunk lấy MỘT lần (108, research R11): gate `vectorWithin` cần distance của hit BM25 TRƯỚC khi lọc ⇒ đọc
  // hợp tập hai nhánh; gate khác ⇒ chỉ đọc các đoạn đã qua lọc (đường rỗng không tốn lần đọc nào). Dùng lại cho MMR.
  let vecMap = new Map<string, number[]>();
  const distanceOf = (id: string): number | undefined => {
    const v = vecMap.get(id);
    return v ? 1 - cosine(vector, v) : undefined;
  };
  if (deps.getVectorsByIds && cfg.bm25Gate === "vectorWithin") {
    vecMap = await deps.getVectorsByIds(unionIds(vHits, kHits));
  }

  // 3. Lọc độ liên quan (108): ngưỡng vector tuyệt đối/tương đối + chặn nhánh BM25 theo cấu hình đã hiệu chuẩn.
  const kept = selectRelevant({ vHits, kHits, distanceOf }, cfg);
  const vScore = new Map(kept.vector.map((h) => [h.id, h.score]));

  // 4. Hợp nhất RRF theo rank hai nhánh.
  const fused = reciprocalRankFusion([
    kept.vector.map((h) => h.id),
    kept.keyword.map((h) => h.id),
  ]);
  if (fused.length === 0) return []; // → grounded "không tìm thấy" (013 giữ nguyên)

  // 4b. (109) Bộ chấm độ liên quan trên tập hợp nhất — lọc (+ sắp lại nếu cấu hình) TRƯỚC MMR. Fail-open khi không chấm được.
  let candidates = fused;
  let rerankScoreOf: Map<string, number> | null = null;
  const fusedChunks =
    rerankCfg && deps.rerank ? deps.getChunksByIds(fused) : null;
  if (rerankCfg && deps.rerank && fusedChunks) {
    const textOf = new Map(fusedChunks.map((c) => [c.id, c.text]));
    // N ứng viên đầu theo THỨ TỰ RRF (getChunksByIds không bảo đảm thứ tự) — cổng #14 giới hạn độ trễ.
    const passages = fused
      .slice(0, rerankCfg.maxCandidates)
      .filter((id) => textOf.has(id))
      .map((id) => ({ id, text: textOf.get(id)! }));
    // Không còn đoạn nào để chấm (bị xoá giữa chừng) ⇒ bỏ qua bước chấm, KHÔNG coi là "không tìm thấy" (fail-open).
    const scores =
      passages.length === 0
        ? null
        : await scoreWithin(deps, q, passages, rerankCfg.timeoutMs);
    if (scores) {
      const r = applyRerank(fused, scores, rerankCfg);
      if (r.ids.length === 0) return []; // không đoạn nào trả lời được ⇒ "không tìm thấy" (108)
      candidates = r.ids;
      rerankScoreOf = r.scoreOf;
    }
  }

  if (deps.getVectorsByIds && cfg.bm25Gate !== "vectorWithin") {
    vecMap = await deps.getVectorsByIds(candidates);
  }

  // 5. MMR đa dạng hoá (cần vector chunk; thiếu vector → giữ theo thứ tự ứng viên).
  const order = deps.getVectorsByIds
    ? mmrSelect(
        candidates.map((id) => ({ id, vector: vecMap.get(id) })),
        vector,
        RETRIEVAL_TOP_K,
      )
    : candidates.slice(0, RETRIEVAL_TOP_K);

  // 6. Lấy chunk (GIỮ locator) → ScoredChunk theo thứ tự MMR.
  const chunks = fusedChunks ?? deps.getChunksByIds(order);
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const scored: ScoredChunk[] = [];
  for (const id of order) {
    const chunk = byId.get(id);
    if (!chunk) continue; // chunk đã bị xoá giữa chừng → bỏ
    const rerankScore = rerankScoreOf?.get(id);
    scored.push({
      chunk,
      sourceTitle: deps.sourceTitle(chunk.sourceId),
      // hit chỉ-BM25: distance thật từ vector chunk; thiếu vector ⇒ ngưỡng cấu hình (108 C1)
      score: vScore.get(id) ?? distanceOf(id) ?? cfg.maxDistance,
      ...(rerankScore !== undefined ? { rerankScore } : {}),
    });
  }
  return scored;
}

function unionIds(
  a: readonly { id: string }[],
  b: readonly { id: string }[],
): string[] {
  return [...new Set([...a, ...b].map((h) => h.id))];
}
