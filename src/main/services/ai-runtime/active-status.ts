import type { RuntimeStatus } from "@shared/ipc/types";
import type { ProviderRegistry } from "./registry";

// Cổng Chat theo provider SẼ trả lời (registry.getActive()), không riêng Ollama cục bộ: máy chỉ có máy chủ LAN của tổ
// chức (#228) hoặc provider online vẫn hỏi đáp được. Trạng thái Ollama giữ nguyên (onboarding + nhánh "AI cục bộ" 098).

export async function withActiveStatus(
  registry: ProviderRegistry,
  local: RuntimeStatus,
): Promise<RuntimeStatus> {
  const active = registry.getActive();
  if (active.id === "ollama") {
    return {
      ...local,
      activeProviderId: active.id,
      activeReady: local.ollamaReady,
    };
  }
  let activeReady = false;
  try {
    const s = await (active.readiness ? active.readiness() : active.test());
    activeReady = s.ollamaReady;
  } catch {
    activeReady = false;
  }
  return { ...local, activeProviderId: active.id, activeReady };
}
