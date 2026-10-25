# Contracts: document-diff-redline

## 1. Studio Generate Contract
- **Input**:
  ```typescript
  interface StudioGenerateInput {
    notebookId: string;
    kind: "documentDiff";
    sourceIds?: string[]; // Danh sách nguồn so sánh (yêu cầu ≥ 2)
    outputLanguage?: "vi" | "en";
    ...
  }
  ```
- **Validation Rules**:
  - Nếu `kind === "documentDiff"`:
    - Nếu `sourceIds` được truyền: `sourceIds.length >= 2`.
    - Nếu `sourceIds` không được truyền (chọn toàn bộ notebook): số lượng nguồn có `status === "ready"` trong notebook phải $\ge 2$.
    - Vi phạm: ném `UserFacingError("studioDiffNeedTwoSources")`.
- **Output**:
  - `StudioResult` lưu vào DB SQLite và trả về cho renderer kèm `citations` đã hậu kiểm.
