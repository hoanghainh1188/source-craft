// 236 — tài khoản OS + tên máy cho bản ghi kiểm toán (R14). Thuần (os tiêm vào); không bao giờ ném.

export interface IdentityDeps {
  platform: NodeJS.Platform;
  userInfo: () => { username: string };
  hostname: () => string;
  env: Record<string, string | undefined>;
}

export interface AuditIdentity {
  osUser: string;
  host: string;
}

function safe(fn: () => string): string | null {
  try {
    const v = fn();
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function resolveIdentity(deps: IdentityDeps): AuditIdentity {
  const { env, platform } = deps;
  const user =
    safe(() => deps.userInfo().username) ??
    env["USER"] ??
    env["USERNAME"] ??
    "unknown";
  const domain = env["USERDOMAIN"];
  const computer = env["COMPUTERNAME"];
  const osUser =
    platform === "win32" && domain && domain !== computer
      ? `${domain}\\${user}`
      : user;
  return { osUser, host: safe(deps.hostname) ?? "unknown" };
}
