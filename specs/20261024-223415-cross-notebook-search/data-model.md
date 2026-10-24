# Mô hình Dữ liệu: Tìm kiếm Toàn cục Đa Sổ tay (`cross-notebook-search`)

## 1. Mở rộng Kiểu Dữ liệu IPC

### 1.1. Phạm vi Tìm kiếm RAG (`RagSearchScope`)
```typescript
export type RagSearchScope = "current" | "all";
```

### 1.2. Mở rộng `RagAskInput` & `RagAskStreamInput`
```typescript
export interface RagAskInput {
  notebookId: string;
  question: string;
  mode: RagMode;
  history: RagTurn[];
  target?: AiTarget;
  scope?: RagSearchScope; // Mặc định 'current'. Nếu 'all': yêu cầu bản quyền Pro/Enterprise.
}

export interface RagAskStreamInput extends RagAskInput {
  streamId: string;
}
```

### 1.3. Mở rộng `Citation`
```typescript
export interface Citation {
  n: number;
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  locator: Locator;
  notebookId?: string;
  notebookName?: string; // Tên sổ tay chứa đoạn trích (hiển thị khi tìm kiếm đa sổ tay)
}
```

### 1.4. Cập nhật `LicenseFeature` trong Feature Gate
```typescript
export type LicenseFeature =
  | "multimedia"
  | "studioPro"
  | "meetingLong"
  | "lanAi"
  | "sharedNotebooks"
  | "itPolicy"
  | "crossNotebookSearch";
```
