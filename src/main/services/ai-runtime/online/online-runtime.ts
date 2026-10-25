import { UserFacingError } from "@shared/codes/user-error";
import type {
  OnlineProviderId,
  OnlineProviderView,
  OnlineState,
  RuntimeStatus,
  SetProviderKeyInput,
  SetProviderModelInput,
} from "@shared/ipc/types";
import type { PolicyService } from "../../policy/policy-service";
import type { LLMProvider } from "../provider";
import type { ProviderRegistry } from "../registry";
import type { StoreLike } from "../model-selection";
import type { SecretStore } from "./secret-store";
import {
  getOnlineConfig,
  setOnlineConfig,
  validOnlineModel,
  type OnlineConfig,
} from "./online-config";
import {
  MODEL_PRESETS,
  ONLINE_PROVIDER_IDS,
  PROVIDER_LABELS,
  isOnlineProviderId,
} from "./presets";
import { AnthropicProvider } from "./anthropic-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";

// Vận hành khu vực AI online (031): đăng ký 3 provider vào registry, quản lý key(keytar)/model/active
// (electron-store), và giữ badge riêng tư đồng bộ. 1 active toàn app, độc quyền (quyết định #3): bật 1
// online → registry.setActive(id) + privacy online; null → về ollama + privacy local.

const LOCAL_ID = "ollama";
const MAX_KEY_LEN = 500;

export interface OnlineRuntimeDeps {
  store: StoreLike;
  secretStore: SecretStore;
  registry: ProviderRegistry;
  fetchFn: typeof fetch;
  /** Cập nhật cờ privacy (true = có provider online active → badge 'online'). */
  onActiveChange: (onlineActive: boolean) => void;
  timeoutMs?: number;
  /** 228 (SC-003): chính sách IT — forceLocalOnly khoá mọi provider đám mây công cộng ở main. */
  policy?: Pick<PolicyService, "isCloudDisabled" | "getPolicy">;
}

export interface OnlineRuntime {
  getOnlineState(): Promise<OnlineState>;
  setProviderKey(input: SetProviderKeyInput): Promise<OnlineState>;
  deleteProviderKey(id: OnlineProviderId): Promise<OnlineState>;
  setProviderModel(input: SetProviderModelInput): Promise<OnlineState>;
  setActiveProvider(id: OnlineProviderId | null): Promise<OnlineState>;
  testProvider(id: OnlineProviderId): Promise<RuntimeStatus>;
  /** Áp active từ config lúc khởi động (nếu provider active không có key → về local). */
  syncActiveFromConfig(): Promise<void>;
}

export function createOnlineRuntime(deps: OnlineRuntimeDeps): OnlineRuntime {
  const { store, secretStore, registry, fetchFn, onActiveChange } = deps;

  // 3 provider instance (giữ tham chiếu để test provider không-active). Đăng ký vào registry (không
  // activate → ollama vẫn là active mặc định).
  const providers = new Map<OnlineProviderId, LLMProvider>();
  const makeDeps = (id: OnlineProviderId) => ({
    getKey: () => secretStore.getKey(id),
    getModel: () => getOnlineConfig(store).models[id],
    fetchFn,
    timeoutMs: deps.timeoutMs,
  });
  providers.set("anthropic", new AnthropicProvider(makeDeps("anthropic")));
  providers.set("gemini", new GeminiProvider(makeDeps("gemini")));
  providers.set("openai", new OpenAIProvider(makeDeps("openai")));
  for (const p of providers.values()) registry.register(p);

  // Tên tổ chức khoá AI đám mây (forceLocalOnly), null = không khoá. Đọc mỗi lần — policy tự cache.
  function cloudLockedBy(): string | null {
    if (!deps.policy?.isCloudDisabled()) return null;
    return deps.policy.getPolicy()?.organization ?? "";
  }

  function assertCloudAllowed(): void {
    const org = cloudLockedBy();
    if (org !== null) throw new UserFacingError("policyCloudDisabled", { org });
  }

  function applyActive(config: OnlineConfig): void {
    const id = config.activeOnlineId;
    registry.setActive(id ?? LOCAL_ID);
    onActiveChange(id !== null);
  }

  async function buildState(): Promise<OnlineState> {
    const config = getOnlineConfig(store);
    const views: OnlineProviderView[] = [];
    for (const id of ONLINE_PROVIDER_IDS) {
      views.push({
        id,
        label: PROVIDER_LABELS[id],
        hasKey: await secretStore.hasKey(id),
        model: config.models[id],
        presets: MODEL_PRESETS[id],
        active: config.activeOnlineId === id,
      });
    }
    return {
      providers: views,
      activeOnlineId: config.activeOnlineId,
      cloudLockedBy: cloudLockedBy(),
    };
  }

  return {
    getOnlineState: buildState,

    async setProviderKey(input) {
      if (
        !isOnlineProviderId(input?.id) ||
        typeof input?.apiKey !== "string" ||
        input.apiKey.trim() === "" ||
        input.apiKey.length > MAX_KEY_LEN
      ) {
        throw new UserFacingError("apiKeyInvalidInput");
      }
      await secretStore.setKey(input.id, input.apiKey.trim());
      return buildState();
    },

    async deleteProviderKey(id) {
      if (!isOnlineProviderId(id)) throw new Error("Invalid provider.");
      await secretStore.deleteKey(id);
      // Xoá key của provider đang active → không dùng được nữa → về local.
      const config = getOnlineConfig(store);
      if (config.activeOnlineId === id) {
        applyActive(
          setOnlineConfig(store, { ...config, activeOnlineId: null }),
        );
      }
      return buildState();
    },

    async setProviderModel(input) {
      if (!isOnlineProviderId(input?.id)) {
        throw new Error("Invalid provider.");
      }
      const model = input.model === null ? null : validOnlineModel(input.model);
      const config = getOnlineConfig(store);
      setOnlineConfig(store, {
        ...config,
        models: { ...config.models, [input.id]: model },
      });
      return buildState();
    },

    async setActiveProvider(id) {
      if (id !== null && !isOnlineProviderId(id)) {
        throw new Error("Invalid provider.");
      }
      // 228: policy khoá đám mây → chặn TRƯỚC kiểm tra key (tắt về local vẫn được).
      if (id !== null) assertCloudAllowed();
      // Bật provider online → yêu cầu đã có key (không bật provider rỗng key).
      if (id !== null && !(await secretStore.hasKey(id))) {
        throw new UserFacingError("apiKeyMissing", {
          provider: PROVIDER_LABELS[id],
        });
      }
      const config = getOnlineConfig(store);
      applyActive(setOnlineConfig(store, { ...config, activeOnlineId: id }));
      return buildState();
    },

    async testProvider(id) {
      if (!isOnlineProviderId(id)) {
        return {
          reachable: false,
          ollamaReady: false,
          reason: "Invalid provider.",
        };
      }
      assertCloudAllowed(); // 228: kiểm tra kết nối cũng là egress ra đám mây.
      return providers.get(id)!.test();
    },

    async syncActiveFromConfig() {
      const config = getOnlineConfig(store);
      if (config.activeOnlineId === null) {
        applyActive(config);
        return;
      }
      // Provider active nhưng mất key (VD keychain bị xoá) hoặc policy IT khoá đám mây (228) → về local
      // để badge không lệch và không có egress.
      if (
        cloudLockedBy() === null &&
        (await secretStore.hasKey(config.activeOnlineId))
      ) {
        applyActive(config);
      } else {
        applyActive(
          setOnlineConfig(store, { ...config, activeOnlineId: null }),
        );
      }
    },
  };
}
