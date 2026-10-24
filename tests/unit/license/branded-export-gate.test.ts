import { describe, it, expect } from "vitest";
import { UserFacingError } from "../../../src/shared/codes/user-error";
import {
  createFeatureGate,
  entitlementsFor,
} from "../../../src/main/services/license/feature-gate";
import type { ExportFormat } from "../../../src/shared/ipc/types";

describe("brandedExport license gating (232)", () => {
  function assertExportAllowed(
    format: ExportFormat | undefined,
    gate: ReturnType<typeof createFeatureGate>,
  ): void {
    if (format === "docx" || format === "pdf") {
      if (!gate.hasFeature("brandedExport")) {
        throw new UserFacingError("licenseRequireProExport");
      }
    }
  }

  it("allows markdown export on Free tier", () => {
    const freeGate = createFeatureGate(() => entitlementsFor("free"));
    expect(() => assertExportAllowed("md", freeGate)).not.toThrow();
    expect(() => assertExportAllowed(undefined, freeGate)).not.toThrow();
  });

  it("blocks docx and pdf export on Free tier with licenseRequireProExport", () => {
    const freeGate = createFeatureGate(() => entitlementsFor("free"));

    try {
      assertExportAllowed("docx", freeGate);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UserFacingError);
      expect((err as UserFacingError).code).toBe("licenseRequireProExport");
    }

    try {
      assertExportAllowed("pdf", freeGate);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UserFacingError);
      expect((err as UserFacingError).code).toBe("licenseRequireProExport");
    }
  });

  it("unlocks docx and pdf export on Pro tier", () => {
    const proGate = createFeatureGate(() => entitlementsFor("pro"));
    expect(() => assertExportAllowed("docx", proGate)).not.toThrow();
    expect(() => assertExportAllowed("pdf", proGate)).not.toThrow();
  });

  it("unlocks docx and pdf export on Enterprise tier", () => {
    const entGate = createFeatureGate(() => entitlementsFor("enterprise"));
    expect(() => assertExportAllowed("docx", entGate)).not.toThrow();
    expect(() => assertExportAllowed("pdf", entGate)).not.toThrow();
  });
});
