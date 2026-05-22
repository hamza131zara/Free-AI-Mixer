import {
  createProductionStorageNotConfiguredProvider,
  isProductionStorageObjectVerified,
  isValidProductionArtifactStorageReference,
  type ProductionArtifactStorageReference,
  type ProductionStorageObjectVerificationResult,
  type ProductionStorageProvider,
} from "./productionStorageProvider";

export type ProductionStorageReadinessUnavailableReason =
  | "missing_storage_ref"
  | "invalid_storage_ref"
  | "provider_not_configured"
  | "unsupported_provider"
  | "object_not_found"
  | "provider_unavailable";

export type ProductionStorageReadinessDecision =
  | {
      kind: "unavailable";
      reason: ProductionStorageReadinessUnavailableReason;
      providerConfigured: false;
      providerCanResolve: false;
    }
  | {
      kind: "ready";
      providerConfigured: true;
      providerCanResolve: true;
      verification: Extract<ProductionStorageObjectVerificationResult, { kind: "verified" }>;
    };

export interface ResolveProductionStorageReadinessInput {
  artifactId: string;
  storageRef?: ProductionArtifactStorageReference;
  provider?: ProductionStorageProvider;
}

const mapStorageVerificationUnavailableReason = (
  reason: Exclude<ProductionStorageObjectVerificationResult, { kind: "verified" }>["reason"],
): ProductionStorageReadinessUnavailableReason => {
  if (reason === "not_configured") {
    return "provider_not_configured";
  }

  return reason;
};

/**
 * Phase 167 production storage integration boundary.
 *
 * This helper is backend-only and intentionally not route-wired.
 *
 * Safety boundaries:
 * - no Supabase/S3/R2 provider implementation
 * - no signed URL generation
 * - no public URL generation
 * - no local filesystem path exposure
 * - no service-role shortcut
 * - no frontend storage access
 * - no browser navigation/download
 */
export const resolveProductionStorageReadiness = async ({
  artifactId,
  storageRef,
  provider = createProductionStorageNotConfiguredProvider(),
}: ResolveProductionStorageReadinessInput): Promise<ProductionStorageReadinessDecision> => {
  if (!storageRef) {
    return {
      kind: "unavailable",
      reason: "missing_storage_ref",
      providerConfigured: false,
      providerCanResolve: false,
    };
  }

  if (!isValidProductionArtifactStorageReference(storageRef)) {
    return {
      kind: "unavailable",
      reason: "invalid_storage_ref",
      providerConfigured: false,
      providerCanResolve: false,
    };
  }

  const verification = await provider.verifyObject({
    artifactId,
    storageRef,
  });

  if (!isProductionStorageObjectVerified(verification)) {
    return {
      kind: "unavailable",
      reason: mapStorageVerificationUnavailableReason(verification.reason),
      providerConfigured: false,
      providerCanResolve: false,
    };
  }

  return {
    kind: "ready",
    providerConfigured: true,
    providerCanResolve: true,
    verification,
  };
};
