# Data Model: document-diff-redline

Quyết định: [`docs/04-decisions/2026-10-25-document-diff-clarify.md`](../../docs/04-decisions/2026-10-25-document-diff-clarify.md).

## 1. Mở rộng `StudioKind` (`src/shared/ipc/types.ts`)

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
  | "documentDiff"; // 233: so sánh bản gốc ↔ bản sửa đổi
```

TypeScript buộc bổ sung khoá `documentDiff` ở mọi `Record<StudioKind, …>` (prompt `task()`, nhãn i18n, nhãn xuất).

## 2. Hằng số loại (`src/main/services/studio/constants.ts`)

| Hằng                        | Thay đổi                  | Ảnh hưởng                                                            |
| --------------------------- | ------------------------- | -------------------------------------------------------------------- |
| `STUDIO_KINDS`              | + `"documentDiff"` (cuối) | loại sinh được                                                       |
| `STUDIO_ALL_KINDS`          | + `"documentDiff"` (cuối) | `isStudioKind`, entitlement Pro/Enterprise, khớp CHECK migration v13 |
| `FREE_ALLOWED_STUDIO_KINDS` | **không đổi**             | Free bị từ chối `licenseRequireProStudio`                            |

## 3. `StudioGenerateInput` — không thêm field

Dùng `sourceIds` hiện có, với ngữ nghĩa riêng khi `kind === "documentDiff"`:

```typescript
// kind = "documentDiff": đúng 2 id khác nhau (sau khử trùng của resolveSourceScope).
// sourceIds[0] = bản gốc, sourceIds[1] = bản sửa đổi.
sourceIds?: string[];
```

`StudioResult.sourceIds` (cột `source_ids_json`) lưu đúng thứ tự này ⇒ tạo lại phiên bản giữ vai trò.

## 4. Migration v13 — `studio_result`

CHECK v11 chỉ có 9 loại. SQLite không ALTER được CHECK ⇒ dựng lại bảng (cùng cách v11):

```sql
CREATE TABLE studio_result_new (
  id              TEXT PRIMARY KEY,
  notebook_id     TEXT NOT NULL REFERENCES notebook(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('summary','keyPoints','faq','outline','studyGuide','briefing',
                                                'timeline','keyTerms','custom','documentDiff')),
  content         TEXT NOT NULL,
  citations_json  TEXT NOT NULL,
  custom_prompt   TEXT,
  source_ids_json TEXT,
  parts           INTEGER,
  truncated       INTEGER CHECK (truncated IN (0,1)),
  local           INTEGER CHECK (local IN (0,1)),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
INSERT INTO studio_result_new SELECT id, notebook_id, kind, content, citations_json, custom_prompt, source_ids_json,
  parts, truncated, local, created_at, updated_at FROM studio_result;   -- copy ĐỦ cột (khác v11)
DROP TABLE studio_result;
ALTER TABLE studio_result_new RENAME TO studio_result;
CREATE INDEX IF NOT EXISTS idx_studio_notebook ON studio_result(notebook_id);
CREATE INDEX IF NOT EXISTS idx_studio_versions ON studio_result(notebook_id, kind, created_at);
```

Danh sách trong CHECK phải khớp `STUDIO_ALL_KINDS` (có test khoá).

## 5. Mã lỗi người dùng (`src/shared/codes/user-error.ts`)

```typescript
| "studioDiffNeedTwoSources" // 233: documentDiff cần đúng 2 nguồn khác nhau, ready và có nội dung
```

| Ngôn ngữ | Thông điệp                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------- |
| vi       | "So sánh văn bản cần chọn đúng 2 tài liệu khác nhau (bản gốc và bản sửa đổi) đã sẵn sàng và có nội dung." |
| en       | "Document comparison needs exactly 2 different ready sources with content (original and revised)."        |

## 6. Khoá i18n mới (`src/shared/i18n/domains/studio.ts`)

| Khoá                       | vi                                                                   | en                                                    |
| -------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| `studio.kind.documentDiff` | So sánh văn bản                                                      | Compare documents                                     |
| `studio.diff.base`         | Bản gốc                                                              | Original                                              |
| `studio.diff.revised`      | Bản sửa đổi                                                          | Revised                                               |
| `studio.diff.swap`         | Hoán đổi                                                             | Swap                                                  |
| `studio.diff.run`          | So sánh                                                              | Compare                                               |
| `studio.diff.pick`         | Chọn tài liệu…                                                       | Choose a document…                                    |
| `studio.diff.disclaimer`   | Phân tích dựa trên nội dung tài liệu, không thay thế tư vấn pháp lý. | Based on the documents' text only — not legal advice. |

Nhãn tiêu đề 4 mục và tiêu đề cột bảng nằm trong prompt theo `outputLanguage` (giống `FAQ_LABELS` / `UNDATED_LABEL`), không
phải khoá giao diện.
