import type {
  EmbedRequest,
  EmbedResult,
  Model,
  ModelSelection,
  RuntimeStatus,
} from "@shared/ipc/types";
import { createOllamaClient } from "./ollama-client";
import { OllamaProvider } from "./ollama-provider";
import { ProviderRegistry } from "./registry";
import {
  getSelectedModels,
  setSelectedModels,
  type StoreLike,
} from "./model-selection";
import { computeRuntimeStatus } from "./runtime-status";
import { withActiveStatus } from "./active-status";
import { createSecretStore } from "./online/secret-store";
import { loadKeytar } from "./online/keytar-loader";
import {
  createOnlineRuntime,
  type OnlineRuntime,
} from "./online/online-runtime";
import { setOnlineProviderActive } from "../app-shell/privacy-state";
import type { PolicyService } from "../policy/policy-service";

// Ghép runtime AI ở main: Ollama client + registry + model-selection + 3 provider online (031).
// Đây là bề mặt mà IPC handler gọi (renderer chỉ chạm qua kênh ai:* whitelisted).
export interface AiRuntime {
  listModels(): Promise<Model[]>;
  testConnection(): Promise<RuntimeStatus>;
  getSelectedModels(): ModelSelection;
  setSelectedModels(sel: ModelSelection): ModelSelection;
  /** Trạng thái Ollama cục bộ + sẵn sàng của provider đang bật (activeProviderId/activeReady) cho cổng Chat. */
  getRuntimeStatus(): Promise<RuntimeStatus>;
  /** Embedding LUÔN dùng Ollama local (031, quyết định #1) — độc lập provider chat active. */
  embedLocal(req: EmbedRequest): Promise<EmbedResult>;
  registry: ProviderRegistry;
  online: OnlineRuntime;
}

export function createAiRuntime(
  store: StoreLike,
  policy?: PolicyService,
): AiRuntime {
  const client = createOllamaClient();
  const registry = new ProviderRegistry();
  const ollama = new OllamaProvider(client, () => getSelectedModels(store));
  registry.register(ollama); // active mặc định = ollama (local-first).

  const online = createOnlineRuntime({
    store,
    secretStore: createSecretStore(loadKeytar()),
    registry,
    fetchFn: fetch,
    onActiveChange: setOnlineProviderActive,
    policy, // 228: forceLocalOnly khoá AI đám mây ở main.
  });
  // Khôi phục provider active đã lưu (nếu có key) — best-effort, không chặn khởi động.
  void online.syncActiveFromConfig();

  return {
    listModels: () => client.listModels(),
    testConnection: () =>
      computeRuntimeStatus(client, getSelectedModels(store)),
    getSelectedModels: () => getSelectedModels(store),
    setSelectedModels: (sel) => setSelectedModels(store, sel),
    getRuntimeStatus: async () =>
      withActiveStatus(
        registry,
        await computeRuntimeStatus(client, getSelectedModels(store)),
      ),
    embedLocal: (req) => ollama.embed(req),
    registry,
    online,
  };
}
