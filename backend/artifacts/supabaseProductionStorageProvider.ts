import {
  isValidProductionArtifactStorageReference,
  type ProductionStorageObjectVerificationResult,
  type ProductionStorageProvider,
} from "./productionStorageProvider";

export interface SupabaseStorageObjectMetadata {
  mimetype?: string;
  size?: number;
  [key: string]: unknown;
}

export interface SupabaseStorageObjectListItem {
  name: string;
  metadata?: SupabaseStorageObjectMetadata | null;
}

export interface SupabaseStorageListResult {
  data: SupabaseStorageObjectListItem[] | null;
  error: { message?: string } | null;
}

export interface SupabaseStorageBucketClient {
  list(
    path: string,
    options: {
      limit: number;
      search: string;
    },
  ): Promise<SupabaseStorageListResult>;
}

export interface SupabaseProductionStorageClient {
  storage: {
    from(bucket: string): SupabaseStorageBucketClient;
  };
}

export interface SupabaseProductionStorageProviderConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  allowedBucket?: string;
  client?: SupabaseProductionStorageClient;
}

const isConfigured = (
  config: SupabaseProductionStorageProviderConfig,
): config is SupabaseProductionStorageProviderConfig & {
  supabaseUrl: string;
  supabaseAnonKey: string;
  allowedBucket: string;
  client: SupabaseProductionStorageClient;
} =>
  Boolean(
    config.supabaseUrl?.trim() &&
      config.supabaseAnonKey?.trim() &&
      config.allowedBucket?.trim() &&
      config.client,
  );

const splitObjectKey = (
  objectKey: string,
): {
  folderPath: string;
  fileName: string;
} => {
  const normalized = objectKey.replace(/^\/+/, "");
  const lastSlashIndex = normalized.lastIndexOf("/");

  if (lastSlashIndex < 0) {
    return {
      folderPath: "",
      fileName: normalized,
    };
  }

  return {
    folderPath: normalized.slice(0, lastSlashIndex),
    fileName: normalized.slice(lastSlashIndex + 1),
  };
};

const buildVerifiedResult = (
  provider: "supabase_storage",
  bucket: string,
  objectKey: string,
  contentType?: string,
  sizeBytes?: number,
): Extract<ProductionStorageObjectVerificationResult, { kind: "verified" }> => {
  const verified: Extract<
    ProductionStorageObjectVerificationResult,
    { kind: "verified" }
  > = {
    kind: "verified",
    provider,
    bucket,
    objectKey,
  };

  if (contentType) {
    verified.contentType = contentType;
  }

  if (typeof sizeBytes === "number") {
    verified.sizeBytes = sizeBytes;
  }

  return verified;
};

/**
 * Phase 171 backend-only Supabase production storage provider.
 *
 * This provider verifies object existence/metadata only.
 *
 * Safety boundaries:
 * - no signed URL generation
 * - no public URL generation
 * - no browser navigation/download
 * - no frontend storage access
 * - no route wiring
 */
export const createSupabaseProductionStorageProvider = (
  config: SupabaseProductionStorageProviderConfig,
): ProductionStorageProvider => ({
  verifyObject: async ({ storageRef }) => {
    if (storageRef.provider !== "supabase_storage") {
      return {
        kind: "unavailable",
        reason: "unsupported_provider",
      };
    }

    if (!isValidProductionArtifactStorageReference(storageRef)) {
      return {
        kind: "unavailable",
        reason: "invalid_storage_ref",
      };
    }

    if (!isConfigured(config)) {
      return {
        kind: "unavailable",
        reason: "not_configured",
      };
    }

    if (storageRef.bucket !== config.allowedBucket) {
      return {
        kind: "unavailable",
        reason: "invalid_storage_ref",
      };
    }

    const { folderPath, fileName } = splitObjectKey(storageRef.objectKey);

    if (!fileName.trim()) {
      return {
        kind: "unavailable",
        reason: "invalid_storage_ref",
      };
    }

    try {
      const result = await config.client.storage
        .from(storageRef.bucket)
        .list(folderPath, {
          limit: 1,
          search: fileName,
        });

      if (result.error) {
        return {
          kind: "unavailable",
          reason: "provider_unavailable",
        };
      }

      const object = result.data?.find((item) => item.name === fileName);

      if (!object) {
        return {
          kind: "unavailable",
          reason: "object_not_found",
        };
      }

      return buildVerifiedResult(
        storageRef.provider,
        storageRef.bucket,
        storageRef.objectKey,
        storageRef.contentType ?? object.metadata?.mimetype,
        storageRef.sizeBytes ?? object.metadata?.size,
      );
    } catch {
      return {
        kind: "unavailable",
        reason: "provider_unavailable",
      };
    }
  },
});
