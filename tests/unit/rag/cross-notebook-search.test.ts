import { describe, expect, it } from "vitest";
import { UserFacingError } from "@shared/codes/user-error";
import type { Citation, RagAskInput } from "@shared/ipc/types";
import { formatCitationLabel } from "../../../src/renderer/features/rag-qa/citation-format";
import { createRagService } from "../../../src/main/services/rag/rag-service";
import { createFeatureGate } from "../../../src/main/services/license/feature-gate";

describe("Cross-Notebook Search & RAG (231)", () => {
  const sampleCitation: Citation = {
    n: 1,
    chunkId: "chk-1",
    sourceId: "src-1",
    sourceTitle: "HopDongKinhTe.pdf",
    locator: { page: 3, charStart: 0, charEnd: 120 },
    notebookId: "nb-phap-ly",
    notebookName: "Sổ tay Pháp lý 2024",
  };

  it("formatCitationLabel prepends notebookName if present", () => {
    const formattedWithNb = formatCitationLabel(sampleCitation);
    expect(formattedWithNb).toContain(
      "Sổ tay Pháp lý 2024 › HopDongKinhTe.pdf",
    );

    const formattedWithoutNb = formatCitationLabel({
      ...sampleCitation,
      notebookName: undefined,
    });
    expect(formattedWithoutNb).toBe("[1] HopDongKinhTe.pdf · trang 3");
  });

  it("calls retrieve with notebookId = null when scope is 'all'", async () => {
    let capturedNotebookId: string | null | undefined = "init";
    const ragService = createRagService({
      embed: async () => [0.1, 0.2, 0.3],
      search: async (_vec, nbId) => {
        capturedNotebookId = nbId;
        return [
          {
            id: "chk-1",
            sourceId: "src-1",
            score: 0.1,
          },
        ];
      },
      searchBm25: (nbId) => {
        capturedNotebookId = nbId;
        return [{ id: "chk-1", score: -5.0 }];
      },
      getChunksByIds: () => [
        {
          id: "chk-1",
          sourceId: "src-1",
          ordinal: 0,
          text: "Trích đoạn về điều khoản tranh chấp hợp đồng kinh tế.",
          locator: { page: 3, charStart: 0, charEnd: 120 },
        },
      ],
      sourceTitle: () => "HopDongKinhTe.pdf",
      sourceNotebook: (_sid) => ({
        notebookId: "nb-phap-ly",
        notebookName: "Sổ tay Pháp lý",
      }),
      chat: async () =>
        "Căn cứ hợp đồng [1], tranh chấp được giải quyết tại trọng tài.",
      chatStream: async () =>
        "Căn cứ hợp đồng [1], tranh chấp được giải quyết tại trọng tài.",
    });

    const input: RagAskInput = {
      notebookId: "nb-current",
      question: "Tranh chấp hợp đồng giải quyết ở đâu?",
      mode: "grounded",
      history: [],
      scope: "all",
    };

    const res = await ragService.ask(input);
    expect(capturedNotebookId).toBeNull();
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].notebookName).toBe("Sổ tay Pháp lý");
    expect(res.citations[0].notebookId).toBe("nb-phap-ly");
  });

  it("enforces license gate: rejects crossNotebookSearch on Free tier", () => {
    const freeGate = createFeatureGate(() => ({
      tier: "free",
      maxNotebooks: 3,
      maxSourcesPerNotebook: 10,
      maxMeetingSeconds: 900,
      allowedSourceKinds: ["pdf", "docx", "txt", "md", "url"],
      allowedStudioKinds: ["summary", "keyPoints"],
      features: [],
    }));
    expect(freeGate.hasFeature("crossNotebookSearch")).toBe(false);

    // Verify error code throwing
    const checkAccess = (scope: string) => {
      if (scope === "all" && !freeGate.hasFeature("crossNotebookSearch")) {
        throw new UserFacingError("licenseRequireProCrossSearch");
      }
    };

    expect(() => checkAccess("current")).not.toThrow();
    expect(() => checkAccess("all")).toThrowError(
      "licenseRequireProCrossSearch",
    );
  });
});

// Deps tối thiểu: 1 chunk của nguồn src-1 thuộc sổ tay nb-phap-ly; ghi lại notebookId mà guard reindex nhận.
function makeScopeDeps(opts: {
  reindexing?: (notebookId: string | null) => Promise<boolean>;
  onEmbed?: () => void;
}) {
  return {
    embed: async () => {
      opts.onEmbed?.();
      return [0.1, 0.2, 0.3];
    },
    search: async () => [{ id: "chk-1", sourceId: "src-1", score: 0.1 }],
    getChunksByIds: () => [
      {
        id: "chk-1",
        sourceId: "src-1",
        ordinal: 0,
        text: "Trích đoạn về điều khoản tranh chấp hợp đồng kinh tế.",
        locator: { page: 3, charStart: 0, charEnd: 120 },
      },
    ],
    sourceTitle: () => "HopDongKinhTe.pdf",
    sourceNotebook: () => ({
      notebookId: "nb-phap-ly",
      notebookName: "Sổ tay Pháp lý",
    }),
    chat: async () => "Tranh chấp giải quyết tại trọng tài [1].",
    chatStream: async () => "Tranh chấp giải quyết tại trọng tài [1].",
    ...(opts.reindexing ? { reindexing: opts.reindexing } : {}),
  };
}

function askInput(scope?: "current" | "all"): RagAskInput {
  return {
    notebookId: "nb-current",
    question: "Tranh chấp hợp đồng giải quyết ở đâu?",
    mode: "grounded",
    history: [],
    ...(scope ? { scope } : {}),
  };
}

describe("231 — tên sổ tay chỉ gắn vào trích dẫn khi tìm toàn cục", () => {
  it("scope 'current' → trích dẫn KHÔNG mang notebookName/notebookId (nhãn giữ như cũ)", async () => {
    const svc = createRagService(makeScopeDeps({}));
    const res = await svc.ask(askInput("current"));
    expect(res.citations).toHaveLength(1);
    expect(res.citations[0].notebookName).toBeUndefined();
    expect(res.citations[0].notebookId).toBeUndefined();
    expect(formatCitationLabel(res.citations[0])).toBe(
      "[1] HopDongKinhTe.pdf · trang 3",
    );
  });

  it("không truyền scope (client cũ) → hành vi như 'current'", async () => {
    const svc = createRagService(makeScopeDeps({}));
    const res = await svc.ask(askInput());
    expect(res.citations[0].notebookName).toBeUndefined();
  });

  it("scope 'all' → trích dẫn mang notebookName để phân biệt nguồn giữa các sổ tay", async () => {
    const svc = createRagService(makeScopeDeps({}));
    const res = await svc.ask(askInput("all"));
    expect(res.citations[0].notebookName).toBe("Sổ tay Pháp lý");
    expect(formatCitationLabel(res.citations[0])).toBe(
      "[1] Sổ tay Pháp lý › HopDongKinhTe.pdf · trang 3",
    );
  });
});

describe("231 — guard tái lập chỉ mục (059) vẫn áp dụng khi tìm toàn cục", () => {
  it("scope 'all' + kho còn sổ tay chưa nhúng xong → báo đang tái lập, KHÔNG truy xuất", async () => {
    const seen: (string | null)[] = [];
    let embedCalled = false;
    const svc = createRagService(
      makeScopeDeps({
        reindexing: async (nb) => {
          seen.push(nb);
          return nb === null;
        },
        onEmbed: () => {
          embedCalled = true;
        },
      }),
    );
    const res = await svc.ask(askInput("all"));
    expect(seen).toEqual([null]); // null = hỏi trạng thái toàn kho
    expect(res.reindexing).toBe(true);
    expect(res.citations).toEqual([]);
    expect(embedCalled).toBe(false);
  });

  it("scope 'all' + toàn kho đã nhúng xong → trả lời bình thường", async () => {
    const svc = createRagService(
      makeScopeDeps({ reindexing: async () => false }),
    );
    const res = await svc.ask(askInput("all"));
    expect(res.reindexing).toBeUndefined();
    expect(res.citations).toHaveLength(1);
  });

  it("scope 'current' vẫn hỏi guard theo đúng notebookId đang mở", async () => {
    const seen: (string | null)[] = [];
    const svc = createRagService(
      makeScopeDeps({
        reindexing: async (nb) => {
          seen.push(nb);
          return false;
        },
      }),
    );
    await svc.ask(askInput("current"));
    expect(seen).toEqual(["nb-current"]);
  });
});
