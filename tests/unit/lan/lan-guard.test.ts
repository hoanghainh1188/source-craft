import { describe, expect, it } from "vitest";
import { validateLanUrl } from "../../../src/main/services/ai-runtime/lan/lan-guard";

describe("validateLanUrl (SSRF Guard & RFC1918)", () => {
  it("accepts valid RFC1918 Class A IPs (10.0.0.0/8)", () => {
    expect(validateLanUrl("http://10.0.0.1:11434").ok).toBe(true);
    expect(validateLanUrl("http://10.254.1.50:8000").ok).toBe(true);
    expect(validateLanUrl("https://10.10.10.10").ok).toBe(true);
  });

  it("accepts valid RFC1918 Class B IPs (172.16.0.0/12)", () => {
    expect(validateLanUrl("http://172.16.0.1:11434").ok).toBe(true);
    expect(validateLanUrl("http://172.31.255.254:8000").ok).toBe(true);
    // 172.32.x.x is public
    expect(validateLanUrl("http://172.32.0.1:11434").ok).toBe(false);
    // 172.15.x.x is public
    expect(validateLanUrl("http://172.15.0.1:11434").ok).toBe(false);
  });

  it("accepts valid RFC1918 Class C IPs (192.168.0.0/16)", () => {
    expect(validateLanUrl("http://192.168.1.1:11434").ok).toBe(true);
    expect(validateLanUrl("http://192.168.100.200:8000").ok).toBe(true);
    // 192.169.x.x is public
    expect(validateLanUrl("http://192.169.1.1:11434").ok).toBe(false);
  });

  it("accepts localhost and loopback (127.0.0.0/8)", () => {
    expect(validateLanUrl("http://localhost:11434").ok).toBe(true);
    expect(validateLanUrl("http://127.0.0.1:8000").ok).toBe(true);
    expect(validateLanUrl("http://127.0.0.5:11434").ok).toBe(true);
  });

  it("accepts internal domain suffixes (.local, .internal, .lan, .corp)", () => {
    expect(validateLanUrl("http://ai-server.local:11434").ok).toBe(true);
    expect(validateLanUrl("http://gpu01.internal:8000").ok).toBe(true);
    expect(validateLanUrl("http://llm.lan").ok).toBe(true);
    expect(validateLanUrl("https://ai.acme.corp").ok).toBe(true);
  });

  it("accepts extra allowed domain suffixes from Enterprise Policy", () => {
    const extraHosts = ["*.acme-enterprise.com", "deepseek.acme.vn"];
    expect(
      validateLanUrl("http://ai.acme-enterprise.com:8000", extraHosts).ok,
    ).toBe(true);
    expect(validateLanUrl("http://deepseek.acme.vn:11434", extraHosts).ok).toBe(
      true,
    );
    expect(validateLanUrl("http://other.acme.vn:11434", extraHosts).ok).toBe(
      false,
    );
  });

  it("rejects public IPs and non-whitelisted domains", () => {
    expect(validateLanUrl("http://8.8.8.8:11434").ok).toBe(false);
    expect(validateLanUrl("http://1.1.1.1").ok).toBe(false);
    expect(validateLanUrl("https://api.openai.com").ok).toBe(false);
    expect(validateLanUrl("https://google.com").ok).toBe(false);
  });

  it("rejects cloud metadata link-local IP (169.254.169.254) for SSRF protection", () => {
    expect(validateLanUrl("http://169.254.169.254").ok).toBe(false);
    expect(validateLanUrl("http://169.254.1.1").ok).toBe(false);
  });

  it("rejects invalid URLs and non-http/https protocols", () => {
    expect(validateLanUrl("not-a-url").ok).toBe(false);
    expect(validateLanUrl("ftp://192.168.1.1").ok).toBe(false);
    expect(validateLanUrl("file:///etc/passwd").ok).toBe(false);
  });
});
