import { SettingsAiSection } from "../features/ai-runtime/SettingsAiSection";
import { SettingsAiOnlineSection } from "../features/ai-runtime/SettingsAiOnlineSection";
import { SettingsStorageSection } from "../features/app-shell/SettingsStorageSection";
import { SettingsLanguageSection } from "../features/app-shell/SettingsLanguageSection";
import { SettingsLicenseSection } from "../features/app-shell/SettingsLicenseSection";
import { SettingsLanAiSection } from "../features/app-shell/SettingsLanAiSection";
import { useT } from "../shared/i18n/i18n-context";

// 123: trang Cài đặt tách khỏi cấu hình router (router tạo một lần lúc nạp module ⇒ chuỗi phải dịch lúc render).
export function SettingsPage() {
  const t = useT();
  return (
    <section className="settings-page" data-testid="placeholder-settings">
      <h2>{t.t("settings.title")}</h2>
      <SettingsLicenseSection />
      <SettingsLanguageSection />
      <SettingsLanAiSection />
      <SettingsAiSection />
      <SettingsAiOnlineSection />
      <SettingsStorageSection />
    </section>
  );
}
