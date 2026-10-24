import { describe, expect, it } from "vitest";
import { createPackageService } from "../../../src/main/services/notebooks/package/package-service";
import type { Notebook, Source } from "@shared/ipc/types";

describe("PackageService (Export & Import Orchestration)", () => {
  const mockNotebook: Notebook = {
    id: "nb-1",
    name: "Sổ tay Mẫu",
    color: "#2563eb",
    createdAt: 1729000000000,
    updatedAt: 1729000000000,
    sourceCount: 1,
  };

  const mockSource: Source = {
    id: "src-1",
    notebookId: "nb-1",
    kind: "pdf",
    title: "HuongDan.pdf",
    status: "ready",
    errorCode: null,
    pageCount: 5,
    createdAt: 1729000000000,
    updatedAt: 1729000000000,
    extractionVersion: 1,
  };

  it("exports notebook to .scnb file through native dialog and returns filePath", async () => {
    let savedBytes: Uint8Array | null = null;
    const service = createPackageService({
      getNotebook: () => mockNotebook,
      listSources: () => [mockSource],
      listChunks: () => [
        {
          id: "chk-1",
          sourceId: "src-1",
          text: "Nội dung trích đoạn thử nghiệm.",
        },
      ],
      getVectorsByChunkIds: async () => [
        { chunkId: "chk-1", vector: [0.1, 0.2, 0.3] },
      ],
      showSaveDialog: async () => "/tmp/exported.scnb",
      writeFileBytes: async (_path, bytes) => {
        savedBytes = bytes;
      },
      showOpenDialog: async () => null,
      readFileBytes: async () => new Uint8Array(),
      createNotebook: () => mockNotebook,
      insertSource: () => ({ id: "src-created" }),
      insertChunks: () => ["chk-created"],
      writeVectors: async () => {},
    });

    const res = await service.exportPackage("nb-1");
    expect(res.ok).toBe(true);
    expect(res.filePath).toBe("/tmp/exported.scnb");
    expect(savedBytes).not.toBeNull();
  });

  it("imports .scnb package and restores notebook, sources, chunks, and pre-computed vectors", async () => {
    let createdNotebookName = "";
    let insertedVectorsCount = 0;

    // First generate a valid package in memory
    let packageBytes: Uint8Array = new Uint8Array();
    const exporter = createPackageService({
      getNotebook: () => mockNotebook,
      listSources: () => [mockSource],
      listChunks: () => [
        {
          id: "chk-1",
          sourceId: "src-1",
          text: "Nội dung trích đoạn.",
        },
      ],
      getVectorsByChunkIds: async () => [
        { chunkId: "chk-1", vector: [0.5, 0.6, 0.7] },
      ],
      showSaveDialog: async () => "/tmp/test.scnb",
      writeFileBytes: async (_p, b) => {
        packageBytes = b;
      },
      showOpenDialog: async () => null,
      readFileBytes: async () => new Uint8Array(),
      createNotebook: () => mockNotebook,
      insertSource: () => ({ id: "src-created" }),
      insertChunks: () => ["chk-created"],
      writeVectors: async () => {},
    });
    await exporter.exportPackage("nb-1");

    // Now import that package
    const importer = createPackageService({
      getNotebook: () => null,
      listSources: () => [],
      listChunks: () => [],
      getVectorsByChunkIds: async () => [],
      showSaveDialog: async () => null,
      writeFileBytes: async () => {},
      showOpenDialog: async () => "/tmp/test.scnb",
      readFileBytes: async () => packageBytes,
      createNotebook: (input) => {
        createdNotebookName = input.name;
        return {
          id: "nb-imported",
          name: input.name,
          color: input.color,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sourceCount: 1,
        };
      },
      insertSource: () => ({ id: "src-imported" }),
      insertChunks: () => ["chk-imported"],
      writeVectors: async (vecs) => {
        insertedVectorsCount = vecs.length;
      },
    });

    const res = await importer.importPackage();
    expect(res.ok).toBe(true);
    expect(createdNotebookName).toBe("Sổ tay Mẫu (Imported)");
    expect(insertedVectorsCount).toBe(1);
  });

  it("throws UserFacingError if imported package file is corrupted", async () => {
    const importer = createPackageService({
      getNotebook: () => null,
      listSources: () => [],
      listChunks: () => [],
      getVectorsByChunkIds: async () => [],
      showSaveDialog: async () => null,
      writeFileBytes: async () => {},
      showOpenDialog: async () => "/tmp/invalid.scnb",
      readFileBytes: async () => new Uint8Array([1, 2, 3, 4]),
      createNotebook: () => mockNotebook,
      insertSource: () => ({ id: "src" }),
      insertChunks: () => [],
      writeVectors: async () => {},
    });

    await expect(importer.importPackage()).rejects.toThrow("packageCorrupted");
  });
});
