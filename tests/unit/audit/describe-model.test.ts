import { describe, expect, it } from "vitest";
import { categorizeProvider } from "../../../src/main/services/audit/describe-model";

// T014 (236) — nhóm mô hình theo provider thực tế (R2). LAN được kiểm ở mức unit cho tới khi LAN AI được nối vào chat (F2).

describe("categorizeProvider", () => {
  it.each([
    ["ollama", "local"],
    ["lan-ollama", "lan"],
    ["lan-openai", "lan"],
    ["anthropic", "online"],
    ["openai", "online"],
    ["gemini", "online"],
    ["something-new", "online"],
  ])("%s ⇒ %s", (id, category) => {
    expect(categorizeProvider(id)).toBe(category);
  });
});
