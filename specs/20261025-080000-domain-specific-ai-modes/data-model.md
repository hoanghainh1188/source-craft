# Data Model: domain-specific-ai-modes

## 1. Domain Mode Type
```typescript
export type DomainMode = "general" | "legal" | "medical";
```

## 2. IPC Request Extensions
```typescript
export interface RagAskInput {
  notebookId: string;
  question: string;
  mode: RagMode;
  history: ChatHistoryTurn[];
  scope?: RagSearchScope;
  domainMode?: DomainMode;
}

export interface StudioGenerateInput {
  notebookId: string;
  kind: StudioKind;
  sourceIds?: string[];
  customPrompt?: string;
  domainMode?: DomainMode;
}
```

## 3. License Feature Flag
```typescript
export type LicenseFeature =
  | "multimedia"
  | "studioPro"
  | "meetingLong"
  | "lanAi"
  | "sharedNotebooks"
  | "itPolicy"
  | "crossNotebookSearch"
  | "brandedExport"
  | "specialistAiModes";
```
