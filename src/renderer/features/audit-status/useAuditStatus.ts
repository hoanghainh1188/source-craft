import { useEffect, useState } from "react";
import type { AuditStatus } from "@shared/ipc/types";

// 236 (PR C) — trạng thái nhật ký kiểm toán từ main: đọc một lần rồi nghe sự kiện đẩy (theo mẫu PrivacyBadge).
// IPC lỗi ⇒ giữ null (không hiện chip/mục) thay vì đoán trạng thái; main vẫn tự chặn AI khi cần (fail-closed).
export function useAuditStatus(): AuditStatus | null {
  const [status, setStatus] = useState<AuditStatus | null>(null);

  useEffect(() => {
    if (typeof window.api?.auditGetStatus !== "function") return;
    let alive = true;
    // Sự kiện đẩy tới trước khi invoke trả về ⇒ giữ giá trị đẩy (mới hơn), bỏ kết quả invoke.
    let pushed = false;
    const off = window.api.onAuditStatusChanged((s) => {
      pushed = true;
      if (alive) setStatus(s);
    });
    window.api
      .auditGetStatus()
      .then((s) => {
        if (alive && !pushed) setStatus(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
      off();
    };
  }, []);

  return status;
}
