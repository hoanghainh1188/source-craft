import { UserFacingError } from "@shared/codes/user-error";
import type { FeatureGate } from "../license/feature-gate";

// 231 — tìm kiếm toàn cục đa sổ tay (scope === "all") yêu cầu cờ bản quyền crossNotebookSearch (Pro/Enterprise).
// 238 — chế độ chuyên gia (domainMode === "legal" | "medical") yêu cầu cờ bản quyền specialistAiModes (Pro/Enterprise).
// Dùng chung cho rag:ask, rag:askStream và studio:generate. Không có gate (chưa nối licenseService) ⇒ cho phép, như các cổng khác
// trong register.ts. Input chưa tin cậy (từ renderer) ⇒ chỉ đọc scope/domainMode khi là object.

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

export function assertDomainModeAllowed(
  input: unknown,
  gate: Pick<FeatureGate, "hasFeature"> | undefined,
): void {
  const domainMode =
    typeof input === "object" && input !== null
      ? (input as { domainMode?: unknown }).domainMode
      : undefined;
  if (
    (domainMode === "legal" || domainMode === "medical") &&
    gate &&
    !gate.hasFeature("specialistAiModes")
  ) {
    throw new UserFacingError("licenseRequireProSpecialistModes");
  }
}
