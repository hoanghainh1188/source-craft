# Data Model: document-diff-redline

## 1. Mở rộng `StudioKind`

```typescript
export type StudioKind =
  | "summary"
  | "keyPoints"
  | "faq"
  | "outline"
  | "studyGuide"
  | "briefing"
  | "timeline"
  | "keyTerms"
  | "custom"
  | "documentDiff"; // 233: So sánh tài liệu & hợp đồng
```

## 2. Bổ sung mã lỗi người dùng (`UserErrorCode`)

```typescript
export type UserErrorCode =
  | ...
  | "studioDiffNeedTwoSources";
```

- Tiếng Việt: `"So sánh văn bản yêu cầu ít nhất 2 tài liệu nguồn sẵn sàng trong sổ tay."`
- Tiếng Anh: `"Document diff requires at least 2 ready source documents in the notebook."`
