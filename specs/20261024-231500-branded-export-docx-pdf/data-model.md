# Data Model: branded-export-docx-pdf

## 1. Kiểu Dữ Liệu IPC Mở Rộng
```typescript
export type ExportFormat = "md" | "docx" | "pdf";

export interface BrandedExportOptions {
  title?: string;
  subtitle?: string;
  author?: string;
  organization?: string;
  includeCoverPage?: boolean;
  includeTableOfContents?: boolean;
  headerText?: string;
  footerText?: string;
}

export interface StudioExportInput {
  content: string;
  suggestedName: string;
  format?: ExportFormat;
  options?: BrandedExportOptions;
}

export interface StudioExportResult {
  saved: boolean;
  path?: string;
}
```

## 2. Bản Quyền & Feature Flag
```typescript
export type LicenseFeature =
  | "multimedia"
  | "studioPro"
  | "meetingLong"
  | "lanAi"
  | "sharedNotebooks"
  | "itPolicy"
  | "crossNotebookSearch"
  | "brandedExport";
```
