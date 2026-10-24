import { describe, expect, it } from "vitest";
import { UserFacingError } from "@shared/codes/user-error";
import {
  assertCanAddSource,
  assertCanCreateNotebook,
  assertCanGenerateStudio,
  createFeatureGate,
  entitlementsFor,
  FREE_MAX_MEETING_SECONDS,
  FREE_MAX_NOTEBOOKS,
  FREE_MAX_SOURCES_PER_NOTEBOOK,
} from "../../../src/main/services/license/feature-gate";
import { feed, harness, startSession } from "../helpers/meeting-harness";

describe("feature-gate & entitlements matrix", () => {
  it("computes Free tier entitlements with strict caps and basic formats", () => {
    const ent = entitlementsFor("free");
    expect(ent.tier).toBe("free");
    expect(ent.maxNotebooks).toBe(FREE_MAX_NOTEBOOKS); // 3
    expect(ent.maxSourcesPerNotebook).toBe(FREE_MAX_SOURCES_PER_NOTEBOOK); // 10
    expect(ent.maxMeetingSeconds).toBe(FREE_MAX_MEETING_SECONDS); // 900 (15m)
    expect(ent.allowedSourceKinds).toEqual(["pdf", "docx", "txt", "md", "url"]);
    expect(ent.allowedStudioKinds).toEqual(["summary", "keyPoints"]);
    expect(ent.features).toEqual([]);
  });

  it("computes Pro tier entitlements with unlimited notebooks/sources, multimedia, and all 9 Studio kinds", () => {
    const ent = entitlementsFor("pro");
    expect(ent.tier).toBe("pro");
    expect(ent.maxNotebooks).toBeNull();
    expect(ent.maxSourcesPerNotebook).toBeNull();
    expect(ent.maxMeetingSeconds).toBeNull();
    expect(ent.allowedSourceKinds).toContain("audio");
    expect(ent.allowedSourceKinds).toContain("video");
    expect(ent.allowedSourceKinds).toContain("image");
    expect(ent.allowedStudioKinds).toHaveLength(9);
    expect(ent.allowedStudioKinds).toContain("custom");
    expect(ent.features).toEqual([
      "multimedia",
      "studioPro",
      "meetingLong",
      "sharedNotebooks",
      "crossNotebookSearch",
    ]);
  });

  it("computes Enterprise tier entitlements including B2B flags (lanAi, sharedNotebooks, itPolicy)", () => {
    const ent = entitlementsFor("enterprise");
    expect(ent.tier).toBe("enterprise");
    expect(ent.maxNotebooks).toBeNull();
    expect(ent.features).toEqual([
      "multimedia",
      "studioPro",
      "meetingLong",
      "lanAi",
      "sharedNotebooks",
      "itPolicy",
      "crossNotebookSearch",
    ]);
  });

  it("enforces notebook limit on Free tier and unlocks on Pro/Enterprise", () => {
    const freeEnt = entitlementsFor("free");
    expect(() => assertCanCreateNotebook(freeEnt, 0)).not.toThrow();
    expect(() => assertCanCreateNotebook(freeEnt, 2)).not.toThrow();
    expect(() => assertCanCreateNotebook(freeEnt, 3)).toThrowError(
      UserFacingError,
    );
    try {
      assertCanCreateNotebook(freeEnt, 3);
    } catch (e) {
      expect((e as UserFacingError).code).toBe("licenseLimitNotebooks");
      expect((e as UserFacingError).params).toEqual({ max: 3 });
    }

    const proEnt = entitlementsFor("pro");
    expect(() => assertCanCreateNotebook(proEnt, 100)).not.toThrow();
  });

  it("enforces source count and multimedia format restrictions on Free tier", () => {
    const freeEnt = entitlementsFor("free");
    expect(() => assertCanAddSource(freeEnt, 9, "pdf")).not.toThrow();
    expect(() => assertCanAddSource(freeEnt, 10, "pdf")).toThrowError(
      UserFacingError,
    );
    try {
      assertCanAddSource(freeEnt, 10, "pdf");
    } catch (e) {
      expect((e as UserFacingError).code).toBe("licenseLimitSources");
      expect((e as UserFacingError).params).toEqual({ max: 10 });
    }

    // Multimedia blocked even when count < 10
    for (const kind of ["audio", "video", "image"] as const) {
      expect(() => assertCanAddSource(freeEnt, 0, kind)).toThrowError(
        UserFacingError,
      );
      try {
        assertCanAddSource(freeEnt, 0, kind);
      } catch (e) {
        expect((e as UserFacingError).code).toBe("licenseRequireProFormat");
        expect((e as UserFacingError).params).toEqual({ kind });
      }
    }

    // Pro unlocks both count and multimedia
    const proEnt = entitlementsFor("pro");
    expect(() => assertCanAddSource(proEnt, 50, "audio")).not.toThrow();
    expect(() => assertCanAddSource(proEnt, 50, "video")).not.toThrow();
    expect(() => assertCanAddSource(proEnt, 50, "image")).not.toThrow();
  });

  it("enforces Studio synthesis kind restrictions on Free tier", () => {
    const freeEnt = entitlementsFor("free");
    expect(() => assertCanGenerateStudio(freeEnt, "summary")).not.toThrow();
    expect(() => assertCanGenerateStudio(freeEnt, "keyPoints")).not.toThrow();

    for (const kind of [
      "faq",
      "outline",
      "studyGuide",
      "briefing",
      "timeline",
      "keyTerms",
      "custom",
    ] as const) {
      try {
        assertCanGenerateStudio(freeEnt, kind);
        expect.unreachable("Should have thrown licenseRequireProStudio");
      } catch (e) {
        expect((e as UserFacingError).code).toBe("licenseRequireProStudio");
        expect((e as UserFacingError).params).toEqual({ kind });
      }
    }

    const entEnt = entitlementsFor("enterprise");
    expect(() => assertCanGenerateStudio(entEnt, "custom")).not.toThrow();
    expect(() => assertCanGenerateStudio(entEnt, "studyGuide")).not.toThrow();
  });

  it("createFeatureGate delegates dynamically to current entitlements", () => {
    let tier: "free" | "pro" | "enterprise" = "free";
    const gate = createFeatureGate(() => entitlementsFor(tier));

    expect(gate.getEntitlements().maxMeetingSeconds).toBe(900);
    expect(() => gate.assertCanCreateNotebook(3)).toThrowError(UserFacingError);

    tier = "enterprise";
    expect(gate.getEntitlements().maxMeetingSeconds).toBeNull();
    expect(() => gate.assertCanCreateNotebook(3)).not.toThrow();
    expect(gate.hasFeature("lanAi")).toBe(true);
  });

  it("auto-stops active meeting recording with endReason='limitReached' and finalizes transcript when maxDurationSec is reached", async () => {
    const h = harness({ maxDurationSec: () => 5 });
    const { sessionId, sourceId } = await startSession(h);

    // Feed 4 seconds -> still recording
    const seq = feed(h, sessionId, 4, 0);
    expect(h.svc.status()?.phase).toBe("recording");

    // Feed 5th second -> hits maxDurationSec (5s) -> auto-stops with endReason: "limitReached" and finalizes!
    feed(h, sessionId, 1, seq);
    await h.idle();

    const lastPush = h.pushes[h.pushes.length - 1];
    expect(lastPush?.endReason).toBe("limitReached");
    expect(h.repo.get(sourceId)?.phase).toBe("done");
    expect(h.ingested).toHaveLength(1);
    expect(h.ingested[0]?.sourceId).toBe(sourceId);
  });
});
