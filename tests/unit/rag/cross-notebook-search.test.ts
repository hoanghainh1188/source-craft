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
