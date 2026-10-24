import type { UserErrorCode } from "@shared/codes/user-error";

// 237 — các mã lỗi "chạm hạn mức / cần gói cao hơn" ⇒ kèm lời mời nâng cấp. Lỗi khác (đặt tên, khoá vault…)
// không phải chuyện bản quyền nên không mời mua.
const UPSELL_CODES: ReadonlySet<UserErrorCode> = new Set<UserErrorCode>([
  "licenseLimitNotebooks",
  "licenseLimitSources",
  "licenseRequireProFormat",
  "licenseRequireProStudio",
  "licenseRequireProSharedNotebooks",
  "lanAiRequireEnterprise",
  "licenseRequireProCrossSearch",
  "licenseRequireProExport",
]);

export function isUpsellCode(code: string | undefined): boolean {
  return code !== undefined && UPSELL_CODES.has(code as UserErrorCode);
}
