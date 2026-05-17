import type { BackendExportJobRecord } from "../contracts/exportHttpTypes";
import type {
  BackendExportJobIdempotencyScope,
  BackendExportJobsRepository,
} from "./repositoryContracts";

export interface ExportJobsTableQueryResult<Row> {
  data: Row[] | Row | null;
  error: { message: string } | null;
}

export interface ExportJobsTableQuery<Row> {
  select(columns: string): ExportJobsTableQuery<Row>;
  eq(column: string, value: string): ExportJobsTableQuery<Row>;
  maybeSingle(): Promise<ExportJobsTableQueryResult<Row>>;
  upsert(
    values: Row,
    options: { onConflict: string },
  ): Promise<ExportJobsTableQueryResult<Row>>;
}

export interface SupabaseExportJobsClient<Row> {
  from(table: "export_jobs"): ExportJobsTableQuery<Row>;
}

export interface ExportJobRow {
  job_id: string;
  request_id: string;
  timeline_id: string;
  owner_id: string;
  workspace_id: string;
  status: BackendExportJobRecord["status"];
  attempt_count: number;
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

const exportJobSelectColumns = [
  "job_id",
  "request_id",
  "timeline_id",
  "owner_id",
  "workspace_id",
  "status",
  "attempt_count",
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

export class SupabaseExportJobsRepository
  implements BackendExportJobsRepository
{
  constructor(
    private readonly client: SupabaseExportJobsClient<ExportJobRow>,
  ) {}

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
}

export const createSupabaseExportJobsRepository = (
  client: SupabaseExportJobsClient<ExportJobRow>,
): BackendExportJobsRepository =>
  new SupabaseExportJobsRepository(client);
