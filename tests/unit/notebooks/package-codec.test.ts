import { describe, expect, it } from "vitest";
import {
  decodeNotebookPackage,
  encodeNotebookPackage,
} from "../../../src/main/services/notebooks/package/package-codec";
import type { NotebookPackageData } from "@shared/ipc/types";

describe("package-codec (.scnb Gzip + SHA-256)", () => {
  const sampleData: NotebookPackageData = {
    manifest: {
      schemaVersion: 1,
      id: "nb-123",
      name: "Sổ tay Nghiên cứu AI",
      color: "#2563eb",
      createdAt: 1729000000000,
      exportedAt: 1729100000000,
      sourceCount: 1,
      chunkCount: 2,
      checksum: "",
    },
    sources: [
      {
        id: "src-1",
        title: "Tài liệu kỹ thuật.pdf",
        kind: "pdf",
        charCount: 1200,
        tokenCount: 300,
      },
    ],
    chunks: [
      {
        id: "chk-1",
        sourceId: "src-1",
        text: "Đoạn trích giới thiệu về mô hình ngôn ngữ lớn.",
        charStart: 0,
        charEnd: 46,
      },
      {
        id: "chk-2",
        sourceId: "src-1",
        text: "Kiến trúc RAG kết hợp tìm kiếm ngữ nghĩa.",
        charStart: 47,
        charEnd: 88,
      },
    ],
    vectors: [
      { chunkId: "chk-1", vector: [0.1, 0.2, 0.3] },
      { chunkId: "chk-2", vector: [0.4, 0.5, 0.6] },
    ],
  };

  it("encodes package to compressed Uint8Array and decodes back with SHA-256 verification", () => {
    const encoded = encodeNotebookPackage(sampleData);
    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.byteLength).toBeGreaterThan(0);

    const decoded = decodeNotebookPackage(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok && decoded.data) {
      expect(decoded.data.manifest.name).toBe("Sổ tay Nghiên cứu AI");
      expect(decoded.data.sources).toHaveLength(1);
      expect(decoded.data.chunks).toHaveLength(2);
      expect(decoded.data.vectors).toHaveLength(2);
      expect(decoded.data.manifest.checksum).toHaveLength(64); // SHA-256 hex
    }
  });

  it("fails when binary data is corrupted or not a valid gzip stream", () => {
    const corrupted = new Uint8Array([1, 2, 3, 4, 5]);
    const res = decodeNotebookPackage(corrupted);
    expect(res.ok).toBe(false);
  });
});
