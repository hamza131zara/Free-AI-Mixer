import {
  isValidProductionArtifactStorageReference,
  type ProductionArtifactStorageReference,
} from "./productionStorageProvider";
import {
  DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS,
  MAX_SIGNED_URL_EXPIRES_IN_SECONDS,
  resolveSignedUrlExpiresAt,
  type SignedUrlDeliveryProvider,
  type SignedUrlDeliveryResult,
} from "./signedUrlDeliveryProvider";

export interface SupabaseSignedUrlProviderConfig {
  provider: "supabase_storage";
  bucket: string;
}

export interface SupabaseSignedUrlSignerRequest {
  bucket: string;
  objectKey: string;
  expiresInSeconds: number;
  storageRef: ProductionArtifactStorageReference;
}

export interface SupabaseSignedUrlSignerResult {
  signedUrl?: string | null;
}

export interface SupabaseSignedUrlSigner {
  signObjectUrl(
    request: SupabaseSignedUrlSignerRequest,
  ): Promise<SupabaseSignedUrlSignerResult | null | undefined>;
}

export interface SupabaseSignedUrlDeliveryProviderOptions {
  config?: SupabaseSignedUrlProviderConfig;
  signer?: SupabaseSignedUrlSigner;
  now?: () => Date;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidSupabaseSignedUrlConfig = (
  config: SupabaseSignedUrlProviderConfig | undefined,
): config is SupabaseSignedUrlProviderConfig =>
  config?.provider === "supabase_storage" && isNonEmptyString(config.bucket);

const resolveEffectiveExpiresInSeconds = (
  expiresInSeconds: number | undefined,
): number | undefined => {
  const requestedExpiresInSeconds =
    expiresInSeconds ?? DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS;

  if (
    !Number.isInteger(requestedExpiresInSeconds) ||
    requestedExpiresInSeconds <= 0
  ) {
    return undefined;
  }

  return Math.min(
    requestedExpiresInSeconds,
    MAX_SIGNED_URL_EXPIRES_IN_SECONDS,
  );
};

const isSafeSignedUrl = (signedUrl: string | undefined | null): signedUrl is string => {
  if (!isNonEmptyString(signedUrl)) {
    return false;
  }

  try {
    const parsedUrl = new URL(signedUrl);
    return parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

export const createSupabaseSignedUrlDeliveryProvider = ({
  config,
  signer,
  now = () => new Date(),
}: SupabaseSignedUrlDeliveryProviderOptions = {}): SignedUrlDeliveryProvider => ({
  generateSignedUrl: async ({
    artifactId,
    storageRef,
    expiresInSeconds,
  }): Promise<SignedUrlDeliveryResult> => {
    if (!isValidSupabaseSignedUrlConfig(config)) {
      return {
        kind: "unavailable",
        reason: "not_configured",
      };
    }

    if (!isValidProductionArtifactStorageReference(storageRef)) {
      return {
        kind: "unavailable",
        reason: "invalid_storage_ref",
      };
    }

    if (storageRef.provider !== "supabase_storage") {
      return {
        kind: "unavailable",
        reason: "unsupported_provider",
      };
    }

    if (!isNonEmptyString(storageRef.bucket) || !isNonEmptyString(storageRef.objectKey)) {
      return {
        kind: "unavailable",
        reason: "invalid_storage_ref",
      };
    }

    if (storageRef.bucket !== config.bucket) {
      return {
        kind: "unavailable",
        reason: "invalid_storage_ref",
      };
    }

    const effectiveExpiresInSeconds =
      resolveEffectiveExpiresInSeconds(expiresInSeconds);

    if (effectiveExpiresInSeconds === undefined) {
      return {
        kind: "unavailable",
        reason: "invalid_expiry",
      };
    }

    if (signer === undefined) {
      return {
        kind: "unavailable",
        reason: "provider_unavailable",
      };
    }

    const expiresAt = resolveSignedUrlExpiresAt(
      now(),
      effectiveExpiresInSeconds,
    );

    if (expiresAt === undefined) {
      return {
        kind: "unavailable",
        reason: "invalid_expiry",
      };
    }

    try {
      const result = await signer.signObjectUrl({
        bucket: storageRef.bucket,
        objectKey: storageRef.objectKey,
        expiresInSeconds: effectiveExpiresInSeconds,
        storageRef,
      });

      if (!isSafeSignedUrl(result?.signedUrl)) {
        return {
          kind: "unavailable",
          reason: "signed_url_unavailable",
        };
      }

      return {
        kind: "ready",
        deliveryMode: "backend_signed_url",
        artifactId,
        signedUrl: result.signedUrl,
        expiresAt,
      };
    } catch {
      return {
        kind: "unavailable",
        reason: "provider_unavailable",
      };
    }
  },
});
