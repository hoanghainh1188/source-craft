import type { ParsedIpcError } from "@shared/online-error-tag";
import { useT } from "../../shared/i18n/i18n-context";
import { isUpsellCode } from "./upsell-codes";
import { usePurchasePage } from "./usePurchasePage";
import "./license-upsell.css";

// 237 — đặt NGAY SAU câu báo lỗi ở nơi thao tác bị chặn (tạo notebook, thêm nguồn, Studio). Lỗi không phải
// hạn mức bản quyền ⇒ không render gì, nên nơi gọi chỉ cần truyền nguyên lỗi đang hiển thị.

interface UpgradePromptProps {
  error: ParsedIpcError | null | undefined;
}

export function UpgradePrompt({
  error,
}: UpgradePromptProps): JSX.Element | null {
  const t = useT();
  const { open, busy, failed } = usePurchasePage();

  if (!isUpsellCode(error?.code)) return null;

  return (
    <div className="upgrade-prompt" data-testid="upgrade-prompt">
      <p className="upgrade-prompt-text">
        {t.t("settings.license.upsellText")}
      </p>
      <button
        type="button"
        className="upgrade-prompt-btn"
        disabled={busy}
        onClick={() => void open()}
        data-testid="upgrade-prompt-buy"
      >
        {t.t("settings.license.upsellBtn")}
        <span className="upgrade-prompt-ext" aria-hidden="true">
          ↗
        </span>
      </button>
      {failed && (
        <p
          className="upgrade-prompt-failed"
          role="alert"
          data-testid="purchase-open-failed"
        >
          {t.t("settings.license.purchaseOpenFailed")}
        </p>
      )}
    </div>
  );
}
