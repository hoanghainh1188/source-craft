import { describe, expect, it } from "vitest";
import { UserFacingError } from "@shared/codes/user-error";
import type { Citation, RagAnswer, StudioResult } from "@shared/ipc/types";
import {
  errorOutcome,
  ragMeta,
  ragOutcome,
  studioMeta,
  studioOutcome,
  toAuditCitations,
} from "../../../src/main/services/audit/interaction-outcome";
import type { AuditScope } from "../../../src/main/services/audit/audit-types";

// T013 (236) — ánh xạ kết quả lượt ⇒ trạng thái + trích dẫn (contracts/audit-ipc.md; C5).

const cite = (n: number, extra: Partial<Citation> = {}): Citation => ({
  n,
  chunkId: `ch_${n}`,
  sourceId: `src_${n}`,
  sourceTitle: `HĐ ${n}.pdf`,
  locator: { page: n, charStart: 1, charEnd: 9 },
  ...extra,
});
const nbScope: AuditScope = {
  kind: "notebook",
  notebookId: "nb_7",
  notebookName: "Hợp đồng 2026",
};
const answer = (o: Partial<RagAnswer> = {}): RagAnswer => ({
  answer: "SECRET ANSWER",
  citations: [cite(1)],
  notFound: false,
  modeUsed: "grounded",
  ...o,
});

describe("toAuditCitations", () => {
  it("scope sổ tay ⇒ notebook của lượt; giữ nguyên chunkId/locator/sourceTitle", () => {
    expect(toAuditCitations([cite(1)], nbScope)).toEqual([
      {
        n: 1,
        sourceId: "src_1",
        sourceTitle: "HĐ 1.pdf",
        notebookId: "nb_7",
        notebookName: "Hợp đồng 2026",
        chunkId: "ch_1",
        locator: { page: 1, charStart: 1, charEnd: 9 },
      },
    ]);
  });
  it("scope toàn cục ⇒ notebook của từng trích dẫn (231)", () => {
    const [c] = toAuditCitations(
      [cite(2, { notebookId: "nb_9", notebookName: "Y tế" })],
      { kind: "all" },
    );
    expect(c).toMatchObject({ notebookId: "nb_9", notebookName: "Y tế" });
    const [d] = toAuditCitations([cite(3)], { kind: "all" });
    expect(d).toMatchObject({ notebookId: "", notebookName: null });
  });
});

describe("ragOutcome", () => {
  it.each([
    [
      "reindexing",
      answer({ reindexing: true, citations: [] }),
      false,
      "reindexing",
    ],
    ["notFound", answer({ notFound: true, citations: [] }), false, "notFound"],
    ["aborted", answer(), true, "cancelled"],
    ["completed", answer(), false, "completed"],
  ])("%s", (_n, r, aborted, status) => {
    expect(ragOutcome(r, aborted, nbScope).status).toBe(status);
  });
  it("không mang theo câu trả lời (FR-012)", () => {
    expect(JSON.stringify(ragOutcome(answer(), false, nbScope))).not.toContain(
      "SECRET ANSWER",
    );
  });
});

describe("studioOutcome", () => {
  it("completed + citations + parts/truncated", () => {
    const r: StudioResult = {
      id: "s1",
      notebookId: "nb_7",
      kind: "summary",
      content: "SECRET",
      citations: [cite(1)],
      createdAt: 1,
      parts: 3,
      truncated: true,
    };
    const o = studioOutcome(r, nbScope);
    expect(o).toMatchObject({ status: "completed", parts: 3, truncated: true });
    expect(o.citations).toHaveLength(1);
    expect(JSON.stringify(o)).not.toContain("SECRET");
  });
});

describe("errorOutcome", () => {
  it("studioCancelled ⇒ cancelled", () => {
    expect(errorOutcome(new UserFacingError("studioCancelled")).status).toBe(
      "cancelled",
    );
  });
  it("UserFacingError khác ⇒ error + mã", () => {
    expect(errorOutcome(new UserFacingError("questionTooLong"))).toEqual({
      status: "error",
      citations: [],
      errorCode: "questionTooLong",
    });
  });
  it("lỗi thường ⇒ tên lớp, KHÔNG message", () => {
    class OnlineProviderError extends Error {}
    const o = errorOutcome(
      new OnlineProviderError("key sk-123 leaked in message"),
    );
    expect(o.errorCode).toBe("OnlineProviderError");
    expect(JSON.stringify(o)).not.toContain("sk-123");
    expect(errorOutcome("str").errorCode).toBe("string");
  });
});

describe("ragMeta / studioMeta", () => {
  const model = {
    category: "local" as const,
    providerId: "ollama",
    model: "m",
  };
  const nb = (id: string) => (id === "nb_7" ? "Hợp đồng 2026" : null);

  it("ragMeta scope sổ tay ⇒ tên sổ tay tra từ DB; scope all ⇒ kind all", () => {
    expect(
      ragMeta(
        { notebookId: "nb_7", question: "q?", mode: "grounded", history: [] },
        model,
        nb,
      ),
    ).toEqual({
      channel: "rag",
      scope: {
        kind: "notebook",
        notebookId: "nb_7",
        notebookName: "Hợp đồng 2026",
      },
      question: "q?",
      model,
    });
    expect(
      ragMeta(
        {
          notebookId: "nb_7",
          question: "q?",
          mode: "grounded",
          history: [],
          scope: "all",
        },
        model,
        nb,
      ).scope,
    ).toEqual({ kind: "all" });
  });

  it("studioMeta: custom ⇒ question = customPrompt; loại khác ⇒ không có question; phạm vi nguồn", () => {
    const custom = studioMeta(
      {
        notebookId: "nb_7",
        kind: "custom",
        customPrompt: "Rủi ro?",
        sourceIds: ["a", "b"],
      },
      model,
      nb,
    );
    expect(custom).toMatchObject({
      channel: "studio",
      question: "Rủi ro?",
      studioKind: "custom",
      sourceScope: { sourceIds: ["a", "b"] },
    });
    const summary = studioMeta(
      { notebookId: "nb_7", kind: "summary", customPrompt: "x" },
      model,
      nb,
    );
    expect(summary.question).toBeUndefined();
    expect(summary.sourceScope).toEqual({ all: true });
    expect(
      studioMeta({ notebookId: "nb_7", kind: "faq", sourceId: "s1" }, model, nb)
        .sourceScope,
    ).toEqual({
      sourceIds: ["s1"],
    });
  });
});
