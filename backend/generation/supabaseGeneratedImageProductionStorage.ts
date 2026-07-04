import { createHash } from "node:crypto";
import type { SupabaseClientFactoryResult } from "../db/supabaseClientFactory";
import type { GeneratedImageArtifactMetadata } from "./generatedImageArtifactStorage";
import {
  verifyGeneratedImageArtifactBytes,
  type VerifiedGeneratedImageArtifactBytes,
} from "./generatedImageArtifactVerification";
import {
  isSafeGeneratedImageProductionArtifactSegment,
  isSafeGeneratedImageProductionStorageRef,
  type GeneratedImageProductionArtifactRecord,
  type GeneratedImageProductionStorageRef,
} from "./generatedImageProductionArtifactStorageRef";
import type { BackendGenerationArtifactProviderId } from "./generationProviderTypes";

export type GeneratedImageProductionStorageResult =
  | {
      kind: "stored";
      artifact: GeneratedImageArtifactMetadata;
      storageRef: GeneratedImageProductionStorageRef;
    }
  | {
      kind: "unavailable";
      code:
        | "storage_not_configured"
        | "invalid_artifact_identity"
        | "upload_failed"
        | "object_verification_failed";
      message: string;
    };

export type GeneratedImageProductionRecordResult =
  | {
      kind: "resolved";
      record: GeneratedImageProductionArtifactRecord;
    }
  | {
      kind: "unavailable";
      code:
        | "storage_not_configured"
        | "artifact_not_found"
        | "invalid_storage_ref"
        | "provider_unavailable";
      message: string;
    };

export type GeneratedImageProductionReadResult =
  | {
      kind: "read";
      bytes: Uint8Array;
      contentType: "image/png" | "image/jpeg" | "image/webp";
    }
  | {
      kind: "unavailable";
      code:
        | "storage_not_configured"
        | "invalid_storage_ref"
        | "object_not_found"
        | "provider_unavailable";
      message: string;
    };

export type GeneratedImageProductionDeleteResult =
  | { kind: "deleted" }
  | {
      kind: "unavailable";
      code: "storage_not_configured" | "invalid_storage_ref" | "delete_failed";
      message: string;
    };

export type GeneratedImageProductionStorageReadiness =
  | { kind: "ready"; status: "available" }
  | { kind: "unavailable"; status: "storage_not_configured"; message: string };

export interface GeneratedImageProductionStorage {
  getReadiness(): GeneratedImageProductionStorageReadiness;
  store(input: {
    artifactId: string;
    createdAt?: string;
    jobId: string;
    ownerId: string;
    projectId: string;
    providerId: BackendGenerationArtifactProviderId;
    verifiedImage: VerifiedGeneratedImageArtifactBytes;
    workspaceId: string;
  }): Promise<GeneratedImageProductionStorageResult>;
  resolveRecord(input: {
    artifactId: string;
    jobId: string;
    ownerId: string;
    workspaceId: string;
  }): Promise<GeneratedImageProductionRecordResult>;
  readObject(
    storageRef: GeneratedImageProductionStorageRef,
  ): Promise<GeneratedImageProductionReadResult>;
  deleteObject(
    storageRef: GeneratedImageProductionStorageRef,
  ): Promise<GeneratedImageProductionDeleteResult>;
}

export interface SupabaseStorageUploadResult {
  error: { message?: string } | null;
}

export interface SupabaseStorageDownloadResult {
  data: Blob | ArrayBuffer | Uint8Array | null;
  error: { message?: string } | null;
}

export interface SupabaseStorageObjectListItem {
  name: string;
  metadata?: {
    mimetype?: string;
    size?: number;
  } | null;
}

export interface SupabaseStorageListResult {
  data: SupabaseStorageObjectListItem[] | null;
  error: { message?: string } | null;
}

export interface SupabaseGeneratedImageStorageBucketClient {
  download(objectKey: string): Promise<SupabaseStorageDownloadResult>;
  list(
    path: string,
    options: { limit: number; search: string },
  ): Promise<SupabaseStorageListResult>;
  remove?(objectKeys: string[]): Promise<SupabaseStorageUploadResult>;
  upload(
    objectKey: string,
    body: Uint8Array,
    options: {
      cacheControl: string;
      contentType: string;
      upsert: false;
    },
  ): Promise<SupabaseStorageUploadResult>;
}

export interface SupabaseGeneratedImageStorageClient {
  from(table: "generated_artifact_records"): {
    select(columns: string): {
      eq(column: string, value: string): unknown;
      maybeSingle(): Promise<{
        data: Record<string, unknown> | null;
        error: { message?: string } | null;
      }>;
    };
  };
  storage: {
    from(bucket: string): SupabaseGeneratedImageStorageBucketClient;
  };
}

export interface SupabaseGeneratedImageProductionStorageOptions {
  bucket?: string;
  client?: SupabaseGeneratedImageStorageClient;
  now?: () => string;
}

const defaultNow = (): string => new Date().toISOString();

const toStableUuid = (value: string): string => {
  const bytes = Buffer.from(createHash("sha256").update(value).digest("hex"), "hex");

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex").slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

const toGenerationJobId = (input: {
  jobId: string;
  ownerId: string;
  workspaceId: string;
}): string =>
  toStableUuid(`generation_job:${input.workspaceId}:${input.ownerId}:${input.jobId}`);

const unavailable = (
  code: Extract<GeneratedImageProductionStorageResult, { kind: "unavailable" }>["code"],
  message: string,
): GeneratedImageProductionStorageResult => ({
  kind: "unavailable",
  code,
  message,
});

const readUnavailable = (
  code: Extract<GeneratedImageProductionReadResult, { kind: "unavailable" }>["code"],
  message: string,
): GeneratedImageProductionReadResult => ({
  kind: "unavailable",
  code,
  message,
});

const deleteUnavailable = (
  code: Extract<GeneratedImageProductionDeleteResult, { kind: "unavailable" }>[
    "code"
  ],
  message: string,
): GeneratedImageProductionDeleteResult => ({
  kind: "unavailable",
  code,
  message,
});

const recordUnavailable = (
  code: Extract<GeneratedImageProductionRecordResult, { kind: "unavailable" }>["code"],
  message: string,
): GeneratedImageProductionRecordResult => ({
  kind: "unavailable",
  code,
  message,
});

const isConfigured = (
  options: SupabaseGeneratedImageProductionStorageOptions,
): options is SupabaseGeneratedImageProductionStorageOptions & {
  bucket: string;
  client: SupabaseGeneratedImageStorageClient;
} => Boolean(options.bucket?.trim() && options.client);

const isWriteConfigured = (
  options: SupabaseGeneratedImageProductionStorageOptions,
): options is SupabaseGeneratedImageProductionStorageOptions & {
  bucket: string;
  client: SupabaseGeneratedImageStorageClient;
} => {
  if (!isConfigured(options)) {
    return false;
  }

  try {
    return typeof options.client.storage.from(options.bucket).remove === "function";
  } catch {
    return false;
  }
};

const splitObjectKey = (
  objectKey: string,
): { folderPath: string; fileName: string } => {
  const normalized = objectKey.replace(/^\/+/, "");
  const lastSlashIndex = normalized.lastIndexOf("/");

  if (lastSlashIndex < 0) {
    return { fileName: normalized, folderPath: "" };
  }

  return {
    fileName: normalized.slice(lastSlashIndex + 1),
    folderPath: normalized.slice(0, lastSlashIndex),
  };
};

const toBytes = async (
  data: Blob | ArrayBuffer | Uint8Array,
): Promise<Uint8Array> => {
  if (data instanceof Uint8Array) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return new Uint8Array(await data.arrayBuffer());
};

const rowString = (
  row: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = row[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
};

const rowNumber = (
  row: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
};

const isGeneratedImageContentType = (
  value: string | undefined,
): value is "image/png" | "image/jpeg" | "image/webp" =>
  value === "image/png" || value === "image/jpeg" || value === "image/webp";

const removeStoredObject = async (
  bucketClient: SupabaseGeneratedImageStorageBucketClient,
  objectKey: string,
): Promise<boolean> => {
  if (!bucketClient.remove) {
    return false;
  }

  try {
    const result = await bucketClient.remove([objectKey]);
    return !result.error;
  } catch {
    return false;
  }
};

const buildPrivateGeneratedImageObjectKey = (input: {
  artifactId: string;
  format: VerifiedGeneratedImageArtifactBytes["format"];
  jobId: string;
  ownerId: string;
  projectId: string;
  workspaceId: string;
}): string | undefined => {
  const segments = [
    input.workspaceId,
    input.ownerId,
    input.projectId,
    input.jobId,
    input.artifactId,
  ];

  if (
    !segments.every((segment) =>
      isSafeGeneratedImageProductionArtifactSegment(segment),
    )
  ) {
    return undefined;
  }

  const extension =
    input.format === "jpeg" ? "jpg" : input.format === "webp" ? "webp" : "png";

  return [
    "generated-images",
    input.workspaceId,
    input.ownerId,
    input.projectId,
    input.jobId,
    `${input.artifactId}.${extension}`,
  ].join("/");
};

export const createNotConfiguredGeneratedImageProductionStorage =
  (): GeneratedImageProductionStorage => ({
    getReadiness: () => ({
      kind: "unavailable",
      status: "storage_not_configured",
      message: "Production generated image storage is not configured.",
    }),
    deleteObject: async () =>
      deleteUnavailable(
        "storage_not_configured",
        "Production generated image storage is not configured.",
      ),
    readObject: async () =>
      readUnavailable(
        "storage_not_configured",
        "Production generated image storage is not configured.",
      ),
    resolveRecord: async () =>
      recordUnavailable(
        "storage_not_configured",
        "Production generated image storage is not configured.",
      ),
    store: async () =>
      unavailable(
        "storage_not_configured",
        "Production generated image storage is not configured.",
      ),
  });

export const createSupabaseGeneratedImageProductionStorage = (
  options: SupabaseGeneratedImageProductionStorageOptions,
): GeneratedImageProductionStorage => ({
  getReadiness: () =>
    isWriteConfigured(options)
      ? { kind: "ready", status: "available" }
      : {
          kind: "unavailable",
          status: "storage_not_configured",
          message: "Supabase generated image storage is not configured.",
        },

  async store(input) {
    if (!isWriteConfigured(options)) {
      return unavailable(
        "storage_not_configured",
        "Supabase generated image storage is not configured.",
      );
    }

    const objectKey = buildPrivateGeneratedImageObjectKey({
      artifactId: input.artifactId,
      format: input.verifiedImage.format,
      jobId: input.jobId,
      ownerId: input.ownerId,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
    });

    if (!objectKey) {
      return unavailable(
        "invalid_artifact_identity",
        "Generated image artifact identity is not safe for production storage.",
      );
    }

    const createdAt = input.createdAt ?? options.now?.() ?? defaultNow();
    const storageRef: GeneratedImageProductionStorageRef = {
      bucket: options.bucket,
      contentType: input.verifiedImage.contentType,
      createdAt,
      objectKey,
      provider: "supabase_storage",
      sha256: input.verifiedImage.sha256,
      sizeBytes: input.verifiedImage.sizeBytes,
    };

    if (!isSafeGeneratedImageProductionStorageRef(storageRef)) {
      return unavailable(
        "invalid_artifact_identity",
        "Generated image production storage reference is unsafe.",
      );
    }

    try {
      const upload = await options.client.storage
        .from(options.bucket)
        .upload(objectKey, input.verifiedImage.bytes, {
          cacheControl: "no-store",
          contentType: input.verifiedImage.contentType,
          upsert: false,
        });

      if (upload.error) {
        return unavailable(
          "upload_failed",
          "Supabase generated image artifact upload failed.",
        );
      }

      const { fileName, folderPath } = splitObjectKey(objectKey);
      const listed = await options.client.storage.from(options.bucket).list(
        folderPath,
        {
          limit: 1,
          search: fileName,
        },
      );

      const listedObject = listed.data?.find((item) => item.name === fileName);

      if (
        listed.error ||
        !listedObject ||
        (typeof listedObject.metadata?.size === "number" &&
          listedObject.metadata.size !== input.verifiedImage.sizeBytes) ||
        (typeof listedObject.metadata?.mimetype === "string" &&
          listedObject.metadata.mimetype !== input.verifiedImage.contentType)
      ) {
        await removeStoredObject(
          options.client.storage.from(options.bucket),
          objectKey,
        );
        return unavailable(
          "object_verification_failed",
          "Supabase generated image artifact object verification failed.",
        );
      }

      const downloaded = await options.client.storage
        .from(options.bucket)
        .download(objectKey);
      const downloadedContentType =
        typeof Blob !== "undefined" &&
        downloaded.data instanceof Blob &&
        downloaded.data.type
          ? downloaded.data.type
          : input.verifiedImage.contentType;
      const downloadedBytes = downloaded.data
        ? await toBytes(downloaded.data)
        : undefined;
      const verifiedStoredObject =
        downloaded.error ||
        !downloadedBytes ||
        downloadedContentType !== input.verifiedImage.contentType
          ? undefined
          : verifyGeneratedImageArtifactBytes({
              bytes: downloadedBytes,
              contentType: input.verifiedImage.contentType,
              format: input.verifiedImage.format,
              maxBytes: input.verifiedImage.sizeBytes,
            });

      if (
        !verifiedStoredObject ||
        verifiedStoredObject.kind !== "verified" ||
        verifiedStoredObject.image.sizeBytes !== input.verifiedImage.sizeBytes ||
        verifiedStoredObject.image.sha256 !== input.verifiedImage.sha256
      ) {
        await removeStoredObject(
          options.client.storage.from(options.bucket),
          objectKey,
        );
        return unavailable(
          "object_verification_failed",
          "Supabase generated image artifact object verification failed.",
        );
      }

      return {
        artifact: {
          artifactId: input.artifactId,
          contentType: input.verifiedImage.contentType,
          createdAt,
          format: input.verifiedImage.format,
          jobId: input.jobId,
          kind: "generated_image",
          ownerId: input.ownerId,
          providerId: input.providerId,
          sha256: input.verifiedImage.sha256,
          sizeBytes: input.verifiedImage.sizeBytes,
          status: "available",
          workspaceId: input.workspaceId,
        },
        kind: "stored",
        storageRef,
      };
    } catch {
      return unavailable(
        "upload_failed",
        "Supabase generated image artifact upload failed.",
      );
    }
  },

  async resolveRecord({ artifactId, jobId, ownerId, workspaceId }) {
    if (!isConfigured(options)) {
      return recordUnavailable(
        "storage_not_configured",
        "Supabase generated image storage is not configured.",
      );
    }

    if (
      !isSafeGeneratedImageProductionArtifactSegment(artifactId) ||
      !isSafeGeneratedImageProductionArtifactSegment(jobId)
    ) {
      return recordUnavailable(
        "invalid_storage_ref",
        "Generated image artifact identity is unsafe.",
      );
    }

    try {
      const query = options.client
        .from("generated_artifact_records")
        .select(
          [
            "artifact_id",
            "provider_id",
            "content_type",
            "size_bytes",
            "sha256",
            "created_at",
            "storage_provider",
            "storage_bucket",
            "storage_object_key",
            "storage_content_type",
            "storage_size_bytes",
            "storage_sha256",
            "storage_created_at",
          ].join(", "),
        );

      query.eq("artifact_id", artifactId);
      query.eq("generation_job_id", toGenerationJobId({ jobId, ownerId, workspaceId }));
      query.eq("workspace_id", workspaceId);
      query.eq("owner_id", ownerId);

      const result = await query.maybeSingle();

      if (result.error || !result.data) {
        return recordUnavailable(
          "artifact_not_found",
          "Generated image artifact record is unavailable.",
        );
      }

      const contentType = rowString(result.data, "content_type");
      const storageContentType =
        rowString(result.data, "storage_content_type") ?? contentType;

      if (!isGeneratedImageContentType(contentType) || !isGeneratedImageContentType(storageContentType)) {
        return recordUnavailable(
          "invalid_storage_ref",
          "Generated image artifact content type is unsupported.",
        );
      }

      const storageRef: GeneratedImageProductionStorageRef = {
        bucket: rowString(result.data, "storage_bucket") ?? "",
        contentType: storageContentType,
        createdAt:
          rowString(result.data, "storage_created_at") ??
          rowString(result.data, "created_at") ??
          defaultNow(),
        objectKey: rowString(result.data, "storage_object_key") ?? "",
        provider: "supabase_storage",
        sha256:
          rowString(result.data, "storage_sha256") ??
          rowString(result.data, "sha256") ??
          "",
        sizeBytes:
          rowNumber(result.data, "storage_size_bytes") ??
          rowNumber(result.data, "size_bytes") ??
          0,
      };

      if (
        rowString(result.data, "storage_provider") !== "supabase_storage" ||
        storageRef.bucket !== options.bucket ||
        !isSafeGeneratedImageProductionStorageRef(storageRef)
      ) {
        return recordUnavailable(
          "invalid_storage_ref",
          "Generated image artifact storage reference is unavailable.",
        );
      }

      return {
        kind: "resolved",
        record: {
          artifactId,
          contentType,
          createdAt: rowString(result.data, "created_at") ?? storageRef.createdAt,
          format:
            contentType === "image/jpeg"
              ? "jpeg"
              : contentType === "image/webp"
                ? "webp"
                : "png",
          jobId,
          ownerId,
          providerId:
            (rowString(result.data, "provider_id") as BackendGenerationArtifactProviderId | undefined) ??
            "mock_local",
          sha256: rowString(result.data, "sha256") ?? storageRef.sha256,
          sizeBytes: rowNumber(result.data, "size_bytes") ?? storageRef.sizeBytes,
          storageRef,
          workspaceId,
        },
      };
    } catch {
      return recordUnavailable(
        "provider_unavailable",
        "Generated image artifact record lookup failed.",
      );
    }
  },

  async readObject(storageRef) {
    if (!isConfigured(options)) {
      return readUnavailable(
        "storage_not_configured",
        "Supabase generated image storage is not configured.",
      );
    }

    if (
      storageRef.bucket !== options.bucket ||
      !isGeneratedImageContentType(storageRef.contentType) ||
      !isSafeGeneratedImageProductionStorageRef(storageRef)
    ) {
      return readUnavailable(
        "invalid_storage_ref",
        "Generated image artifact storage reference is unavailable.",
      );
    }

    try {
      const result = await options.client.storage
        .from(storageRef.bucket)
        .download(storageRef.objectKey);

      if (result.error || !result.data) {
        return readUnavailable(
          "object_not_found",
          "Generated image artifact object is unavailable.",
        );
      }

      return {
        bytes: await toBytes(result.data),
        contentType: storageRef.contentType,
        kind: "read",
      };
    } catch {
      return readUnavailable(
        "provider_unavailable",
        "Generated image artifact object read failed.",
      );
    }
  },

  async deleteObject(storageRef) {
    if (!isConfigured(options)) {
      return deleteUnavailable(
        "storage_not_configured",
        "Production generated image storage is not configured.",
      );
    }

    if (
      storageRef.bucket !== options.bucket ||
      !isSafeGeneratedImageProductionStorageRef(storageRef)
    ) {
      return deleteUnavailable(
        "invalid_storage_ref",
        "Generated image artifact storage reference is unavailable.",
      );
    }

    try {
      const removed = await removeStoredObject(
        options.client.storage.from(storageRef.bucket),
        storageRef.objectKey,
      );

      return removed
        ? { kind: "deleted" }
        : deleteUnavailable(
            "delete_failed",
            "Generated image artifact cleanup failed.",
          );
    } catch {
      return deleteUnavailable(
        "delete_failed",
        "Generated image artifact cleanup failed.",
      );
    }
  },
});

export const createSupabaseGeneratedImageProductionStorageFromClientFactory = ({
  bucket,
  clientFactoryResult,
}: {
  bucket?: string;
  clientFactoryResult: SupabaseClientFactoryResult;
}): GeneratedImageProductionStorage => {
  if (
    clientFactoryResult.kind !== "supabase_client_factory" ||
    !bucket?.trim()
  ) {
    return createNotConfiguredGeneratedImageProductionStorage();
  }

  return createSupabaseGeneratedImageProductionStorage({
    bucket,
    client:
      clientFactoryResult.createAdminClientHandle()
        .client as unknown as SupabaseGeneratedImageStorageClient,
  });
};
