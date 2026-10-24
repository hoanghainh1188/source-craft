# Contracts: LAN AI & IT Policy IPC

## 1. Channels (`src/shared/ipc/channels.ts`)

```ts
export const CHANNELS = {
  // Existing ...
  policyGet: "policy:get",
  lanAiGetConfig: "lanAi:getConfig",
  lanAiSaveConfig: "lanAi:saveConfig",
  lanAiTestConnection: "lanAi:testConnection",
  lanAiListModels: "lanAi:listModels",
};
```

## 2. Types & Methods (`src/shared/ipc/types.ts`)

```ts
export interface LanAiTestResult {
  ok: boolean;
  error?: string;
  models?: string[];
}

export interface RendererApi {
  // Existing ...
  getPolicy(): Promise<EnterprisePolicy | null>;
  getLanAiConfig(): Promise<LanAiConfig>;
  saveLanAiConfig(config: {
    enabled: boolean;
    provider: "lan-ollama" | "lan-openai";
    baseUrl: string;
    chatModel: string | null;
    token?: string | null;
  }): Promise<{ ok: boolean; error?: string }>;
  testLanAiConnection(params: {
    provider: "lan-ollama" | "lan-openai";
    baseUrl: string;
    token?: string | null;
  }): Promise<LanAiTestResult>;
}
```

## 3. User Error Codes (`src/shared/codes/user-error.ts`)

- `lanAiInvalidHost`: Địa chỉ máy chủ không thuộc mạng nội bộ hợp lệ (RFC1918).
- `lanAiRequireEnterprise`: Cần bản quyền Enterprise để kích hoạt tính năng kết nối máy chủ AI mạng nội bộ.
- `policyCloudDisabled`: Tính năng Đám mây đã bị vô hiệu hóa theo Chính sách Quản trị của Tổ chức.
