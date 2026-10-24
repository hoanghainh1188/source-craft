# Data Model: Shared Team Notebooks (`shared-team-notebooks`)

## 1. Package Schema (`.scnb`)

```ts
export interface NotebookPackageManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  exportedAt: string;
  sourceCount: number;
  chunkCount: number;
  checksum: string; // SHA-256
}

export interface PackageSourceRecord {
  id: string;
  title: string;
  kind: SourceKind;
  charCount: number;
  tokenCount: number;
}

export interface PackageChunkRecord {
  id: string;
  sourceId: string;
  text: string;
  charStart: number;
  charEnd: number;
  pageNumber?: number;
}

export interface PackageVectorRecord {
  chunkId: string;
  vector: number[]; // 384-dimensional float array
}

export interface NotebookPackageData {
  manifest: NotebookPackageManifest;
  sources: PackageSourceRecord[];
  chunks: PackageChunkRecord[];
  vectors: PackageVectorRecord[];
}
```

## 2. Notebook Entity Extension

```ts
export interface Notebook {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** When true, modifications (adding/removing sources) are prohibited. */
  readOnly?: boolean;
}
```
