import { useEffect, useState } from "react";
import { useT } from "../../shared/i18n/i18n-context";
import type {
  EnterprisePolicy,
  LanAiConfig,
  LicenseStatus,
} from "@shared/ipc/types";

// 228 — Settings section for LAN AI Server connection and Enterprise IT Policy display.

export function SettingsLanAiSection() {
  const t = useT();
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [policy, setPolicy] = useState<EnterprisePolicy | null>(null);
  const [config, setConfig] = useState<LanAiConfig>({
    enabled: false,
    provider: "lan-ollama",
    baseUrl: "",
    chatModel: null,
    hasCustomToken: false,
  });
  const [tokenInput, setTokenInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    window.api
      .getLicenseStatus()
      .then(setLicense)
      .catch(() => {});
    window.api
      .getPolicy()
      .then(setPolicy)
      .catch(() => {});
    window.api
      .getLanAiConfig()
      .then((c) => {
        setConfig(c);
      })
      .catch(() => {});

    const unsubscribe = window.api.onLicenseChanged((st) => setLicense(st));
    return unsubscribe;
  }, []);

  const isEnterprise =
    license?.tier === "enterprise" ||
    license?.entitlements.features.includes("lanAi");

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await window.api.testLanAiConnection({
        provider: config.provider,
        baseUrl: config.baseUrl,
        token: tokenInput || undefined,
      });
      if (res.ok) {
        setTestResult({
          ok: true,
          message: t.t("settings.lanAi.testSuccess", {
            modelCount: res.models?.length ?? 0,
          }),
        });
      } else {
        setTestResult({
          ok: false,
          message: t.t("settings.lanAi.testFailed", {
            error: res.error ?? "Unknown",
          }),
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: t.t("settings.lanAi.testFailed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus(null);
    try {
      await window.api.saveLanAiConfig({
        enabled: config.enabled,
        provider: config.provider,
        baseUrl: config.baseUrl,
        chatModel: config.chatModel,
        token: tokenInput ? tokenInput : undefined,
      });
      setSaveStatus(t.t("settings.lanAi.savedSuccess"));
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      className="settings-section rounded-lg border border-border bg-card p-5 mb-6"
      data-testid="settings-lan-ai-section"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <span>🛡️</span>
          {t.t("settings.lanAi.title")}
        </h3>
        {!isEnterprise && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
            {t.t("settings.lanAi.requireEnterpriseBadge")}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        {t.t("settings.lanAi.description")}
      </p>

      {policy && (
        <div className="mb-4 p-3 bg-muted/60 rounded border border-border text-xs">
          <p className="font-medium text-foreground">
            🏢 {t.t("settings.lanAi.policyLocked")} ({policy.organization})
          </p>
          {policy.forceLocalOnly && (
            <p className="text-muted-foreground mt-1">
              •{" "}
              {t.t("errors.policyCloudDisabled", { org: policy.organization })}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={!isEnterprise}
            onChange={(e) =>
              setConfig({ ...config, enabled: e.target.checked })
            }
            className="rounded border-border text-primary"
            data-testid="lan-ai-enabled-toggle"
          />
          <span className="font-medium">
            {t.t("settings.lanAi.enabledLabel")}
          </span>
        </label>

        {config.enabled && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t.t("settings.lanAi.providerLabel")}
              </label>
              <select
                value={config.provider}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    provider: e.target.value as "lan-ollama" | "lan-openai",
                  })
                }
                className="w-full text-sm rounded bg-background border border-border p-2 text-foreground"
              >
                <option value="lan-ollama">
                  {t.t("settings.lanAi.providerOllama")}
                </option>
                <option value="lan-openai">
                  {t.t("settings.lanAi.providerOpenAi")}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t.t("settings.lanAi.baseUrlLabel")}
              </label>
              <input
                type="text"
                value={config.baseUrl}
                placeholder={t.t("settings.lanAi.baseUrlPlaceholder")}
                onChange={(e) =>
                  setConfig({ ...config, baseUrl: e.target.value })
                }
                className="w-full text-sm rounded bg-background border border-border p-2 text-foreground"
                data-testid="lan-ai-base-url-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t.t("settings.lanAi.tokenLabel")}
              </label>
              <input
                type="password"
                value={tokenInput}
                placeholder={
                  config.hasCustomToken
                    ? t.t("settings.lanAi.tokenSavedPlaceholder")
                    : t.t("settings.lanAi.tokenPlaceholder")
                }
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full text-sm rounded bg-background border border-border p-2 text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t.t("settings.lanAi.modelLabel")}
              </label>
              <input
                type="text"
                value={config.chatModel ?? ""}
                placeholder={t.t("settings.lanAi.modelPlaceholder")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    chatModel: e.target.value ? e.target.value : null,
                  })
                }
                className="w-full text-sm rounded bg-background border border-border p-2 text-foreground"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !config.baseUrl}
                className="px-3 py-1.5 text-xs font-medium rounded border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
              >
                {testing
                  ? t.t("settings.lanAi.testingBtn")
                  : t.t("settings.lanAi.testBtn")}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!isEnterprise}
                className="px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {t.t("settings.lanAi.saveBtn")}
              </button>
            </div>

            {testResult && (
              <p
                className={`text-xs mt-2 ${
                  testResult.ok
                    ? "text-green-600 dark:text-green-400"
                    : "text-destructive"
                }`}
              >
                {testResult.message}
              </p>
            )}

            {saveStatus && (
              <p className="text-xs text-muted-foreground mt-2">{saveStatus}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
