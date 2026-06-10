import { createHash } from "node:crypto";
import type { SupabaseClientFactoryResult } from "../db/supabaseClientFactory";
import {
  createNotConfiguredProductionSupabasePersistenceWriter,
  type ProductionGeneratedArtifactRecordInput,
  type ProductionGenerationJobMetadataInput,
  type ProductionImageGenerationHistoryInput,
  type ProductionPersistenceWriteResult,
  type ProductionProjectMetadataInput,
  type ProductionSupabasePersistenceWriter,
} from "./productionSupabasePersistenceBoundary";

export interface SupabasePersistenceQueryResult {
  error: { code?: string | null; message: string } | null;
}

export interface SupabasePersistenceTableQuery {
  insert(values: Record<string, unknown>): SupabasePersistenceTableQuery;
  then<TResult1 = SupabasePersistenceQueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabasePersistenceQueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

export interface SupabaseProductionPersistenceClient {
  from(
    table:
      | "projects"
      | "generation_jobs"
      | "generated_artifact_records"
      | "image_generation_history",
  ): SupabasePersistenceTableQuery;
}

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

const toPersisted = (): ProductionPersistenceWriteResult => ({
  kind: "persisted",
  status: "persisted",
});

const toWriteFailed = (): ProductionPersistenceWriteResult => ({
  kind: "unavailable",
  status: "persistence_write_failed",
  message:
    "Production Supabase persistence write failed or tables are unavailable; browser-local fallback remains local/browser-only.",
});

const insertSafeRow = async (
  client: SupabaseProductionPersistenceClient,
  table: Parameters<SupabaseProductionPersistenceClient["from"]>[0],
  row: Record<string, unknown>,
): Promise<ProductionPersistenceWriteResult> => {
  try {
    const result = await client.from(table).insert(row);

    return result.error ? toWriteFailed() : toPersisted();
  } catch {
    return toWriteFailed();
  }
};

const toGenerationJobId = (input: {
  jobId: string;
  ownerId: string;
  workspaceId: string;
}): string =>
  toStableUuid(`generation_job:${input.workspaceId}:${input.ownerId}:${input.jobId}`);

const toProjectId = (input: {
  ownerId: string;
  projectId: string;
  workspaceId: string;
}): string =>
  toStableUuid(`project:${input.workspaceId}:${input.ownerId}:${input.projectId}`);

const toHistoryId = (input: {
  artifactId: string;
  jobId: string;
  ownerId: string;
  workspaceId: string;
}): string =>
  toStableUuid(
    `image_generation_history:${input.workspaceId}:${input.ownerId}:${input.jobId}:${input.artifactId}`,
  );

export const createSupabaseProductionPersistenceWriter = (
  client: SupabaseProductionPersistenceClient,
): ProductionSupabasePersistenceWriter => ({
  getReadiness: () => ({
    kind: "ready",
    status: "available",
  }),

  persistGeneratedArtifactRecord: async (
    input: ProductionGeneratedArtifactRecordInput,
  ) =>
    insertSafeRow(client, "generated_artifact_records", {
      artifact_id: input.artifactId,
      content_type: input.contentType,
      created_at: input.createdAt,
      delivery_status: "unavailable",
      generation_job_id: toGenerationJobId(input),
      generation_kind: "image",
      owner_id: input.ownerId,
      provider_id: input.providerId,
      sha256: input.sha256,
      size_bytes: input.sizeBytes,
      storage_state: input.status,
      workspace_id: input.workspaceId,
    }),

  persistGenerationJobMetadata: async (
    input: ProductionGenerationJobMetadataInput,
  ) =>
    insertSafeRow(client, "generation_jobs", {
      generation_job_id: toGenerationJobId(input),
      generation_kind: input.generationKind,
      lifecycle_state:
        input.status === "generated_metadata_ready" ? "metadata_ready" : "failed",
      owner_id: input.ownerId,
      provider_id: input.providerId,
      request_id: input.requestId,
      status: input.status,
      workspace_id: input.workspaceId,
    }),

  persistImageGenerationHistory: async (
    input: ProductionImageGenerationHistoryInput,
  ) =>
    insertSafeRow(client, "image_generation_history", {
      artifact_id: input.artifactId,
      content_type: input.contentType,
      created_at: input.createdAt,
      delivery_status: "unavailable",
      generation_job_id: toGenerationJobId(input),
      history_id: toHistoryId(input),
      owner_id: input.ownerId,
      provider_id: input.providerId,
      sha256: input.sha256,
      size_bytes: input.sizeBytes,
      status: "metadata_ready",
      workspace_id: input.workspaceId,
    }),

  persistProjectMetadata: async (input: ProductionProjectMetadataInput) =>
    insertSafeRow(client, "projects", {
      owner_id: input.ownerId,
      project_id: toProjectId(input),
      status: input.status,
      title: input.projectName,
      updated_at: input.updatedAt,
      workspace_id: input.workspaceId,
    }),
});

export const createProductionSupabasePersistenceWriterFromClientFactory = (
  clientFactoryResult: SupabaseClientFactoryResult,
): ProductionSupabasePersistenceWriter => {
  if (clientFactoryResult.kind !== "supabase_client_factory") {
    return createNotConfiguredProductionSupabasePersistenceWriter();
  }

  const adminHandle = clientFactoryResult.createAdminClientHandle();

  return createSupabaseProductionPersistenceWriter(
    adminHandle.client as unknown as SupabaseProductionPersistenceClient,
  );
};
