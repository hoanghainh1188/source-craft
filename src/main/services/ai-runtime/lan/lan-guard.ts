// 228 — SSRF Guard & RFC1918 Private Network Validator for LAN AI Server.
// Enforces Constitution Principle I (Local-First & No Default Egress): prevents leaking
// organization data to public cloud hosts unless explicitly allowed.

export interface LanValidationResult {
  ok: boolean;
  normalizedUrl?: string;
  error?:
    | "invalidUrl"
    | "unsupportedProtocol"
    | "publicIpForbidden"
    | "domainNotAllowed";
}

const INTERNAL_DOMAIN_SUFFIXES = [".local", ".internal", ".lan", ".corp"];

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];

  // Loopback (127.0.0.0/8)
  if (a === 127) return true;

  // RFC1918 Class A: 10.0.0.0/8
  if (a === 10) return true;

  // RFC1918 Class B: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // RFC1918 Class C: 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // Cloud metadata / Link-local (169.254.0.0/16) -> Reject for SSRF safety!
  return false;
}

function matchesDomainPattern(hostname: string, pattern: string): boolean {
  const normHost = hostname.toLowerCase();
  const normPat = pattern.toLowerCase();
  if (normPat.startsWith("*.")) {
    const base = normPat.slice(2);
    return normHost === base || normHost.endsWith("." + base);
  }
  return normHost === normPat;
}

/**
 * Validates that an AI server URL points to a private LAN host or allowed corporate domain.
 */
export function validateLanUrl(
  urlString: string,
  extraAllowedHosts: readonly string[] = [],
): LanValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { ok: false, error: "invalidUrl" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "unsupportedProtocol" };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Check localhost / loopback
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { ok: true, normalizedUrl: parsed.origin };
  }

  // 2. Check if IPv4
  const isIpv4Pattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  if (isIpv4Pattern) {
    if (isPrivateIpv4(hostname)) {
      return { ok: true, normalizedUrl: parsed.origin };
    }
    // Check if explicitly whitelisted in extraAllowedHosts
    if (extraAllowedHosts.includes(hostname)) {
      return { ok: true, normalizedUrl: parsed.origin };
    }
    return { ok: false, error: "publicIpForbidden" };
  }

  // 3. Check internal domain suffixes (.local, .internal, etc.)
  for (const suffix of INTERNAL_DOMAIN_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return { ok: true, normalizedUrl: parsed.origin };
    }
  }

  // 4. Check extra policy-allowed domains
  for (const pattern of extraAllowedHosts) {
    if (matchesDomainPattern(hostname, pattern)) {
      return { ok: true, normalizedUrl: parsed.origin };
    }
  }

  return { ok: false, error: "domainNotAllowed" };
}
