import { useCallback, useState } from "react";

// 237 — gọi main mở trang mua (URL cố định ở main). `failed` để hiện câu hướng dẫn khi HĐH không mở được
// trình duyệt; bị chặn do bấm liên tục (throttled) thì im lặng vì lần bấm trước đã mở rồi.

export interface PurchasePageState {
  open: () => Promise<void>;
  busy: boolean;
  failed: boolean;
}

export function usePurchasePage(): PurchasePageState {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await window.api.openPurchasePage();
      if (!res.ok && !res.throttled) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  return { open, busy, failed };
}
