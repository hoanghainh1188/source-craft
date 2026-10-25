// 236 — seam e2e (R18a): CHỈ có hiệu lực ở bản chưa đóng gói, cùng mẫu IV_E2E_LICENSE_TIER.
// IV_E2E_POLICY_SYSTEM_PATH: tệp policy "hệ thống" giả (CI không ghi được /Library hay %ProgramData%).
// IV_E2E_AUDIT_KEYSTORE=memory: khoá ký trong bộ nhớ (runner CI không có keychain mở khoá).

export interface AuditTestSeams {
  systemPolicyPath?: string;
  memoryKeystore?: true;
}

export function readAuditTestSeams(input: {
  isPackaged: boolean;
  env: Record<string, string | undefined>;
}): AuditTestSeams {
  if (input.isPackaged) return {};
  const path = input.env["IV_E2E_POLICY_SYSTEM_PATH"]?.trim();
  return {
    ...(path ? { systemPolicyPath: path } : {}),
    ...(input.env["IV_E2E_AUDIT_KEYSTORE"] === "memory"
      ? { memoryKeystore: true as const }
      : {}),
  };
}
