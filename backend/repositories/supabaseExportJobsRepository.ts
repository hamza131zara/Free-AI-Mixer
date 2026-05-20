import type {
  BackendArtifactMetadata,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../contracts/exportHttpTypes";
import type {
  BackendExportJobCreateIfAbsentResult,
  BackendExportJobClaimInput,
  BackendExportJobClaimResult,
  BackendExportJobIdempotencyScope,
  BackendExportJobMarkSuccessInput,
  BackendExportJobMarkSuccessResult,
  BackendExportJobTransitionInput,
  BackendExportJobTransitionResult,
  BackendExportJobsRepository,
} from "./repositoryContracts";

export interface ExportJobsTableQueryResult<Row> {
  data: Row[] | Row | null;
  error: { message: string; code?: string | null } | null;
}

export interface ExportJobsTableQuery<Row> {
  select(columns: string): ExportJobsTableQuery<Row>;
  eq(column: string, value: string | number | boolean | null): ExportJobsTableQuery<Row>;
  order(
    column: string,
    options: { ascending: boolean },
  ): ExportJobsTableQuery<Row>;
  limit(count: number): ExportJobsTableQuery<Row>;
  update(values: Partial<Row>): ExportJobsTableQuery<Row>;
  maybeSingle(): Promise<ExportJobsTableQueryResult<Row>>;
  then<TResult1 = ExportJobsTableQueryResult<Row>, TResult2 = never>(
    onfulfilled?:
      | ((value: ExportJobsTableQueryResult<Row>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2>;
  insert(values: Row): Promise<ExportJobsTableQueryResult<Row>>;
  upsert(
    values: Row,
    options: { onConflict: string },
  ): Promise<ExportJobsTableQueryResult<Row>>;
}

export interface SupabaseExportJobsClient<Row> {
  from(table: "export_jobs"): ExportJobsTableQuery<Row>;
}

export interface ArtifactRecordsTableQueryResult<Row> {
  data: Row[] | Row | null;
  error: { message: string; code?: string | null } | null;
}

export interface ArtifactRecordsTableQuery<Row> {
  upsert(
    values: Row[],
    options: { onConflict: string },
  ): Promise<ArtifactRecordsTableQueryResult<Row>>;
}

interface SupabaseArtifactRecordsClient<Row> {
  from(table: "artifact_records"): ArtifactRecordsTableQuery<Row>;
}

export interface ExportJobRow {
  job_id: string;
  request_id: string;
  timeline_id: string;
  owner_id: string;
  workspace_id: string;
  status: BackendExportJobRecord["status"];
  attempt_count: number;
  claimed_by_worker_id: string | null;
  claim_expires_at: string | null;
  row_version: number;
  render_settings: BackendExportJobRecord["renderSettings"];
  failure_code: string | null;
  failure_message: string | null;
  failure_retryable: boolean | null;
  submitted_at: string | null;
  started_at: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtifactRecordRow {
  artifact_id: string;
  job_id: string;
  workspace_id: string;
  kind: string;
  format: string;
  status: BackendArtifactMetadata["status"];
  size_bytes: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

const exportJobSelectColumns = [
  "job_id",
  "request_id",
  "timeline_id",
  "owner_id",
  "workspace_id",
  "status",
  "attempt_count",
  "claimed_by_worker_id",
  "claim_expires_at",
  "row_version",
  "render_settings",
  "failure_code",
  "failure_message",
  "failure_retryable",
  "submitted_at",
  "started_at",
  "finalized_at",
  "created_at",
  "updated_at",
].join(", ");

const toExportJobRow = (record: BackendExportJobRecord): ExportJobRow => ({
  job_id: record.jobId,
  request_id: record.requestId,
  timeline_id: record.timelineId,
  owner_id: record.ownerId,
  workspace_id: record.workspaceId,
  status: record.status,
  attempt_count: record.attemptCount,
  claimed_by_worker_id: record.claimedByWorkerId ?? null,
  claim_expires_at: record.claimExpiresAt ?? null,
  row_version: 0,
  render_settings: record.renderSettings,
  failure_code: record.failure?.code ?? null,
  failure_message: record.failure?.message ?? null,
  failure_retryable: null,
  submitted_at: record.createdAt,
  started_at: record.startedAt ?? null,
  finalized_at: record.completedAt ?? record.finalizingAt ?? null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const fromExportJobRow = (row: ExportJobRow): BackendExportJobRecord => ({
  jobId: row.job_id,
  requestId: row.request_id,
  timelineId: row.timeline_id,
  ownerId: row.owner_id,
  workspaceId: row.workspace_id,
  status: row.status,
  attemptCount: row.attempt_count,
  ...(row.claimed_by_worker_id
    ? { claimedByWorkerId: row.claimed_by_worker_id }
    : {}),
  ...(row.claim_expires_at ? { claimExpiresAt: row.claim_expires_at } : {}),
  renderSettings: row.render_settings,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.started_at ? { startedAt: row.started_at } : {}),
  ...(row.finalized_at ? { completedAt: row.finalized_at } : {}),
  ...(row.status === "finalizing" && row.finalized_at
    ? { finalizingAt: row.finalized_at }
    : {}),
  ...(row.failure_code || row.failure_message
    ? {
        failure: {
          code: row.failure_code ?? "error",
          message: row.failure_message ?? "Export job failed.",
        },
      }
    : {}),
});

const toSafeArtifactMetadata = (
  artifact: BackendArtifactMetadata,
): BackendArtifactMetadata => ({
  artifactId: artifact.artifactId,
  jobId: artifact.jobId,
  kind: artifact.kind,
  format: artifact.format,
  status: artifact.status,
  createdAt: artifact.createdAt,
  ...(artifact.sizeBytes === undefined
    ? {}
    : { sizeBytes: artifact.sizeBytes }),
  ...(artifact.durationMs === undefined
    ? {}
    : { durationMs: artifact.durationMs }),
});

const toArtifactRecordRow = (
  artifact: BackendArtifactMetadata,
  workspaceId: string,
  now: string,
): ArtifactRecordRow => {
  const safeArtifact = toSafeArtifactMetadata(artifact);
  return {
    artifact_id: safeArtifact.artifactId,
    job_id: safeArtifact.jobId,
    workspace_id: workspaceId,
    kind: safeArtifact.kind,
    format: safeArtifact.format,
    status: safeArtifact.status,
    size_bytes: safeArtifact.sizeBytes ?? null,
    duration_ms: safeArtifact.durationMs ?? null,
    created_at: safeArtifact.createdAt,
    updated_at: now,
  };
};

const fromArtifactRecordRow = (
  row: ArtifactRecordRow,
): BackendArtifactMetadata => ({
  artifactId: row.artifact_id,
  jobId: row.job_id,
  kind: row.kind,
  format: row.format,
  status: row.status,
  createdAt: row.created_at,
  ...(row.size_bytes === null ? {} : { sizeBytes: row.size_bytes }),
  ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
});

const getSingleRow = async (
  query: ExportJobsTableQuery<ExportJobRow>,
): Promise<BackendExportJobRecord | undefined> => {
  const result = await query.maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data || Array.isArray(result.data)) {
    return undefined;
  }

  return fromExportJobRow(result.data);
};

const getManyRows = async (
  query: ExportJobsTableQuery<ExportJobRow>,
): Promise<BackendExportJobRecord[]> => {
  const result = await query;
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!Array.isArray(result.data) || result.data.length === 0) {
    return [];
  }

  return result.data.map(fromExportJobRow);
};

const isUniqueConstraintViolation = (
  error: ExportJobsTableQueryResult<ExportJobRow>["error"],
): boolean => {
  if (!error) {
    return false;
  }

  if (error.code === "23505") {
    return true;
  }

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("duplicate key value") ||
    normalized.includes("unique constraint") ||
    normalized.includes("already exists")
  );
};

const areCreateSafeEquivalent = (
  existing: BackendExportJobRecord,
  incoming: BackendExportJobRecord,
): boolean =>
  existing.jobId === incoming.jobId &&
  existing.requestId === incoming.requestId &&
  existing.timelineId === incoming.timelineId &&
  existing.ownerId === incoming.ownerId &&
  existing.workspaceId === incoming.workspaceId &&
  JSON.stringify(existing.renderSettings) ===
    JSON.stringify(incoming.renderSettings);

const isTerminalStatus = (
  status: BackendExportLifecycleStatus,
): boolean =>
  status === "success" || status === "error" || status === "expired";

const isClaimActiveAt = (row: ExportJobRow, now: string): boolean => {
  if (!row.claimed_by_worker_id) {
    return false;
  }

  if (!row.claim_expires_at) {
    return true;
  }

  return Date.parse(row.claim_expires_at) > Date.parse(now);
};

const isClaimExpiredAt = (row: ExportJobRow, now: string): boolean =>
  Boolean(row.claimed_by_worker_id) && !isClaimActiveAt(row, now);

const supportedOwnedTransitions: Readonly<Record<
  BackendExportLifecycleStatus,
  ReadonlySet<BackendExportLifecycleStatus>
>> = {
  queued: new Set(),
  submitted: new Set(["rendering", "error"]),
  rendering: new Set(["finalizing", "error"]),
  finalizing: new Set(["error"]),
  success: new Set(),
  error: new Set(),
  expired: new Set(),
};

const canTransitionIfOwned = (
  from: BackendExportLifecycleStatus,
  to: BackendExportLifecycleStatus,
): boolean => supportedOwnedTransitions[from].has(to);

const getClaimExpiresAt = (
  now: string,
  claimTtlMs?: number,
): string | null =>
  typeof claimTtlMs === "number" && claimTtlMs > 0
    ? new Date(Date.parse(now) + claimTtlMs).toISOString()
    : null;

const getSingleRawRow = async (
  query: ExportJobsTableQuery<ExportJobRow>,
): Promise<ExportJobRow | undefined> => {
  const result = await query.maybeSingle();
  if (result.error) {
    throw new Error(result.error.message);
  }

  if (!result.data || Array.isArray(result.data)) {
    return undefined;
  }

  return result.data;
};

const buildTransitionUpdate = (
  current: ExportJobRow,
  input: BackendExportJobTransitionInput,
  now: string,
): Partial<ExportJobRow> => {
  const nextValues: Partial<ExportJobRow> = {
    status: input.nextStatus,
    updated_at: now,
    row_version: current.row_version + 1,
  };

  if (input.expectedCurrentStatus === "submitted" && input.nextStatus === "rendering") {
    nextValues.started_at = current.started_at ?? now;
    nextValues.failure_code = null;
    nextValues.failure_message = null;
    nextValues.failure_retryable = null;
    return nextValues;
  }

  if (input.expectedCurrentStatus === "rendering" && input.nextStatus === "finalizing") {
    nextValues.finalized_at = current.finalized_at ?? now;
    nextValues.failure_code = null;
    nextValues.failure_message = null;
    nextValues.failure_retryable = null;
    return nextValues;
  }

  if (input.nextStatus === "error") {
    nextValues.failure_code = input.failureCode ?? "error";
    nextValues.failure_message =
      input.failureMessage ?? "Export job failed.";
    nextValues.failure_retryable = null;
    nextValues.finalized_at = current.finalized_at ?? now;
  }

  return nextValues;
};

const buildMarkSuccessUpdate = (
  current: ExportJobRow,
  now: string,
): Partial<ExportJobRow> => ({
  status: "success",
  updated_at: now,
  row_version: current.row_version + 1,
  finalized_at: now,
  failure_code: null,
  failure_message: null,
  failure_retryable: null,
});

export class SupabaseExportJobsRepository
  implements BackendExportJobsRepository
{
  constructor(
    private readonly client: SupabaseExportJobsClient<ExportJobRow>,
  ) {}

  private getArtifactRecordsClient(): SupabaseArtifactRecordsClient<ArtifactRecordRow> {
    return this.client as unknown as SupabaseArtifactRecordsClient<ArtifactRecordRow>;
  }

  async createIfAbsent(
    record: BackendExportJobRecord,
  ): Promise<BackendExportJobCreateIfAbsentResult> {
    const row = toExportJobRow(record);
    const result = await this.client.from("export_jobs").insert(row);

    if (!result.error) {
      return {
        kind: "created",
        record,
      };
    }

    if (!isUniqueConstraintViolation(result.error)) {
      throw new Error(result.error.message);
    }

    const existing = await this.getByIdempotencyScope({
      workspaceId: record.workspaceId,
      ownerId: record.ownerId,
      requestId: record.requestId,
    });

    if (!existing) {
      throw new Error(
        "Export job createIfAbsent detected an idempotency conflict but could not load the existing record.",
      );
    }

    if (existing.jobId !== record.jobId) {
      return {
        kind: "conflict",
        reason: "job_id_mismatch",
        existingRecord: existing,
      };
    }

    if (!areCreateSafeEquivalent(existing, record)) {
      return {
        kind: "conflict",
        reason: "non_create_safe_difference",
        existingRecord: existing,
      };
    }

    return {
      kind: "existing",
      record: existing,
    };
  }

  async upsertJob(record: BackendExportJobRecord): Promise<BackendExportJobRecord> {
    const row = toExportJobRow(record);
    const result = await this.client.from("export_jobs").upsert(row, {
      onConflict: "workspace_id,owner_id,request_id",
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return record;
  }

  async claimIfAvailable(
    input: BackendExportJobClaimInput,
  ): Promise<BackendExportJobClaimResult> {
    const now = input.now ?? new Date().toISOString();
    const current = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", input.jobId),
    );

    if (!current) {
      return { kind: "not_found" };
    }

    if (current.status !== "submitted") {
      return {
        kind: "not_claimable",
        reason: isTerminalStatus(current.status)
          ? "terminal"
          : "status_not_submitted",
      };
    }

    if (isClaimActiveAt(current, now)) {
      return {
        kind: "already_claimed",
        existingRecord: fromExportJobRow(current),
      };
    }

    const updatedRow = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .update({
          claimed_by_worker_id: input.workerId,
          claim_expires_at: getClaimExpiresAt(now, input.claimTtlMs),
          attempt_count: current.attempt_count + 1,
          started_at: current.started_at ?? now,
          updated_at: now,
          row_version: current.row_version + 1,
        })
        .eq("job_id", input.jobId)
        .eq("status", "submitted")
        .eq("row_version", current.row_version)
        .select(exportJobSelectColumns),
    );

    if (updatedRow) {
      return {
        kind: "claimed",
        record: fromExportJobRow(updatedRow),
      };
    }

    const reloaded = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", input.jobId),
    );

    if (!reloaded) {
      return { kind: "not_found" };
    }

    if (reloaded.status !== "submitted") {
      return {
        kind: "not_claimable",
        reason: isTerminalStatus(reloaded.status)
          ? "terminal"
          : "status_not_submitted",
      };
    }

    if (isClaimActiveAt(reloaded, now)) {
      return {
        kind: "already_claimed",
        existingRecord: fromExportJobRow(reloaded),
      };
    }

    return {
      kind: "not_claimable",
      reason: "status_not_submitted",
    };
  }

  async transitionIfOwned(
    input: BackendExportJobTransitionInput,
  ): Promise<BackendExportJobTransitionResult> {
    const now = input.now ?? new Date().toISOString();
    const current = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", input.jobId),
    );

    if (!current) {
      return { kind: "not_found" };
    }

    if (current.claimed_by_worker_id !== input.workerId) {
      return { kind: "not_owned" };
    }

    if (isClaimExpiredAt(current, now)) {
      return { kind: "claim_expired" };
    }

    if (current.status !== input.expectedCurrentStatus) {
      return {
        kind: "not_transitionable",
        reason: isTerminalStatus(current.status)
          ? "terminal"
          : "status_mismatch",
      };
    }

    if (!canTransitionIfOwned(input.expectedCurrentStatus, input.nextStatus)) {
      return {
        kind: "not_transitionable",
        reason: "invalid_transition",
      };
    }

    const updatedRow = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .update(buildTransitionUpdate(current, input, now))
        .eq("job_id", input.jobId)
        .eq("status", input.expectedCurrentStatus)
        .eq("claimed_by_worker_id", input.workerId)
        .eq("claim_expires_at", current.claim_expires_at)
        .eq("row_version", current.row_version)
        .select(exportJobSelectColumns),
    );

    if (updatedRow) {
      return {
        kind: "transitioned",
        record: fromExportJobRow(updatedRow),
      };
    }

    const reloaded = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", input.jobId),
    );

    if (!reloaded) {
      return { kind: "not_found" };
    }

    if (reloaded.claimed_by_worker_id !== input.workerId) {
      return { kind: "not_owned" };
    }

    if (isClaimExpiredAt(reloaded, now)) {
      return { kind: "claim_expired" };
    }

    if (reloaded.status !== input.expectedCurrentStatus) {
      return {
        kind: "not_transitionable",
        reason: isTerminalStatus(reloaded.status)
          ? "terminal"
          : "status_mismatch",
      };
    }

    return {
      kind: "version_conflict",
      existingRecord: fromExportJobRow(reloaded),
    };
  }

  async markSuccessIfOwned(
    input: BackendExportJobMarkSuccessInput,
  ): Promise<BackendExportJobMarkSuccessResult> {
    const now = input.now ?? new Date().toISOString();
    const current = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", input.jobId),
    );

    if (!current) {
      return { kind: "not_found" };
    }

    if (current.claimed_by_worker_id !== input.workerId) {
      return { kind: "not_owned" };
    }

    if (isClaimExpiredAt(current, now)) {
      return { kind: "claim_expired" };
    }

    if (current.status !== "finalizing") {
      return {
        kind: "not_transitionable",
        reason: isTerminalStatus(current.status)
          ? "terminal"
          : "status_mismatch",
      };
    }

    const artifactRows = input.artifacts.map((artifact) =>
      toArtifactRecordRow(artifact, current.workspace_id, now),
    );
    const artifactUpsert = await this.getArtifactRecordsClient()
      .from("artifact_records")
      .upsert(artifactRows, {
        onConflict: "job_id,artifact_id",
      });

    if (artifactUpsert.error) {
      throw new Error(artifactUpsert.error.message);
    }

    const updatedRow = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .update(buildMarkSuccessUpdate(current, now))
        .eq("job_id", input.jobId)
        .eq("status", "finalizing")
        .eq("claimed_by_worker_id", input.workerId)
        .eq("claim_expires_at", current.claim_expires_at)
        .eq("row_version", current.row_version)
        .select(exportJobSelectColumns),
    );

    if (updatedRow) {
      return {
        kind: "succeeded",
        record: {
          ...fromExportJobRow(updatedRow),
          artifacts: artifactRows.map(fromArtifactRecordRow),
        },
      };
    }

    const reloaded = await getSingleRawRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", input.jobId),
    );

    if (!reloaded) {
      return { kind: "not_found" };
    }

    if (reloaded.claimed_by_worker_id !== input.workerId) {
      return { kind: "not_owned" };
    }

    if (isClaimExpiredAt(reloaded, now)) {
      return { kind: "claim_expired" };
    }

    if (reloaded.status !== "finalizing") {
      return {
        kind: "not_transitionable",
        reason: isTerminalStatus(reloaded.status)
          ? "terminal"
          : "status_mismatch",
      };
    }

    return {
      kind: "version_conflict",
      existingRecord: fromExportJobRow(reloaded),
    };
  }

  async getByJobId(jobId: string): Promise<BackendExportJobRecord | undefined> {
    return getSingleRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("job_id", jobId),
    );
  }

  async getByIdempotencyScope(
    scope: BackendExportJobIdempotencyScope,
  ): Promise<BackendExportJobRecord | undefined> {
    return getSingleRow(
      this.client
        .from("export_jobs")
        .select(exportJobSelectColumns)
        .eq("workspace_id", scope.workspaceId)
        .eq("owner_id", scope.ownerId)
        .eq("request_id", scope.requestId),
    );
  }

  async listByStatus(
    status: BackendExportLifecycleStatus,
    options?: { limit?: number },
  ): Promise<BackendExportJobRecord[]> {
    let query = this.client
      .from("export_jobs")
      .select(exportJobSelectColumns)
      .eq("status", status)
      .order("submitted_at", { ascending: true })
      .order("created_at", { ascending: true })
      .order("job_id", { ascending: true });

    if (typeof options?.limit === "number") {
      query = query.limit(options.limit);
    }

    return getManyRows(query);
  }
}

export const createSupabaseExportJobsRepository = (
  client: SupabaseExportJobsClient<ExportJobRow>,
): BackendExportJobsRepository =>
  new SupabaseExportJobsRepository(client);
