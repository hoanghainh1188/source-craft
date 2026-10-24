import { UserFacingError } from "@shared/codes/user-error";
import type {
  Entitlements,
  LicenseFeature,
  LicenseTier,
  SourceKind,
  StudioKind,
} from "@shared/ipc/types";
import { STUDIO_ALL_KINDS } from "../studio/constants";

// 226 — Pure tier -> Entitlements calculation and main-process enforcement guards.

export const FREE_MAX_NOTEBOOKS = 3;
export const FREE_MAX_SOURCES_PER_NOTEBOOK = 10;
export const FREE_MAX_MEETING_SECONDS = 900; // 15 minutes

export const FREE_ALLOWED_SOURCE_KINDS: readonly SourceKind[] = [
  "pdf",
  "docx",
  "txt",
  "md",
  "url",
];

export const PRO_ALLOWED_SOURCE_KINDS: readonly SourceKind[] = [
  "pdf",
  "docx",
  "txt",
  "md",
  "url",
  "audio",
  "video",
  "image",
];

export const FREE_ALLOWED_STUDIO_KINDS: readonly StudioKind[] = [
  "summary",
  "keyPoints",
];

export const DEFAULT_PRO_FEATURES: readonly LicenseFeature[] = [
  "multimedia",
  "studioPro",
  "meetingLong",
  "sharedNotebooks",
];

export const DEFAULT_ENTERPRISE_FEATURES: readonly LicenseFeature[] = [
  "multimedia",
  "studioPro",
  "meetingLong",
  "lanAi",
  "sharedNotebooks",
  "itPolicy",
];

/**
 * Computes the effective Entitlements for a given LicenseTier and optional explicit feature list.
 */
export function entitlementsFor(
  tier: LicenseTier,
  explicitFeatures?: readonly LicenseFeature[],
): Entitlements {
  if (tier === "free") {
    return {
      tier: "free",
      maxNotebooks: FREE_MAX_NOTEBOOKS,
      maxSourcesPerNotebook: FREE_MAX_SOURCES_PER_NOTEBOOK,
      maxMeetingSeconds: FREE_MAX_MEETING_SECONDS,
      allowedSourceKinds: [...FREE_ALLOWED_SOURCE_KINDS],
      allowedStudioKinds: [...FREE_ALLOWED_STUDIO_KINDS],
      features: [],
    };
  }

  const defaultFeatures =
    tier === "enterprise" ? DEFAULT_ENTERPRISE_FEATURES : DEFAULT_PRO_FEATURES;
  const features = explicitFeatures
    ? Array.from(new Set([...defaultFeatures, ...explicitFeatures]))
    : [...defaultFeatures];

  return {
    tier,
    maxNotebooks: null,
    maxSourcesPerNotebook: null,
    maxMeetingSeconds: null,
    allowedSourceKinds: [...PRO_ALLOWED_SOURCE_KINDS],
    allowedStudioKinds: [...STUDIO_ALL_KINDS],
    features,
  };
}

/**
 * Throws UserFacingError("licenseLimitNotebooks") if currentNotebookCount >= maxNotebooks.
 */
export function assertCanCreateNotebook(
  entitlements: Entitlements,
  currentNotebookCount: number,
): void {
  if (
    entitlements.maxNotebooks !== null &&
    currentNotebookCount >= entitlements.maxNotebooks
  ) {
    throw new UserFacingError("licenseLimitNotebooks", {
      max: entitlements.maxNotebooks,
    });
  }
}

/**
 * Throws UserFacingError("licenseRequireProFormat") if kind is not allowed,
 * or UserFacingError("licenseLimitSources") if currentSourceCount >= maxSourcesPerNotebook.
 */
export function assertCanAddSource(
  entitlements: Entitlements,
  currentSourceCount: number,
  kind: SourceKind,
): void {
  if (!entitlements.allowedSourceKinds.includes(kind)) {
    throw new UserFacingError("licenseRequireProFormat", { kind });
  }
  if (
    entitlements.maxSourcesPerNotebook !== null &&
    currentSourceCount >= entitlements.maxSourcesPerNotebook
  ) {
    throw new UserFacingError("licenseLimitSources", {
      max: entitlements.maxSourcesPerNotebook,
    });
  }
}

/**
 * Throws UserFacingError("licenseRequireProStudio") if Studio synthesis kind is not allowed.
 */
export function assertCanGenerateStudio(
  entitlements: Entitlements,
  kind: StudioKind,
): void {
  if (!entitlements.allowedStudioKinds.includes(kind)) {
    throw new UserFacingError("licenseRequireProStudio", { kind });
  }
}

export interface FeatureGate {
  getEntitlements(): Entitlements;
  hasFeature(feature: LicenseFeature): boolean;
  assertCanCreateNotebook(currentNotebookCount: number): void;
  assertCanAddSource(currentSourceCount: number, kind: SourceKind): void;
  assertCanGenerateStudio(kind: StudioKind): void;
}

/**
 * Creates a FeatureGate bound to a dynamic entitlements provider.
 */
export function createFeatureGate(
  getEntitlements: () => Entitlements,
): FeatureGate {
  return {
    getEntitlements,
    hasFeature(feature) {
      return getEntitlements().features.includes(feature);
    },
    assertCanCreateNotebook(currentNotebookCount) {
      assertCanCreateNotebook(getEntitlements(), currentNotebookCount);
    },
    assertCanAddSource(currentSourceCount, kind) {
      assertCanAddSource(getEntitlements(), currentSourceCount, kind);
    },
    assertCanGenerateStudio(kind) {
      assertCanGenerateStudio(getEntitlements(), kind);
    },
  };
}
