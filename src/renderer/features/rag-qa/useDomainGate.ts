import { useEffect, useState } from "react";
import type { DomainMode } from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { useLicenseFeature } from "../license-upsell/useLicenseFeature";

// 238 — khoá chế độ AI chuyên gia (Pháp lý / Y tế) theo bản quyền Pro/Enterprise.
// Free: bấm "Pháp lý" hoặc "Y tế" ⇒ hiện UpgradePrompt với mã lỗi SPECIALIST_MODES_UPSELL.
// Bản quyền mất cờ (hết hạn/gỡ) khi đang chọn specialist mode ⇒ tự chuyển về "general".

export const SPECIALIST_MODES_UPSELL: ParsedIpcError = {
  message: "licenseRequireProSpecialistModes",
  onlineKind: null,
  code: "licenseRequireProSpecialistModes",
};

interface DomainGate {
  locked: boolean;
  upsellVisible: boolean;
  showUpsell: () => void;
  changeDomain: (d: DomainMode) => void;
}

export function useDomainGate(
  domainMode: DomainMode,
  setDomainMode: (d: DomainMode) => void,
): DomainGate {
  const allowed = useLicenseFeature("specialistAiModes");
  const locked = allowed === false;
  const [upsell, setUpsell] = useState(false);

  useEffect(() => {
    if (locked && (domainMode === "legal" || domainMode === "medical")) {
      setDomainMode("general");
    }
  }, [locked, domainMode, setDomainMode]);

  return {
    locked,
    upsellVisible: locked && upsell,
    showUpsell: () => setUpsell(true),
    changeDomain: (d) => {
      setUpsell(false);
      setDomainMode(d);
    },
  };
}
