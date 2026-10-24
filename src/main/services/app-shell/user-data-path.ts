import { join } from "node:path";

// Đổi tên sản phẩm InsightVault → Quillhold → SourceCraft: Electron suy userData từ tên app, nên bản cài mới sẽ nhìn vào thư mục
// MỚI và người dùng cũ mất dữ liệu (DB, vector, backup, cấu hình). Hàm thuần: nếu thư mục cũ tồn tại → trả path để
// main ghim lại userData vào đó. Cài mới (chưa có thư mục cũ) dùng thư mục mặc định theo tên mới.

/** Danh sách thư mục dữ liệu cũ cần hỗ trợ (ưu tiên Quillhold, sau đó tới InsightVault). */
export const LEGACY_USER_DATA_DIRS = ["Quillhold", "InsightVault"] as const;
export const LEGACY_USER_DATA_DIR = "Quillhold";

export interface LegacyUserDataInput {
  isPackaged: boolean;
  /** Đã có cờ --user-data-dir (E2E/người dùng chỉ định) → tôn trọng, không ghim. */
  hasUserDataSwitch: boolean;
  appData: string;
  exists: (path: string) => boolean;
}

/** Path userData cũ cần ghim, hoặc null (giữ mặc định). Dev (chưa đóng gói) không đụng — dữ liệu dev riêng. */
export function resolveLegacyUserDataPath(
  input: LegacyUserDataInput,
): string | null {
  if (!input.isPackaged || input.hasUserDataSwitch) return null;
  for (const dir of LEGACY_USER_DATA_DIRS) {
    const legacy = join(input.appData, dir);
    if (input.exists(legacy)) return legacy;
  }
  return null;
}
