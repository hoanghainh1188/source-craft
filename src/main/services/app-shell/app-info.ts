import type { AppInfo } from "@shared/ipc/types";

export const APP_NAME = "SourceCraft";

/** Ghép AppInfo. Nhận version từ ngoài (main truyền app.getVersion()) để hàm thuần, test được. */
export function buildAppInfo(version: string): AppInfo {
  return { name: APP_NAME, version };
}
