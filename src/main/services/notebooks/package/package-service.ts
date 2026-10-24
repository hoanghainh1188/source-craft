import { UserFacingError } from "@shared/codes/user-error";
import type {
  ExportPackageResult,
  ImportPackageResult,
  Notebook,
  NotebookPackageData,
  PackageChunkRecord,
  PackageSourceRecord,
  PackageVectorRecord,
  Source,
  SourceKind,
} from "@shared/ipc/types";
import { decodeNotebookPackage, encodeNotebookPackage } from "./package-codec";

// 229 — PackageService: orchestrates exporting and importing .scnb packages.
// Connects SQLite metadata and LanceDB pre-computed vectors.

export interface PackageServiceDeps {
  getNotebook: (id: string) => Notebook | null;
  listSources: (notebookId: string) => Source[];
  listChunks: (sourceId: string) => {
    id: string;
    sourceId: string;
    text: string;
    charStart?: number;
    charEnd?: number;
  }[];
  getVectorsByChunkIds: (
    chunkIds: string[],
  ) => Promise<{ chunkId: string; vector: number[] }[]>;
  showSaveDialog: (defaultFilename: string) => Promise<string | null>;
  writeFileBytes: (filePath: string, bytes: Uint8Array) => Promise<void>;
  showOpenDialog: () => Promise<string | null>;
  readFileBytes: (filePath: string) => Promise<Uint8Array>;
  createNotebook: (input: { name: string; color: string }) => Notebook;
  insertSource: (source: {
    notebookId: string;
    title: string;
    kind: SourceKind;
    origin: string;
    contentHash: string;
  }) => { id: string };
  markSourceReady?: (id: string) => void;
  insertChunks: (
    sourceId: string,
    chunks: {
      ordinal: number;
      text: string;
      locator: {
        page: number | null;
        charStart: number;
        charEnd: number;
      };
    }[],
  ) => string[];
  writeVectors: (
    records: {
      id: string;
      vector: number[];
      notebookId: string;
      sourceId: string;
      dim: number;
    }[],
  ) => Promise<void>;
}

export interface PackageService {
  exportPackage(notebookId: string): Promise<ExportPackageResult>;
  importPackage(opts?: { readOnly?: boolean }): Promise<ImportPackageResult>;
}

export function createPackageService(deps: PackageServiceDeps): PackageService {
  const {
    getNotebook,
    listSources,
    listChunks,
    getVectorsByChunkIds,
    showSaveDialog,
    writeFileBytes,
    showOpenDialog,
    readFileBytes,
    createNotebook,
    insertSource,
    insertChunks,
    writeVectors,
  } = deps;

  return {
    async exportPackage(notebookId: string): Promise<ExportPackageResult> {
      const notebook = getNotebook(notebookId);
      if (!notebook) {
        throw new UserFacingError("notebookNotFound");
      }

      const sources = listSources(notebookId);
      const allChunks: PackageChunkRecord[] = [];
      const packageSources: PackageSourceRecord[] = sources.map((s) => ({
        id: s.id,
        title: s.title,
        kind: s.kind,
      }));

      for (const src of sources) {
        const chunks = listChunks(src.id);
        for (const c of chunks) {
          allChunks.push({
            id: c.id,
            sourceId: src.id,
            text: c.text,
            charStart: c.charStart,
            charEnd: c.charEnd,
          });
        }
      }

      const chunkIds = allChunks.map((c) => c.id);
      const vectorRecords = await getVectorsByChunkIds(chunkIds);
      const packageVectors: PackageVectorRecord[] = vectorRecords.map((v) => ({
        chunkId: v.chunkId,
        vector: v.vector,
      }));

      const packageData: NotebookPackageData = {
        manifest: {
          schemaVersion: 1,
          id: notebook.id,
          name: notebook.name,
          color: notebook.color,
          createdAt: notebook.createdAt,
          exportedAt: Date.now(),
          sourceCount: packageSources.length,
          chunkCount: allChunks.length,
          checksum: "",
        },
        sources: packageSources,
        chunks: allChunks,
        vectors: packageVectors,
      };

      const compressedBytes = encodeNotebookPackage(packageData);
      const defaultFilename = `${notebook.name.replace(/[/\\?%*:|"<>]/g, "_")}.scnb`;
      const targetPath = await showSaveDialog(defaultFilename);
      if (!targetPath) {
        return { ok: false, cancelled: true };
      }

      await writeFileBytes(targetPath, compressedBytes);
      return { ok: true, filePath: targetPath };
    },

    async importPackage(opts?: {
      readOnly?: boolean;
    }): Promise<ImportPackageResult> {
      const sourcePath = await showOpenDialog();
      if (!sourcePath) {
        return { ok: false, cancelled: true };
      }

      const bytes = await readFileBytes(sourcePath);
      const decoded = decodeNotebookPackage(bytes);
      if (!decoded.ok || !decoded.data) {
        throw new UserFacingError("packageCorrupted");
      }

      const { manifest, sources, chunks, vectors } = decoded.data;
      const newNotebook = createNotebook({
        name: `${manifest.name} (Imported)`,
        color: manifest.color || "#2563eb",
      });

      if (opts?.readOnly) {
        newNotebook.readOnly = true;
      }

      // Map old source IDs to new source IDs
      const sourceIdMap = new Map<string, string>();
      for (const s of sources) {
        const created = insertSource({
          notebookId: newNotebook.id,
          title: s.title,
          kind: s.kind,
          origin: s.title,
          contentHash: s.id,
        });
        sourceIdMap.set(s.id, created.id);
        deps.markSourceReady?.(created.id);
      }

      // Map chunks & vectors
      const vectorEntriesToWrite: {
        id: string;
        vector: number[];
        notebookId: string;
        sourceId: string;
        dim: number;
      }[] = [];
      const vectorMap = new Map<string, number[]>(
        vectors.map((v) => [v.chunkId, v.vector]),
      );

      for (const [oldSrcId, newSrcId] of sourceIdMap.entries()) {
        const srcChunks = chunks.filter((c) => c.sourceId === oldSrcId);
        const mappedDrafts = srcChunks.map((c, idx) => ({
          ordinal: idx,
          text: c.text,
          locator: {
            page: null,
            charStart: c.charStart ?? 0,
            charEnd: c.charEnd ?? c.text.length,
          },
        }));
        const newChunkIds = insertChunks(newSrcId, mappedDrafts);

        for (let i = 0; i < srcChunks.length; i++) {
          const oldChunk = srcChunks[i];
          const newChunkId = newChunkIds[i];
          if (!oldChunk || !newChunkId) continue;
          const vec = vectorMap.get(oldChunk.id);
          if (vec) {
            vectorEntriesToWrite.push({
              id: newChunkId,
              vector: vec,
              notebookId: newNotebook.id,
              sourceId: newSrcId,
              dim: vec.length,
            });
          }
        }
      }

      if (vectorEntriesToWrite.length > 0) {
        await writeVectors(vectorEntriesToWrite);
      }

      return { ok: true, notebook: newNotebook };
    },
  };
}
