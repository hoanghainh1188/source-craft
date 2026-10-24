import { useEffect, useState } from "react";
import type { RagSearchScope } from "@shared/ipc/types";
import type { ParsedIpcError } from "@shared/online-error-tag";
import { useLicenseFeature } from "../license-upsell/useLicenseFeature";

// 231 — khoá phạm vi "Toàn bộ kho" theo bản quyền ở composer Chat. Gói Free: bấm "Toàn bộ" ⇒ hiện lời mời nâng
// cấp (UpgradePrompt nhận lỗi giả CROSS_SEARCH_UPSELL) thay vì đổi phạm vi rồi bị main từ chối sau khi gửi.
// Bản quyền mất cờ khi đang ở "all" (huỷ/hết hạn) ⇒ tự về "current". Kích hoạt bản quyền ⇒ ẩn lời mời.

export const CROSS_SEARCH_UPSELL: ParsedIpcError = {
  message: "licenseRequireProCrossSearch",
  onlineKind: null,
  code: "licenseRequireProCrossSearch",
};

interface ScopeGate {
  locked: boolean;
  upsellVisible: boolean;
  showUpsell: () => void;
  changeScope: (s: RagSearchScope) => void;
}

export function useScopeGate(
  scope: RagSearchScope,
  setScope: (s: RagSearchScope) => void,
): ScopeGate {
  const allowed = useLicenseFeature("crossNotebookSearch");
  // null (chưa biết) ⇒ không khoá; main vẫn chặn ở IPC.
  const locked = allowed === false;
  const [upsell, setUpsell] = useState(false);

  useEffect(() => {
    if (locked && scope === "all") setScope("current");
  }, [locked, scope, setScope]);

  return {
    locked,
    upsellVisible: locked && upsell,
    showUpsell: () => setUpsell(true),
    changeScope: (s) => {
      setUpsell(false);
      setScope(s);
    },
  };
}
