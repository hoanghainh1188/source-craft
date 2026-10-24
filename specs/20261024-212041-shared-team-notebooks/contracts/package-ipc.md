# Contracts: Shared Team Notebooks IPC

## 1. IPC Channels (`src/shared/ipc/channels.ts`)

```ts
export const CHANNELS = {
  // Existing ...
  notebookExportPackage: "notebook:exportPackage",
  notebookImportPackage: "notebook:importPackage",
};
```

## 2. Types & Results (`src/shared/ipc/types.ts`)

```ts
export interface ExportPackageResult {
  ok: boolean;
  filePath?: string;
  cancelled?: boolean;
}

export interface ImportPackageResult {
  ok: boolean;
  notebook?: Notebook;
  cancelled?: boolean;
}

export interface RendererApi {
  // Existing ...
  exportNotebookPackage(notebookId: string): Promise<ExportPackageResult>;
  importNotebookPackage(opts?: { readOnly?: boolean }): Promise<ImportPackageResult>;
}
```

## 3. User Error Codes (`src/shared/codes/user-error.ts`)

- `licenseRequireProSharedNotebooks`: Tính năng chia sẻ và đóng gói Sổ tay tri thức (.scnb) yêu cầu bản quyền Pro hoặc Enterprise.
- `packageCorrupted`: Tệp gói sổ tay tri thức (.scnb) bị lỗi hoặc không khớp mã kiểm tra SHA-256.
- `notebookReadOnly`: Sổ tay tri thức này ở chế độ dùng chung (Chỉ đọc). Không thể sửa đổi nội dung.
