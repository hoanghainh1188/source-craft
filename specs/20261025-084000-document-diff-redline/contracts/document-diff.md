# Contracts: document-diff-redline

Quyết định: [`docs/04-decisions/2026-10-25-document-diff-clarify.md`](../../../docs/04-decisions/2026-10-25-document-diff-clarify.md) (D1–D3, D9).

## 1. Studio Generate Contract (`studio:generate`, không thêm kênh/field mới)

- **Input**:
  ```typescript
  interface StudioGenerateInput {
    notebookId: string;
    kind: "documentDiff";
    sourceIds: [baseSourceId: string, revisedSourceId: string]; // đúng 2, khác nhau; thứ tự = vai trò
    outputLanguage?: "vi" | "en";
    target?: AiTarget;
    generationId?: string;
    domainMode?: DomainMode; // qua gate IPC như loại khác; không đổi prompt diff ở v1 (D10)
  }
  ```
- **Thứ tự kiểm tra ở main**:
  1. `register.ts`: `assertDomainModeAllowed` → `assertCanGenerateStudio("documentDiff")` (Free ⇒ `licenseRequireProStudio`).
  2. `studio-service.ts`: `resolveSourceScope` (id lạ ⇒ `studioSourcesInvalid`; chưa ready ⇒ `studioSourceNotReady`).
  3. Cặp diff: `scope.ids` phải có đúng 2 phần tử và mỗi nguồn có ≥ 1 chunk; sai ⇒ `studioDiffNeedTwoSources`. Thiếu
     `sourceIds` (cả notebook) cũng ⇒ `studioDiffNeedTwoSources`.
  4. Chỉ sau đó mới `contextInfo()` và gọi AI.
- **Output**: `StudioResult` với `kind = "documentDiff"`, `sourceIds = [base, revised]` (đúng thứ tự), `citations` đã hậu
  kiểm, `parts` / `truncated` như các loại khác. Lưu vào `studio_result` (cần migration v13).
