import { createHash } from "node:crypto";
import type { SupabaseClientFactoryResult } from "../db/supabaseClientFactory";
import {
  createNotConfiguredProductionSupabasePersistenceWriter,
  type ProductionGeneratedImageBundleInput,
  type ProductionGeneratedImageBundleWriteResult,
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
  rpc?(
    functionName: "free_ai_mixer_persist_generated_image_bundle",
    parameters: Record<string, unknown>,
  ): PromiseLike<SupabaseGeneratedImageBundleRpcResult>;
}

export interface SupabaseGeneratedImageBundleRpcRow {
  outcome: string;
  generation_job_id: string;
  artifact_id: string;
  history_id: string;
  generation_job_created: boolean;
  artifact_created: boolean;
  history_created: boolean;
}

export interface SupabaseGeneratedImageBundleRpcResult {
  data: SupabaseGeneratedImageBundleRpcRow[] | SupabaseGeneratedImageBundleRpcRow | null;
  error: { code?: string | null; message: string } | null;
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

const toBundleWriteFailed = (): ProductionGeneratedImageBundleWriteResult => ({
  kind: "unavailable",
  status: "persistence_write_failed",
  message: "Generated image persistence is temporarily unavailable.",
});

const isUuidLike = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

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

const persistGeneratedImageBundle = async (
  client: SupabaseProductionPersistenceClient,
  input: ProductionGeneratedImageBundleInput,
): Promise<ProductionGeneratedImageBundleWriteResult> => {
  if (!client.rpc) {
    return toBundleWriteFailed();
  }

  const generationJobId = toGenerationJobId(input);
  const historyId = toHistoryId(input);

  try {
    const result = await client.rpc(
      "free_ai_mixer_persist_generated_image_bundle",
      {
        p_artifact_id: input.artifactId,
        p_content_type: input.contentType,
        p_created_at: input.createdAt,
        p_generation_job_id: generationJobId,
        p_history_id: historyId,
        p_idempotency_key: input.requestId,
        p_owner_id: input.ownerId,
        p_project_id: input.projectId,
        p_prompt_summary: input.promptSummary ?? null,
        p_provider_id: input.providerId,
        p_sha256: input.sha256,
        p_size_bytes: input.sizeBytes,
        p_storage_bucket: input.storageRef.bucket,
        p_storage_content_type: input.storageRef.contentType,
        p_storage_created_at: input.storageRef.createdAt,
        p_storage_object_key: input.storageRef.objectKey,
        p_storage_provider: input.storageRef.provider,
        p_storage_sha256: input.storageRef.sha256,
        p_storage_size_bytes: input.storageRef.sizeBytes,
        p_workspace_id: input.workspaceId,
      },
    );

    if (result.error || !Array.isArray(result.data) || result.data.length !== 1) {
      return toBundleWriteFailed();
    }

    const row = result.data[0];
    const expectedCreated = row?.outcome === "created";

    if (
      !row ||
      (row.outcome !== "created" && row.outcome !== "replayed") ||
      !isUuidLike(row.generation_job_id) ||
      row.generation_job_id !== generationJobId ||
      typeof row.artifact_id !== "string" ||
      row.artifact_id !== input.artifactId ||
      !isUuidLike(row.history_id) ||
      row.history_id !== historyId ||
      typeof row.generation_job_created !== "boolean" ||
      typeof row.artifact_created !== "boolean" ||
      typeof row.history_created !== "boolean" ||
      row.generation_job_created !== expectedCreated ||
      row.artifact_created !== expectedCreated ||
      row.history_created !== expectedCreated
    ) {
      return toBundleWriteFailed();
    }

    return {
      kind: "persisted",
      status: "persisted",
      outcome: row.outcome,
      generationJobId: row.generation_job_id,
      artifactId: row.artifact_id,
      historyId: row.history_id,
      generationJobCreated: row.generation_job_created,
      artifactCreated: row.artifact_created,
      historyCreated: row.history_created,
    };
  } catch {
    return toBundleWriteFailed();
  }
};

export const createSupabaseProductionPersistenceWriter = (
  client: SupabaseProductionPersistenceClient,
): ProductionSupabasePersistenceWriter => ({
  getReadiness: () => ({
    kind: "ready",
    status: "available",
  }),

  persistGeneratedImageBundle: async (input: ProductionGeneratedImageBundleInput) =>
    persistGeneratedImageBundle(client, input),

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
      ...(input.storageRef
        ? {
            storage_bucket: input.storageRef.bucket,
            storage_content_type: input.storageRef.contentType,
            storage_created_at: input.storageRef.createdAt,
            storage_object_key: input.storageRef.objectKey,
            storage_provider: input.storageRef.provider,
            storage_sha256: input.storageRef.sha256,
            storage_size_bytes: input.storageRef.sizeBytes,
          }
        : {}),
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
      ...(input.projectId ? { project_id: input.projectId } : {}),
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
      ...(input.projectId ? { project_id: input.projectId } : {}),
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
