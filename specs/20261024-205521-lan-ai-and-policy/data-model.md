# Data Model: LAN AI & IT Policy (`lan-ai-and-policy`)

## 1. Enterprise Policy Schema (`EnterprisePolicy`)

```ts
export interface PreconfiguredLanAi {
  enabled: boolean;
  provider: "lan-ollama" | "lan-openai";
  baseUrl: string;
  chatModel?: string;
}

export interface EnterprisePolicy {
  schemaVersion: 1;
  policyId: string;
  organization: string;
  /** When true, disables all commercial cloud AI providers (OpenAI, Anthropic, Gemini). */
  forceLocalOnly: boolean;
  /** Optional extra allowed domain suffixes or exact hostnames for LAN AI SSRF check. */
  allowedLanHosts?: string[];
  /** Optional preconfigured LAN AI server settings provided by IT admin. */
  preconfiguredLanAi?: PreconfiguredLanAi;
  /** Enforces password protection when creating backups. */
  enforceBackupEncryption?: boolean;
}
```

## 2. LAN AI Configuration (`LanAiConfig`)

Lưu trong `electron-store`:
```ts
export interface LanAiConfig {
  enabled: boolean;
  provider: "lan-ollama" | "lan-openai";
  baseUrl: string;
  chatModel: string | null;
  hasCustomToken: boolean;
}
```

## 3. Privacy State Extension (`PrivacyState`)

Mở rộng `PrivacyState` trong `src/shared/ipc/types.ts`:
```ts
export type PrivacyMode = "local" | "lan" | "online" | "sending";

export interface PrivacyState {
  mode: PrivacyMode;
  egressKind?: "ai" | "url" | "model" | "lanAi";
}
```
