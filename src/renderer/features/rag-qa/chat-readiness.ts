import type { RuntimeStatus } from "@shared/ipc/types";
import { isChatReady } from "../ai-runtime/runtime-status-store";

export { isChatReady };

// Cổng gửi của Chat: theo provider SẼ trả lời (activeReady do main điền — LAN/online/Ollama); main cũ không điền ⇒
// quay về ollamaReady. localReady = Ollama cục bộ — điều kiện riêng cho nút "Trả lời bằng AI cục bộ" (098).

export type ChatBlockKey = "chat.blockRuntime" | "chat.blockActiveProvider";

export interface ChatReadiness {
  ready: boolean | null;
  localReady: boolean | null;
  blockKey: ChatBlockKey | null;
}

export function chatReadiness(status: RuntimeStatus | null): ChatReadiness {
  if (!status) return { ready: null, localReady: null, blockKey: null };
  const ready = isChatReady(status);
  const viaOllama =
    status.activeProviderId === undefined ||
    status.activeProviderId === "ollama";
  return {
    ready,
    localReady: status.ollamaReady,
    blockKey: ready
      ? null
      : viaOllama
        ? "chat.blockRuntime"
        : "chat.blockActiveProvider",
  };
}
