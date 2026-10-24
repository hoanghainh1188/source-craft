// 226 — Deterministic canonical JSON serialization for Ed25519 license signing and verification.

/**
 * Recursively sorts object keys in lexicographical order and serializes to a compact JSON string.
 * Array element order is preserved.
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`,
  );
  return `{${entries.join(",")}}`;
}

/**
 * Serializes a LicensePayload into its canonical UTF-8 JSON representation for Ed25519 signing/verification.
 */
export function canonicalizePayload(payload: unknown): string {
  return canonicalizeJson(payload);
}
