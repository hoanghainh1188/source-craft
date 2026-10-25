import { describe, expect, it } from "vitest";
import { resolveIdentity } from "../../../src/main/services/audit/identity";

// T012 (236) — tài khoản OS + tên máy (R14). Không bao giờ ném.

const host = () => "BANK-LT-0142";

describe("resolveIdentity", () => {
  it("macOS ⇒ username", () => {
    expect(
      resolveIdentity({
        platform: "darwin",
        userInfo: () => ({ username: "an" }),
        hostname: host,
        env: {},
      }),
    ).toEqual({ osUser: "an", host: "BANK-LT-0142" });
  });

  it("Windows thuộc miền (USERDOMAIN ≠ COMPUTERNAME) ⇒ DOMAIN\\user", () => {
    expect(
      resolveIdentity({
        platform: "win32",
        userInfo: () => ({ username: "nguyen.an" }),
        hostname: host,
        env: { USERDOMAIN: "CORP", COMPUTERNAME: "BANK-LT-0142" },
      }).osUser,
    ).toBe("CORP\\nguyen.an");
  });

  it("Windows không thuộc miền (USERDOMAIN = COMPUTERNAME) ⇒ chỉ user", () => {
    expect(
      resolveIdentity({
        platform: "win32",
        userInfo: () => ({ username: "an" }),
        hostname: host,
        env: { USERDOMAIN: "BANK-LT-0142", COMPUTERNAME: "BANK-LT-0142" },
      }).osUser,
    ).toBe("an");
  });

  it("userInfo ném ⇒ env USER / USERNAME ⇒ 'unknown'; hostname ném ⇒ 'unknown'", () => {
    const boom = () => {
      throw new Error("no passwd entry");
    };
    expect(
      resolveIdentity({
        platform: "linux",
        userInfo: boom,
        hostname: host,
        env: { USER: "ci" },
      }).osUser,
    ).toBe("ci");
    expect(
      resolveIdentity({
        platform: "win32",
        userInfo: boom,
        hostname: host,
        env: { USERNAME: "an" },
      }).osUser,
    ).toBe("an");
    expect(
      resolveIdentity({
        platform: "linux",
        userInfo: boom,
        hostname: boom,
        env: {},
      }),
    ).toEqual({ osUser: "unknown", host: "unknown" });
  });
});
