import { useEffect, useState } from "react";
import type { LicenseFeature, LicenseStatus } from "@shared/ipc/types";

// 231 — bản quyền hiện tại có cờ `feature` không, để khoá trước nút chức năng trả phí (thay vì báo lỗi sau khi
// gửi). Theo dõi onLicenseChanged ⇒ kích hoạt/huỷ bản quyền cập nhật ngay. null = chưa biết (đang đọc hoặc đọc
// lỗi) ⇒ nơi dùng KHÔNG khoá; main vẫn chặn ở IPC (nguồn sự thật).

const hasFeature = (st: LicenseStatus, feature: LicenseFeature): boolean =>
  st.entitlements?.features?.includes(feature) ?? false;

export function useLicenseFeature(feature: LicenseFeature): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    if (typeof window.api?.getLicenseStatus === "function") {
      window.api
        .getLicenseStatus()
        .then((st) => {
          if (alive) setAllowed(hasFeature(st, feature));
        })
        .catch(() => {
          // Giữ null: không khoá nhầm khi không đọc được trạng thái.
        });
    }
    const unsub =
      typeof window.api?.onLicenseChanged === "function"
        ? window.api.onLicenseChanged((st) => {
            if (alive) setAllowed(hasFeature(st, feature));
          })
        : () => {};
    return () => {
      alive = false;
      unsub();
    };
  }, [feature]);

  return allowed;
}
