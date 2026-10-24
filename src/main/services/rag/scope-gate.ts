import { UserFacingError } from "@shared/codes/user-error";
import type { FeatureGate } from "../license/feature-gate";

// 231 — tìm kiếm toàn cục đa sổ tay (scope === "all") yêu cầu cờ bản quyền crossNotebookSearch (Pro/Enterprise).
// Dùng chung cho rag:ask và rag:askStream. Không có gate (chưa nối licenseService) ⇒ cho phép, như các cổng khác
// trong register.ts. Input chưa tin cậy (từ renderer) ⇒ chỉ đọc scope khi là object.

export function assertRagScopeAllowed(
  input: unknown,
  gate: Pick<FeatureGate, "hasFeature"> | undefined,
): void {
  const scope =
    typeof input === "object" && input !== null
      ? (input as { scope?: unknown }).scope
      : undefined;
  if (scope === "all" && gate && !gate.hasFeature("crossNotebookSearch")) {
    throw new UserFacingError("licenseRequireProCrossSearch");
  }
}
