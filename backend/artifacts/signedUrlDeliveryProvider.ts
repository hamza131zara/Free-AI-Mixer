import {
  isValidProductionArtifactStorageReference,
  type ProductionArtifactStorageReference,
} from "./productionStorageProvider";

export const DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS = 300;
export const MAX_SIGNED_URL_EXPIRES_IN_SECONDS = 300;

export type SignedUrlDeliveryUnavailableReason =
  | "not_configured"
  | "invalid_storage_ref"
  | "unsupported_provider"
  | "invalid_expiry"
  | "provider_unavailable"
  | "signed_url_unavailable";

export interface SignedUrlDeliveryRequest {
  artifactId: string;
  storageRef: ProductionArtifactStorageReference;
  expiresInSeconds?: number;
}

export type SignedUrlDeliveryResult =
  | {
      kind: "unavailable";
      reason: SignedUrlDeliveryUnavailableReason;
    }
  | {
      kind: "ready";
      deliveryMode: "backend_signed_url";
      artifactId: string;
      signedUrl: string;
      expiresAt: string;
    };

export interface SignedUrlDeliveryProvider {
  generateSignedUrl(
    request: SignedUrlDeliveryRequest,
  ): Promise<SignedUrlDeliveryResult>;
}

export const isValidSignedUrlTtlSeconds = (
  expiresInSeconds: number,
): boolean =>
  Number.isInteger(expiresInSeconds) &&
  expiresInSeconds > 0 &&
  expiresInSeconds <= MAX_SIGNED_URL_EXPIRES_IN_SECONDS;

export const resolveSignedUrlExpiresAt = (
  now: Date,
  expiresInSeconds: number = DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS,
): string | undefined => {
  if (!isValidSignedUrlTtlSeconds(expiresInSeconds)) {
    return undefined;
  }

  return new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
};

export const isSignedUrlDeliveryReady = (
  result: SignedUrlDeliveryResult,
): result is Extract<SignedUrlDeliveryResult, { kind: "ready" }> =>
  result.kind === "ready";

export const createSignedUrlDeliveryNotConfiguredProvider =
  (): SignedUrlDeliveryProvider => ({
    generateSignedUrl: async ({ storageRef, expiresInSeconds }) => {
      if (!isValidProductionArtifactStorageReference(storageRef)) {
        return {
          kind: "unavailable",
          reason: "invalid_storage_ref",
        };
      }

      if (
        expiresInSeconds !== undefined &&
        !isValidSignedUrlTtlSeconds(expiresInSeconds)
      ) {
        return {
          kind: "unavailable",
          reason: "invalid_expiry",
        };
      }

      return {
        kind: "unavailable",
        reason: "not_configured",
      };
    },
  });
