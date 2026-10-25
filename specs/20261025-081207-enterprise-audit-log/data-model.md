# Data model — Nhật ký kiểm toán (236)

Không có migration SQLite. Mọi dữ liệu audit nằm trong tệp JSON Lines của thư mục nhật ký (R7, R8) + một khoá trong keychain (R5). Lược đồ đầy đủ từng bản ghi: [contracts/audit-record.md](./contracts/audit-record.md).

## 1. Chính sách (`enterprise-policy.json` hệ thống — 3 khoá tuỳ chọn mới)

| Khoá                 | Kiểu    | Mặc định | Ràng buộc                                                              |
| -------------------- | ------- | -------- | ---------------------------------------------------------------------- |
| `enableAuditLogging` | boolean | `false`  | Chỉ đọc từ tệp hệ thống (C1)                                           |
| `auditPublicKey`     | string  | —        | Bắt buộc khi `enableAuditLogging: true`; PEM SPKI khoá **X25519** (R4) |
| `auditLogDirectory`  | string  | —        | Đường dẫn tuyệt đối; thiếu ⇒ `<userData>/audit/` (C3)                  |

`schemaVersion` giữ `1`. `parseEnterprisePolicyJson` (khoá cũ) không đổi. Kiểu `EnterprisePolicy` trong `types.ts` KHÔNG thêm trường (renderer không cần) — kiểu mới `AuditPolicyState` chỉ ở main.

```ts
// src/main/services/audit/audit-policy.ts (main-only)
type AuditPolicyState =
  | { status: "notConfigured" }
  | { status: "policyError"; reason: AuditPolicyErrorReason }
  | {
      status: "configured";
      organization: string;
      policyId: string;
      orgPublicKeyPem: string;
      orgKeyId: string; // hex 32 ký tự
      directory: string | null; // null ⇒ mặc định
    };

type AuditPolicyErrorReason =
  | "unreadableSystemPolicy" // tồn tại nhưng đọc lỗi / JSON hỏng / sai schemaVersion
  | "invalidAuditPublicKey"
  | "invalidAuditLogDirectory";
```

## 2. Trạng thái hiệu lực (R10)

```ts
// src/shared/ipc/types.ts (append) — renderer đọc qua audit:getStatus / audit:statusChanged
type AuditState =
  "off" | "licenseInactive" | "policyError" | "active" | "blocked";

interface AuditStatus {
  state: AuditState;
  /** Mã lý do (i18n ở renderer): policyError ⇒ AuditPolicyErrorReason; blocked ⇒ "writeFailed" | "keyUnavailable". */
  reason?: string;
  organization?: string;
  /** Chỉ nhãn — renderer không nhận đường dẫn (quy ước 085). */
  directoryKind?: "default" | "custom";
  /** blocked: thời điểm bắt đầu sự cố (ms). */
  blockedSince?: number;
}
```

Bảng chuyển trạng thái (đánh giá lúc khởi động, mỗi lượt AI, khi `license:changed`, khi `before-quit`):

| Từ \ điều kiện            | policy notConfigured | policy policyError | policy configured + bản quyền không đủ           | configured + bản quyền đủ + ghi OK                     | configured + bản quyền đủ + ghi lỗi |
| ------------------------- | -------------------- | ------------------ | ------------------------------------------------ | ------------------------------------------------------ | ----------------------------------- |
| (mọi)                     | `off`                | `policyError`      | `licenseInactive`                                | `active`                                               | `blocked`                           |
| Chặn lượt AI?             | không                | **có**             | không                                            | không                                                  | **có**                              |
| Bản ghi phát sinh khi vào | —                    | —                  | `audit.stopped{licenseInactive}` nếu từ `active` | `audit.started` (+ `audit.recovered` nếu từ `blocked`) | — (không ghi được)                  |

## 3. Bản ghi kiểm toán (AuditRecord)

Trường chung mọi bản ghi:

| Trường           | Kiểu    | Ghi chú                                               |
| ---------------- | ------- | ----------------------------------------------------- |
| `v`              | `1`     | Phiên bản lược đồ                                     |
| `seq`            | number  | Tăng 1, liên tục xuyên tệp, bắt đầu 0                 |
| `ts`             | string  | ISO-8601 UTC ms                                       |
| `type`           | string  | Xem §4                                                |
| `clockBackwards` | `true`? | Chỉ có khi `ts` < `ts` trước (FR-013)                 |
| `prevHash`       | hex(64) | `hash` của bản ghi `seq-1`; bản ghi `seq 0`: `"0"×64` |
| `hash`           | hex(64) | SHA-256 của JSON chuẩn hoá bản ghi bỏ `hash`, `sig`   |
| `sig`            | base64  | Ed25519(khoá máy, byte UTF-8 của `hash`)              |

## 4. Loại bản ghi

| `type`                 | Khi nào                                                                                              | Trường riêng                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `audit.chainStarted`   | Bản ghi đầu tiên của máy                                                                             | `devicePublicKey` (PEM), `deviceKeyId`, `orgKeyId`                                                                  |
| `audit.fileStarted`    | Đầu mỗi tệp sau xoay vòng                                                                            | `prevFile`                                                                                                          |
| `audit.started`        | Vào `active` (khởi động / bản quyền có lại / sau policy)                                             | `osUser`, `host`, `appVersion`, `policyId`, `organization`, `licenseId?`, `deviceKeyId`, `orgKeyId`                 |
| `audit.stopped`        | Rời `active` khi còn ghi được, **sau** khi ghi `interaction.end{cancelled}` cho mọi tương tác còn mở | `reason`: `appQuit` · `licenseInactive`                                                                             |
| `audit.sessionAborted` | Khởi động thấy phiên trước không có `audit.stopped`                                                  | `openInteractions: string[]`                                                                                        |
| `audit.recovered`      | Ghi lại được sau `blocked`                                                                           | `since` (ISO)                                                                                                       |
| `audit.tailRepaired`   | Khởi động thấy dòng cuối dở                                                                          | `danglingBytes`                                                                                                     |
| `audit.keyRotated`     | Khoá máy mất / khác                                                                                  | `previousDeviceKeyId`, `devicePublicKey`, `deviceKeyId`, `reason`: `keyMissing` · `keyMismatch`                     |
| `interaction.start`    | Trước khi gửi yêu cầu AI (write-ahead)                                                               | `interactionId`, `osUser`, `host`, `channel`: `rag` · `studio`, `scope`, `question?` (bản mã), `model`, + Studio §5 |
| `interaction.end`      | Sau khi lượt kết thúc                                                                                | `interactionId`, `status`, `model`, `citations`, `parts?`, `truncated?`, `errorCode?`                               |
| `export.saved`         | Xuất báo cáo Studio thành công                                                                       | `osUser`, `format`, `notebookId`, `notebookName`, `studioKind?`, `fileName`                                         |

### Kiểu con

```ts
type AuditModel = {
  category: "local" | "lan" | "online";
  providerId: string; // "ollama" | "lan-ollama" | "lan-openai" | "anthropic" | "openai" | "gemini"
  model: string | null;
};

type AuditScope =
  | { kind: "notebook"; notebookId: string; notebookName: string | null }
  | { kind: "all" }; // tìm toàn cục (231)

type EncryptedText = {
  alg: "x25519-hkdf-sha256-aes256gcm";
  orgKeyId: string;
  epk: string; // base64 SPKI DER khoá tạm
  nonce: string; // base64 12 byte
  ct: string; // base64
  tag: string; // base64 16 byte
  len: number; // số code point của bản rõ (để IT ước lượng, không lộ nội dung)
};

type AuditCitation = {
  n: number;
  sourceId: string;
  sourceTitle: string;
  notebookId: string;
  notebookName: string | null;
  chunkId: string;
  locator: Locator; // y nguyên Citation.locator (Constitution II)
};

type InteractionStatus =
  "completed" | "notFound" | "cancelled" | "error" | "reindexing";
```

- `interaction.start.question` có với RAG luôn; với Studio chỉ khi `studioKind === "custom"`.
- `notebookId` của trích dẫn trong scope một sổ tay = sổ tay của lượt; trong scope `all` = `Citation.notebookId` (231).
- `errorCode` chỉ là mã (`UserFacingError.code` hoặc `errorType`), không message.

## 5. Trường riêng Studio trong `interaction.start`

`studioKind`, `sourceScope`: `{ all: true }` hoặc `{ sourceIds: string[] }` (≤ 50).

## 6. Tệp và khoá

| Thành phần      | Vị trí                                                             | Ghi chú                                            |
| --------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Thư mục nhật ký | `auditLogDirectory` hoặc `<userData>/audit/`                       | Không trong sao lưu/khôi phục, không trong `logs/` |
| Tệp nhật ký     | `audit-<seqĐầu, 12 chữ số>.jsonl`                                  | Xoay ở 5 MB, không xoá                             |
| Khoá ký của máy | keytar service `SourceCraft Audit`, account `device-signing-key`   | PKCS8 PEM Ed25519                                  |
| Khoá tổ chức    | Bí mật: chỉ ở IT (tệp do `--audit-keygen` sinh). Công khai: policy | X25519                                             |

## 7. Kết quả kiểm tra (CLI)

```ts
interface AuditVerifyReport {
  result: "intact" | "tampered";
  files: string[];
  records: number;
  firstSeq: number;
  lastSeq: number;
  firstTs: string | null;
  lastTs: string | null;
  deviceKeyIds: string[];
  warnings: AuditVerifyWarning[]; // openInteraction, keyRotated, startsAfterZero, clockBackwards, tailRepaired
  firstFailure?: {
    file: string;
    line: number;
    seq: number | null;
    kind: AuditVerifyFailureKind;
  };
}
type AuditVerifyFailureKind =
  | "malformedLine"
  | "badHash"
  | "badSignature"
  | "brokenChain"
  | "seqGap"
  | "seqOrder"
  | "missingFile"
  | "unexpectedDeviceKey";
```
