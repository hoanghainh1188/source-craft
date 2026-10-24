import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import type { NotebookPackageData } from "@shared/ipc/types";

// 229 — Gzip serialization and SHA-256 integrity validation for .scnb packages.
// Zero third-party dependencies (Constitution Principle I & V).

export interface DecodeResult {
  ok: boolean;
  data?: NotebookPackageData;
  error?: "invalidGzip" | "invalidJson" | "checksumMismatch" | "invalidSchema";
}

export function encodeNotebookPackage(data: NotebookPackageData): Uint8Array {
  // Compute checksum over the payload without the checksum field
  const payloadToHash = {
    ...data,
    manifest: {
      ...data.manifest,
      checksum: "",
    },
  };
  const jsonString = JSON.stringify(payloadToHash);
  const checksum = createHash("sha256")
    .update(jsonString, "utf8")
    .digest("hex");

  const fullData: NotebookPackageData = {
    ...data,
    manifest: {
      ...data.manifest,
      checksum,
    },
  };

  const finalJson = JSON.stringify(fullData);
  const compressed = gzipSync(Buffer.from(finalJson, "utf8"), { level: 9 });
  return new Uint8Array(compressed);
}

export function decodeNotebookPackage(
  compressedBytes: Uint8Array,
): DecodeResult {
  let uncompressed: Buffer;
  try {
    uncompressed = gunzipSync(Buffer.from(compressedBytes));
  } catch {
    return { ok: false, error: "invalidGzip" };
  }

  let fullData: NotebookPackageData;
  try {
    fullData = JSON.parse(uncompressed.toString("utf8")) as NotebookPackageData;
  } catch {
    return { ok: false, error: "invalidJson" };
  }

  if (
    !fullData ||
    typeof fullData !== "object" ||
    !fullData.manifest ||
    fullData.manifest.schemaVersion !== 1 ||
    !Array.isArray(fullData.sources) ||
    !Array.isArray(fullData.chunks) ||
    !Array.isArray(fullData.vectors)
  ) {
    return { ok: false, error: "invalidSchema" };
  }

  const storedChecksum = fullData.manifest.checksum;
  const payloadToVerify = {
    ...fullData,
    manifest: {
      ...fullData.manifest,
      checksum: "",
    },
  };
  const jsonToVerify = JSON.stringify(payloadToVerify);
  const calculatedChecksum = createHash("sha256")
    .update(jsonToVerify, "utf8")
    .digest("hex");

  if (storedChecksum !== calculatedChecksum) {
    return { ok: false, error: "checksumMismatch" };
  }

  return { ok: true, data: fullData };
}
