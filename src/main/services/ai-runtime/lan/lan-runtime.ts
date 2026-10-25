import type {
  LanAiConfig,
  LanAiProviderKind,
  PreconfiguredLanAi,
} from "@shared/ipc/types";
import type { StoreLike } from "../model-selection";
import type { ProviderRegistry } from "../registry";
import { validateLanUrl } from "./lan-guard";
import { LanProvider, type LanSettings } from "./lan-provider";

// #228 — vận hành LAN AI: đăng ký 2 provider (lan-ollama / lan-openai) và giữ "provider thật" khớp badge riêng tư.
// sync(): LAN bật + còn bản quyền Enterprise + URL qua SSRF guard ⇒ registry.setOverride(kind) + cờ privacy lan;
// ngược lại gỡ override (về đúng provider online/Ollama đang bật). Nhánh "AI cục bộ" (098) lấy thẳng Ollama — không đổi.

const LAN_KINDS: readonly LanAiProviderKind[] = ["lan-ollama", "lan-openai"];

export interface LanRuntimeDeps {
  store: StoreLike;
  registry: ProviderRegistry;
  /** Bản quyền có tính năng lanAi (Enterprise). */
  hasLicense: () => boolean;
  getAllowedHosts: () => readonly string[];
  getPolicyDefault: () => PreconfiguredLanAi | null;
  fetchFn: typeof fetch;
  /** Cập nhật cờ privacy (true ⇒ badge 'lan'). */
  onActiveChange: (active: boolean) => void;
  egress: <T>(fn: () => Promise<T>) => Promise<T>;
  timeoutMs?: number;
}

export interface LanRuntime {
  /** Cấu hình hiệu lực: đã lưu ở store, thiếu thì lấy preconfiguredLanAi của policy. */
  getConfig(): LanAiConfig;
  /** Áp cấu hình vào registry + badge. Trả true nếu LAN đang thực sự trả lời. */
  sync(): boolean;
}

export function createLanRuntime(deps: LanRuntimeDeps): LanRuntime {
  const { store, registry } = deps;

  function getConfig(): LanAiConfig {
    const raw = store.get("lanAi.config") as
      Record<string, unknown> | undefined;
    const policyDefault = deps.getPolicyDefault();
    return {
      enabled:
        typeof raw?.["enabled"] === "boolean"
          ? raw["enabled"]
          : (policyDefault?.enabled ?? false),
      provider:
        raw?.["provider"] === "lan-openai"
          ? "lan-openai"
          : raw?.["provider"] === "lan-ollama"
            ? "lan-ollama"
            : (policyDefault?.provider ?? "lan-ollama"),
      baseUrl:
        typeof raw?.["baseUrl"] === "string"
          ? raw["baseUrl"]
          : (policyDefault?.baseUrl ?? ""),
      chatModel:
        typeof raw?.["chatModel"] === "string"
          ? raw["chatModel"]
          : (policyDefault?.chatModel ?? null),
      hasCustomToken: Boolean(store.get("lanAi.hasToken")),
    };
  }

  // Token đọc như cũ (electron-store "lanAi.token"); đọc lại mỗi lệnh gọi ⇒ lưu cấu hình mới có hiệu lực ngay.
  const getSettings = (): LanSettings => {
    const c = getConfig();
    const token = store.get("lanAi.token");
    return {
      baseUrl: c.baseUrl,
      chatModel: c.chatModel,
      token: typeof token === "string" && token ? token : null,
    };
  };

  for (const kind of LAN_KINDS) {
    registry.register(
      new LanProvider({
        kind,
        getSettings,
        getAllowedHosts: deps.getAllowedHosts,
        fetchFn: deps.fetchFn,
        egress: deps.egress,
        timeoutMs: deps.timeoutMs,
      }),
    );
  }

  return {
    getConfig,
    sync() {
      const c = getConfig();
      const active =
        c.enabled &&
        deps.hasLicense() &&
        validateLanUrl(c.baseUrl, deps.getAllowedHosts()).ok;
      registry.setOverride(active ? c.provider : null);
      deps.onActiveChange(active);
      return active;
    },
  };
}
