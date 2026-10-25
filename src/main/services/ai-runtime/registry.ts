import type { LLMProvider } from "./provider";

// Quản lý các provider AI (ADR D3). v1 đăng ký 1 provider (Ollama); feature 008 thêm online provider
// qua CÙNG interface — nơi gọi AI chỉ lấy getActive(), không sửa gì (SC-006).
export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private activeId: string | null = null;
  /** #228: provider LAN (Enterprise) ưu tiên hơn active — cùng thứ tự badge riêng tư (lan > online > local). */
  private overrideId: string | null = null;

  register(provider: LLMProvider, opts: { activate?: boolean } = {}): void {
    this.providers.set(provider.id, provider);
    if (opts.activate || this.activeId === null) this.activeId = provider.id;
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider not registered: ${id}`);
    }
    this.activeId = id;
  }

  /** Đặt/gỡ provider ưu tiên (LAN AI). Không đụng activeId ⇒ gỡ LAN thì về đúng provider online/Ollama trước đó. */
  setOverride(id: string | null): void {
    if (id !== null && !this.providers.has(id)) {
      throw new Error(`Provider not registered: ${id}`);
    }
    this.overrideId = id;
  }

  getActive(): LLMProvider {
    const id = this.overrideId ?? this.activeId;
    if (!id) throw new Error("No provider registered.");
    return this.providers.get(id)!;
  }

  /** Provider theo id (098: lượt "AI cục bộ" lấy thẳng Ollama, không đổi provider đang bật). */
  get(id: string): LLMProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`Provider not registered: ${id}`);
    return p;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}
