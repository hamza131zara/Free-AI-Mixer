export type ProductionPersistenceTable =
  | "app_users"
  | "workspaces"
  | "workspace_memberships"
  | "projects"
  | "generation_jobs"
  | "generated_artifact_records"
  | "generated_image_bundle_idempotency"
  | "image_generation_history"
  | "provider_keys"
  | "audit_log"
  | "analytics_events";

export interface ProductionPersistenceBoundaryTable {
  tableName: ProductionPersistenceTable;
  status: "drafted" | "existing_boundary";
  safeMetadataOnly: boolean;
  migration: string;
  notes: string;
}

export const productionPersistenceBoundaryTables: ProductionPersistenceBoundaryTable[] = [
  {
    tableName: "app_users",
    status: "existing_boundary",
    safeMetadataOnly: true,
    migration: "0001_initial_supabase_postgres_schema.sql",
    notes: "Backend-owned app identity mapping; token and privileged server credential values are not persisted.",
  },
  {
    tableName: "workspaces",
    status: "existing_boundary",
    safeMetadataOnly: true,
    migration: "0001_initial_supabase_postgres_schema.sql",
    notes: "Workspace ownership metadata only.",
  },
  {
    tableName: "workspace_memberships",
    status: "existing_boundary",
    safeMetadataOnly: true,
    migration: "0001_initial_supabase_postgres_schema.sql",
    notes: "Owner/admin/member/viewer role metadata for backend authorization.",
  },
  {
    tableName: "projects",
    status: "drafted",
    safeMetadataOnly: true,
    migration: "0004_launch_block1_project_generation_persistence_draft.sql",
    notes: "Project metadata and safe JSON document state only; no provider secrets or artifact binary payloads.",
  },
  {
    tableName: "generation_jobs",
    status: "drafted",
    safeMetadataOnly: true,
    migration: "0004_launch_block1_project_generation_persistence_draft.sql",
    notes: "Generation lifecycle and safe request metadata only; raw prompts and provider bodies are forbidden.",
  },
  {
    tableName: "generated_artifact_records",
    status: "drafted",
    safeMetadataOnly: true,
    migration: "0004_launch_block1_project_generation_persistence_draft.sql",
    notes: "Generated artifact metadata only; no delivery URLs, local filesystem locations, binary payloads, or encoded image payloads.",
  },
  {
    tableName: "generated_image_bundle_idempotency",
    status: "drafted",
    safeMetadataOnly: true,
    migration: "0011_h6j_atomic_generated_image_persistence.sql",
    notes: "Backend-only exact request identity for atomic replay validation; storage metadata never enters public responses.",
  },
  {
    tableName: "image_generation_history",
    status: "drafted",
    safeMetadataOnly: true,
    migration: "0004_launch_block1_project_generation_persistence_draft.sql",
    notes: "Server history metadata only with safe prompt summary, not raw secrets.",
  },
  {
    tableName: "provider_keys",
    status: "existing_boundary",
    safeMetadataOnly: false,
    migration: "0003_provider_keys_schema_draft.sql",
    notes: "Secret storage fields are backend-only; public/repository summaries must use redacted metadata only.",
  },
  {
    tableName: "audit_log",
    status: "existing_boundary",
    safeMetadataOnly: true,
    migration: "0002_event_audit_persistence_draft.sql",
    notes: "Append-only safe audit metadata; raw secrets and provider bodies are forbidden.",
  },
  {
    tableName: "analytics_events",
    status: "existing_boundary",
    safeMetadataOnly: true,
    migration: "0002_event_audit_persistence_draft.sql",
    notes: "Safe analytics metadata only; no secrets, raw prompts, headers, or tokens.",
  },
];

export const forbiddenProductionPersistencePublicFields = [
  "encrypted_payload",
  "secret_ref",
  "jwt",
  "service_role",
  "api_key",
  "provider_response_body",
  "provider_headers",
  "local_path",
  "internal_ref",
  "base64",
  "bytes",
  "public_url",
  "signed_url",
  "download_url",
] as const;

export type ProductionPersistenceReadiness =
  | {
      kind: "ready";
      status: "available";
    }
  | {
      kind: "unavailable";
      status: "persistence_unavailable";
      message: string;
    };

export type ProductionPersistenceWriteResult =
  | {
      kind: "persisted";
      status: "persisted";
    }
  | {
      kind: "unavailable";
      status: "persistence_unavailable" | "persistence_write_failed";
      message: string;
    };

export interface ProductionGenerationJobMetadataInput {
  generationKind: "image" | "video";
  jobId: string;
  ownerId: string;
  projectId?: string;
  providerId: string;
  requestId: string;
  status: "generated_metadata_ready" | "failed" | "submitted";
  workspaceId: string;
}

export interface ProductionGeneratedArtifactRecordInput {
  artifactId: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  createdAt: string;
  jobId: string;
  ownerId: string;
  providerId: string;
  sha256: string;
  sizeBytes: number;
  status: "available" | "failed" | "pending_verification";
  storageRef?: {
    provider: "supabase_storage";
    bucket: string;
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    sizeBytes: number;
    sha256: string;
    createdAt: string;
  };
  workspaceId: string;
}

export interface ProductionImageGenerationHistoryInput {
  artifactId: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  createdAt: string;
  jobId: string;
  ownerId: string;
  projectId?: string;
  providerId: string;
  requestId: string;
  sha256: string;
  sizeBytes: number;
  status: "generated_metadata_ready";
  workspaceId: string;
}

export interface ProductionGeneratedImageBundleInput {
  artifactId: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  createdAt: string;
  jobId: string;
  ownerId: string;
  projectId: string;
  promptSummary?: string;
  providerId: string;
  requestId: string;
  sha256: string;
  sizeBytes: number;
  storageRef: {
    provider: "supabase_storage";
    bucket: string;
    objectKey: string;
    contentType: "image/png" | "image/jpeg" | "image/webp";
    sizeBytes: number;
    sha256: string;
    createdAt: string;
  };
  workspaceId: string;
}

export type ProductionGeneratedImageBundleWriteResult =
  | {
      kind: "persisted";
      status: "persisted";
      outcome: "created" | "replayed";
      generationJobId: string;
      artifactId: string;
      historyId: string;
      generationJobCreated: boolean;
      artifactCreated: boolean;
      historyCreated: boolean;
    }
  | {
      kind: "unavailable";
      status: "persistence_unavailable" | "persistence_write_failed";
      message: string;
    };

export interface ProductionProjectMetadataInput {
  ownerId: string;
  projectId: string;
  projectName: string;
  status: "active" | "archived";
  updatedAt: string;
  workspaceId: string;
}

export interface ProductionSupabasePersistenceWriter {
  getReadiness(): ProductionPersistenceReadiness;
  persistGeneratedImageBundle(
    input: ProductionGeneratedImageBundleInput,
  ): Promise<ProductionGeneratedImageBundleWriteResult>;
  persistGenerationJobMetadata(
    input: ProductionGenerationJobMetadataInput,
  ): Promise<ProductionPersistenceWriteResult>;
  persistGeneratedArtifactRecord(
    input: ProductionGeneratedArtifactRecordInput,
  ): Promise<ProductionPersistenceWriteResult>;
  persistImageGenerationHistory(
    input: ProductionImageGenerationHistoryInput,
  ): Promise<ProductionPersistenceWriteResult>;
  persistProjectMetadata(
    input: ProductionProjectMetadataInput,
  ): Promise<ProductionPersistenceWriteResult>;
}

const persistenceUnavailable = (): Extract<
  ProductionPersistenceWriteResult,
  { kind: "unavailable" }
> => ({
  kind: "unavailable",
  status: "persistence_unavailable",
  message:
    "Production Supabase persistence is not configured; browser-local history remains local/browser-only.",
});

export const createNotConfiguredProductionSupabasePersistenceWriter =
  (): ProductionSupabasePersistenceWriter => ({
    getReadiness: () => ({
      kind: "unavailable",
      status: "persistence_unavailable",
      message:
        "Production Supabase persistence is not configured; no durable rows are written.",
    }),
    persistGeneratedArtifactRecord: async () => persistenceUnavailable(),
    persistGeneratedImageBundle: async () => persistenceUnavailable(),
    persistGenerationJobMetadata: async () => persistenceUnavailable(),
    persistImageGenerationHistory: async () => persistenceUnavailable(),
    persistProjectMetadata: async () => persistenceUnavailable(),
  });

/**
 * Launch Block 1 persistence boundary.
 *
 * This is documentation/testable metadata only. It does not connect to
 * Supabase, apply migrations, expose secrets, or enable direct frontend DB or
 * storage access.
 */
export const getProductionPersistenceBoundarySummary = () => ({
  autoApplyRemoteMigrations: false,
  directFrontendSupabaseDbAccess: false,
  directFrontendSupabaseStorageAccess: false,
  tables: productionPersistenceBoundaryTables,
});
