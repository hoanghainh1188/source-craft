// 236 — hằng số nhật ký kiểm toán (một chỗ). Định dạng trên đĩa: specs/20261025-081207-enterprise-audit-log/contracts/audit-record.md.

/** Phiên bản lược đồ bản ghi (`v`). Đổi thuật toán băm/ký/mã hoá ⇒ tăng. */
export const AUDIT_RECORD_VERSION = 1 as const;

/** Xoay sang tệp mới khi tệp hiện hành vượt ngưỡng (research R7). Không bao giờ xoá tệp cũ (FR-018). */
export const AUDIT_MAX_FILE_BYTES = 5_242_880;

/** Khoá ký của máy trong keychain (R5) — tách khỏi service "InsightVault" của API key online. */
export const AUDIT_KEYTAR_SERVICE = "SourceCraft Audit";
export const AUDIT_KEYTAR_ACCOUNT = "device-signing-key";

/** Mã hoá câu hỏi bằng khoá công khai X25519 của tổ chức (R4). */
export const AUDIT_CIPHER_ALG = "x25519-hkdf-sha256-aes256gcm" as const;
export const AUDIT_HKDF_INFO = "sourcecraft-audit-v1";

/** `prevHash` của bản ghi đầu tiên (`seq 0`). */
export const GENESIS_PREV_HASH = "0".repeat(64);

/** Tên thư mục mặc định trong dữ liệu ứng dụng (C3). */
export const AUDIT_DEFAULT_DIR_NAME = "audit";

/** Tệp nhật ký: audit-<seq đầu tệp, 12 chữ số>.jsonl. */
export const AUDIT_FILE_PATTERN = /^audit-(\d{12})\.jsonl$/;

/** Đọc tối đa bấy nhiêu tệp gần nhất lúc khởi động để suy đầu chuỗi + phiên trước (R6). */
export const AUDIT_TAIL_FILES = 2;
