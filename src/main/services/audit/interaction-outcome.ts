import { UserFacingError } from "@shared/codes/user-error";
import type {
  Citation,
  RagAnswer,
  RagAskInput,
  StudioGenerateInput,
  StudioResult,
} from "@shared/ipc/types";
import type {
  AuditCitation,
  AuditModel,
  AuditScope,
  InteractionMeta,
  InteractionOutcome,
} from "./audit-types";

// 236 — kết quả một lượt ⇒ trạng thái + trích dẫn cho interaction.end (contracts/audit-ipc.md). Thuần.
// KHÔNG mang câu trả lời / nội dung (FR-012); lỗi chỉ ghi MÃ hoặc tên lớp, không message.

/** Bản sao nguyên trích dẫn đã hậu kiểm (Constitution II) + sổ tay theo scope (C5). */
export function toAuditCitations(
  citations: Citation[],
  scope: AuditScope,
): AuditCitation[] {
  return citations.map((c) => ({
    n: c.n,
    sourceId: c.sourceId,
    sourceTitle: c.sourceTitle,
    notebookId:
      scope.kind === "notebook" ? scope.notebookId : (c.notebookId ?? ""),
    notebookName:
      scope.kind === "notebook" ? scope.notebookName : (c.notebookName ?? null),
    chunkId: c.chunkId,
    locator: c.locator,
  }));
}

export function ragOutcome(
  result: RagAnswer,
  aborted: boolean,
  scope: AuditScope,
): InteractionOutcome {
  const status = result.reindexing
    ? "reindexing"
    : result.notFound
      ? "notFound"
      : aborted
        ? "cancelled"
        : "completed";
  return { status, citations: toAuditCitations(result.citations, scope) };
}

export function studioOutcome(
  result: StudioResult,
  scope: AuditScope,
): InteractionOutcome {
  return {
    status: "completed",
    citations: toAuditCitations(result.citations, scope),
    ...(result.parts !== undefined ? { parts: result.parts } : {}),
    ...(result.truncated !== undefined ? { truncated: result.truncated } : {}),
  };
}

export function errorOutcome(e: unknown): InteractionOutcome {
  if (e instanceof UserFacingError) {
    if (e.code === "studioCancelled")
      return { status: "cancelled", citations: [] };
    return { status: "error", citations: [], errorCode: e.code };
  }
  const errorCode = e instanceof Error ? e.constructor.name : typeof e;
  return { status: "error", citations: [], errorCode };
}

/** Định danh từ renderer: giới hạn 128 ký tự trước khi ký vào nhật ký (review S4). */
const capId = (v: unknown): string => String(v ?? "").slice(0, 128);

// ── Đầu vào IPC (không tin cậy) ⇒ InteractionMeta. Câu hỏi bản RÕ chỉ đi tới AuditService để mã hoá.

export function ragMeta(
  input: RagAskInput,
  model: AuditModel,
  notebookName: (id: string) => string | null,
): InteractionMeta {
  const scope: AuditScope =
    input.scope === "all"
      ? { kind: "all" }
      : {
          kind: "notebook",
          notebookId: capId(input.notebookId),
          notebookName: notebookName(capId(input.notebookId)),
        };
  return {
    channel: "rag",
    scope,
    question: typeof input.question === "string" ? input.question : "",
    model,
  };
}

export function studioMeta(
  input: StudioGenerateInput,
  model: AuditModel,
  notebookName: (id: string) => string | null,
): InteractionMeta {
  const notebookId = capId(input.notebookId);
  const ids = Array.isArray(input.sourceIds)
    ? input.sourceIds
        .filter((s): s is string => typeof s === "string")
        .slice(0, 50)
    : typeof input.sourceId === "string"
      ? [input.sourceId]
      : [];
  return {
    channel: "studio",
    scope: {
      kind: "notebook",
      notebookId,
      notebookName: notebookName(notebookId),
    },
    ...(input.kind === "custom" && typeof input.customPrompt === "string"
      ? { question: input.customPrompt }
      : {}),
    model,
    studioKind: input.kind,
    sourceScope: ids.length > 0 ? { sourceIds: ids } : { all: true },
  };
}
