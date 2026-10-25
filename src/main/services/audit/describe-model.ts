import type { AuditModelCategory } from "./audit-types";

// 236 — nhóm mô hình theo provider THỰC TẾ được pickProvider chọn lúc gọi (R2). Id lạ ⇒ "online" (an toàn: coi là rời máy).

export function categorizeProvider(providerId: string): AuditModelCategory {
  if (providerId === "ollama") return "local";
  if (providerId === "lan-ollama" || providerId === "lan-openai") return "lan";
  return "online";
}
