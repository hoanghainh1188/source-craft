# Contract — IPC, mã lỗi, policy và điểm móc (236)

Tất cả nằm ở main; renderer chỉ đọc trạng thái (FR-003). Mọi bổ sung vào tệp dùng chung là **append** (R20).

## Kênh IPC mới (`src/shared/ipc/channels.ts`)

| Kênh                  | Hướng           | Payload                          | Trả về        |
| --------------------- | --------------- | -------------------------------- | ------------- |
| `audit:getStatus`     | renderer → main | —                                | `AuditStatus` |
| `audit:statusChanged` | main → renderer | `AuditStatus` (push, mọi cửa sổ) | —             |

Không có kênh ghi/xoá/bật/tắt. Preload expose `window.api.auditGetStatus()` và `window.api.onAuditStatusChanged(cb)` (trả hàm huỷ) (whitelisted như các kênh hiện có).

`AuditStatus`: [data-model.md](../data-model.md) §2.

## Thay đổi kênh hiện có

| Kênh              | Thay đổi                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rag:ask`         | Bọc bằng `audit.runInteraction(...)` sau gate scope, trước khi gọi service. `active` ⇒ ghi `start`/`end`; `policyError`/`blocked` ⇒ ném lỗi trước khi gọi model. |
| `rag:askStream`   | Như trên; huỷ qua `rag:stop` ⇒ `status: "cancelled"` (vẫn ghi trích dẫn của phần đã nhận).                                                                       |
| `studio:generate` | Như trên, sau `assertCanGenerateStudio`; `studioCancelled` ⇒ `status: "cancelled"`.                                                                              |
| `studio:export`   | `StudioExportInput` thêm `notebookId?: string`, `studioKind?: StudioKind`. `saved: true` ⇒ ghi `export.saved` (best-effort; lỗi ⇒ `blocked` cho lượt sau).       |

Ánh xạ trạng thái kết thúc:

| Kết quả service                         | `status`              |
| --------------------------------------- | --------------------- |
| `RagAnswer.reindexing === true`         | `reindexing`          |
| `RagAnswer.notFound === true`           | `notFound`            |
| `rag:stop` đã abort controller của lượt | `cancelled`           |
| `UserFacingError("studioCancelled")`    | `cancelled`           |
| Ngoại lệ khác (gồm lỗi provider online) | `error` + `errorCode` |
| Còn lại                                 | `completed`           |

## Mã lỗi mới (`src/shared/codes/user-error.ts` + vi/en `i18n/domains/core.ts`)

| Mã                    | Khi nào                                                                                   | Thông điệp (vi, nháp)                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `auditWriteFailed`    | Không ghi được bản ghi bắt đầu (đĩa đầy, mất quyền, thư mục không tồn tại/không tạo được) | "Không ghi được nhật ký kiểm toán theo chính sách của tổ chức, nên AI tạm thời bị khoá. Hãy giải phóng dung lượng đĩa hoặc liên hệ bộ phận IT." |
| `auditPolicyInvalid`  | `policyError` (tệp chính sách hệ thống hỏng, khoá công khai hoặc thư mục không hợp lệ)    | "Chính sách nhật ký kiểm toán của tổ chức bị cấu hình sai, nên AI tạm thời bị khoá. Hãy liên hệ bộ phận IT."                                    |
| `auditKeyUnavailable` | Không đọc/ghi được khoá ký trong kho khoá hệ điều hành                                    | "Không truy cập được khoá ký nhật ký kiểm toán trong kho khoá của hệ điều hành, nên AI tạm thời bị khoá. Hãy liên hệ bộ phận IT."               |

Không thêm vào `upsell-codes.ts` (không phải lỗi hạn mức).

## Policy (`PolicyService`, main-only)

```ts
interface PolicyService {
  // … hiện có, không đổi
  getAuditPolicy(): AuditPolicyState; // đọc riêng tệp hệ thống (R9); nạp 1 lần
}
```

Khoá JSON mới trong tệp hệ thống: `enableAuditLogging`, `auditPublicKey`, `auditLogDirectory` ([data-model.md](../data-model.md) §1). Ví dụ trong `docs/enterprise-deployment-guide.md`:

```json
{
  "schemaVersion": 1,
  "policyId": "pol-2026-10",
  "organization": "Ngân hàng X",
  "forceLocalOnly": true,
  "enableAuditLogging": true,
  "auditPublicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VuAyEA…\n-----END PUBLIC KEY-----\n",
  "auditLogDirectory": "D:\\AuditLogs\\SourceCraft"
}
```

## `AuditService` (main-only, `src/main/services/audit/audit-service.ts`)

```ts
interface AuditService {
  status(): AuditStatus;
  onStatusChange(cb: (s: AuditStatus) => void): () => void;
  /** Khởi động: suy đầu chuỗi, sửa đuôi, sessionAborted, keyRotated, audit.started. Không ném. */
  start(): Promise<void>;
  /** Bao một lượt AI. state off/licenseInactive ⇒ chỉ chạy run(). policyError/blocked hoặc ghi start lỗi ⇒ ném UserFacingError, KHÔNG gọi run(). */
  runInteraction<T>(
    meta: InteractionMeta,
    run: () => Promise<T>,
    summarize: (r: T) => InteractionOutcome,
  ): Promise<T>;
  recordExport(meta: ExportMeta): Promise<void>;
  /** license:changed ⇒ đánh giá lại; before-quit ⇒ end{cancelled} cho tương tác còn mở, rồi audit.stopped{appQuit}. */
  reevaluate(): Promise<void>;
  stop(reason: "appQuit"): Promise<void>;
}
```

Phụ thuộc tiêm vào (test bằng fake): `fs` (append+fsync, readTail, list, mkdir, stat), `keyStore` (`KeytarLike`), `clock`, `randomId`, `crypto` (mặc định `node:crypto`), `policy: () => AuditPolicyState`, `license: () => { valid: boolean; itPolicy: boolean; licenseId?: string }`, `identity: () => { osUser; host }`, `appVersion`, `notebookName(id)`, `logEvent` (chỉ mã/loại lỗi).
