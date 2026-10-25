import type { ExportFormat, Locator, StudioKind } from "@shared/ipc/types";
import type { AUDIT_CIPHER_ALG } from "./audit-constants";

// 236 — kiểu bản ghi kiểm toán (main-only). Trường + ý nghĩa: data-model.md §3–§5. KHÔNG có câu trả lời của AI (FR-012).

export type AuditModelCategory = "local" | "lan" | "online";

export interface AuditModel {
  category: AuditModelCategory;
  providerId: string;
  model: string | null;
}

export type AuditScope =
  | { kind: "notebook"; notebookId: string; notebookName: string | null }
  | { kind: "all" };

/** Câu hỏi đã mã hoá bằng khoá công khai của tổ chức (R4). `len` = số code point của bản rõ. */
export interface EncryptedText {
  alg: typeof AUDIT_CIPHER_ALG;
  orgKeyId: string;
  epk: string;
  nonce: string;
  ct: string;
  tag: string;
  len: number;
}

export interface AuditCitation {
  n: number;
  sourceId: string;
  sourceTitle: string;
  notebookId: string;
  notebookName: string | null;
  chunkId: string;
  locator: Locator;
}

export type InteractionStatus =
  "completed" | "notFound" | "cancelled" | "error" | "reindexing";

export type StudioSourceScope = { all: true } | { sourceIds: string[] };

// ── Thân bản ghi (chưa niêm phong) — mỗi loại một `type`.

export interface ChainStartedBody {
  type: "audit.chainStarted";
  devicePublicKey: string;
  deviceKeyId: string;
  orgKeyId: string;
}
export interface FileStartedBody {
  type: "audit.fileStarted";
  prevFile: string;
}
export interface StartedBody {
  type: "audit.started";
  osUser: string;
  host: string;
  appVersion: string;
  policyId: string;
  organization: string;
  licenseId?: string;
  deviceKeyId: string;
  orgKeyId: string;
}
export interface StoppedBody {
  type: "audit.stopped";
  reason: "appQuit" | "licenseInactive";
}
export interface SessionAbortedBody {
  type: "audit.sessionAborted";
  openInteractions: string[];
}
export interface RecoveredBody {
  type: "audit.recovered";
  since: string;
}
export interface TailRepairedBody {
  type: "audit.tailRepaired";
  danglingBytes: number;
}
export interface KeyRotatedBody {
  type: "audit.keyRotated";
  previousDeviceKeyId: string;
  devicePublicKey: string;
  deviceKeyId: string;
  reason: "keyMissing" | "keyMismatch";
}
export interface InteractionStartBody {
  type: "interaction.start";
  interactionId: string;
  osUser: string;
  host: string;
  channel: "rag" | "studio";
  scope: AuditScope;
  question?: EncryptedText;
  model: AuditModel;
  studioKind?: StudioKind;
  sourceScope?: StudioSourceScope;
}
export interface InteractionEndBody {
  type: "interaction.end";
  interactionId: string;
  status: InteractionStatus;
  model: AuditModel;
  citations: AuditCitation[];
  parts?: number;
  truncated?: boolean;
  errorCode?: string;
}
export interface ExportSavedBody {
  type: "export.saved";
  osUser: string;
  format: ExportFormat;
  notebookId: string | null;
  notebookName: string | null;
  studioKind?: StudioKind;
  fileName: string;
}

export type AuditRecordBody =
  | ChainStartedBody
  | FileStartedBody
  | StartedBody
  | StoppedBody
  | SessionAbortedBody
  | RecoveredBody
  | TailRepairedBody
  | KeyRotatedBody
  | InteractionStartBody
  | InteractionEndBody
  | ExportSavedBody;

export type AuditRecordType = AuditRecordBody["type"];

/** Trường niêm phong chung (R3). */
export interface AuditSeal {
  v: 1;
  seq: number;
  ts: string;
  prevHash: string;
  hash: string;
  sig: string;
  clockBackwards?: true;
}

export type AuditRecord = AuditRecordBody & AuditSeal;

/** Đầu chuỗi: đủ để niêm phong bản ghi kế tiếp. */
export interface ChainHead {
  seq: number;
  hash: string;
  /** ms epoch của bản ghi cuối (phát hiện đồng hồ lùi — FR-013). */
  tsMs: number;
}

// ── Khoá

export interface DeviceKey {
  privateKeyPem: string;
  publicKeyPem: string;
  deviceKeyId: string;
}

// ── Chính sách (main-only, R9)

export type AuditPolicyErrorReason =
  | "unreadableSystemPolicy"
  | "invalidAuditPublicKey"
  | "invalidAuditLogDirectory";

export type AuditPolicyState =
  | { status: "notConfigured" }
  | { status: "policyError"; reason: AuditPolicyErrorReason }
  | {
      status: "configured";
      organization: string;
      policyId: string;
      orgPublicKeyPem: string;
      orgKeyId: string;
      directory: string | null;
    };

// ── Đầu vào / kết quả của một lượt (handler IPC ⇒ AuditService)

export interface InteractionMeta {
  channel: "rag" | "studio";
  scope: AuditScope;
  /** Bản RÕ — service mã hoá trước khi ghi, không bao giờ ghi bản rõ. */
  question?: string;
  model: AuditModel;
  studioKind?: StudioKind;
  sourceScope?: StudioSourceScope;
}

export interface InteractionOutcome {
  status: InteractionStatus;
  citations: AuditCitation[];
  parts?: number;
  truncated?: boolean;
  errorCode?: string;
}

export interface ExportMeta {
  /** Không tin cậy (renderer) — service chuẩn hoá về ExportFormat. */
  format: unknown;
  notebookId?: unknown;
  studioKind?: unknown;
  fileName: string;
}

// ── I/O tiêm vào (đồng bộ: một tiến trình ghi duy nhất nhờ single-instance lock ⇒ không xen lẫn — FR-017)

export interface AuditFs {
  mkdirp(dir: string): void;
  /** Tên tệp (không đường dẫn) trong thư mục; thư mục không tồn tại ⇒ []. */
  list(dir: string): string[];
  readFile(path: string): Buffer;
  /** Byte; không tồn tại ⇒ 0. */
  size(path: string): number;
  /** Ghi thêm cả chuỗi + fsync trước khi trả (write-ahead). Lỗi ⇒ ném (mang `code` như ENOSPC). */
  appendDurable(path: string, data: string): void;
}
