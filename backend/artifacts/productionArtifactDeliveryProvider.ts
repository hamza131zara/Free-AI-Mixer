export interface ProductionArtifactDeliveryRequest {
  jobId: string;
  artifactId: string;
  requester: {
    userId: string;
    workspaceId: string;
  };
}

export type ProductionArtifactDeliveryUnavailableReason =
  | "not_configured"
  | "authorization_required"
  | "storage_not_configured"
  | "artifact_not_found"
  | "artifact_not_ready";

export type ProductionArtifactDeliveryResult =
  | {
      kind: "unavailable";
      reason: ProductionArtifactDeliveryUnavailableReason;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_mediated";
      jobId: string;
      artifactId: string;
      expiresAt: string;
    };

export interface ProductionArtifactDeliveryProvider {
  resolveDelivery(
    request: ProductionArtifactDeliveryRequest,
  ): Promise<ProductionArtifactDeliveryResult>;
}

/**
 * Phase 143 provider boundary.
 *
 * This is backend-only and intentionally not wired into routes.
 * The default provider is not configured and never returns a ready delivery.
 *
 * Safety boundaries:
 * - no signed URL generation
 * - no public URL generation
 * - no direct frontend storage access
 * - no service-role shortcut
 * - no local filesystem path exposure
 * - no fake successful delivery
 */
export const createProductionArtifactDeliveryNotConfiguredProvider =
  (): ProductionArtifactDeliveryProvider => ({
    resolveDelivery: async () => ({
      kind: "unavailable",
      reason: "not_configured",
    }),
  });

export const isProductionArtifactDeliveryReady = (
  result: ProductionArtifactDeliveryResult,
): result is Extract<ProductionArtifactDeliveryResult, { kind: "ready" }> =>
  result.kind === "ready";
