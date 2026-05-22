export type ProductionStorageProviderKind =
  | "supabase_storage"
  | "s3"
  | "r2";

export interface ProductionArtifactStorageReference {
  provider: ProductionStorageProviderKind;
  bucket: string;
  objectKey: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface ProductionStorageObjectVerificationRequest {
  artifactId: string;
  storageRef: ProductionArtifactStorageReference;
}

export type ProductionStorageObjectVerificationUnavailableReason =
  | "not_configured"
  | "invalid_storage_ref"
  | "unsupported_provider"
  | "object_not_found"
  | "provider_unavailable";

export type ProductionStorageObjectVerificationResult =
  | {
      kind: "unavailable";
      reason: ProductionStorageObjectVerificationUnavailableReason;
    }
  | {
      kind: "verified";
      provider: ProductionStorageProviderKind;
      bucket: string;
      objectKey: string;
      contentType?: string;
      sizeBytes?: number;
    };

export interface ProductionStorageProvider {
  verifyObject(
    request: ProductionStorageObjectVerificationRequest,
  ): Promise<ProductionStorageObjectVerificationResult>;
}

export const isValidProductionArtifactStorageReference = (
  storageRef: ProductionArtifactStorageReference,
): boolean => {
  if (!storageRef.bucket.trim() || !storageRef.objectKey.trim()) {
    return false;
  }

  const unsafeFragments = [
    "..",
    "\\",
    "file://",
    "C:",
    "/Users/",
    "/home/",
    "/tmp/",
    "rootPath",
    "directoryPath",
    "filePath",
    "localPath",
    "filesystemPath",
  ];

  return !unsafeFragments.some((fragment) =>
    storageRef.objectKey.includes(fragment),
  );
};

/**
 * Phase 165 production storage provider boundary.
 *
 * This boundary is backend-only and intentionally not wired into routes.
 *
 * Safety boundaries:
 * - no Supabase/S3/R2 implementation
 * - no signed URL generation
 * - no public URL generation
 * - no local filesystem path exposure
 * - no service-role shortcut
 * - no frontend storage access
 * - no browser navigation/download
 */
export const createProductionStorageNotConfiguredProvider =
  (): ProductionStorageProvider => ({
    verifyObject: async () => ({
      kind: "unavailable",
      reason: "not_configured",
    }),
  });

export const isProductionStorageObjectVerified = (
  result: ProductionStorageObjectVerificationResult,
): result is Extract<ProductionStorageObjectVerificationResult, { kind: "verified" }> =>
  result.kind === "verified";
