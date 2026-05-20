import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobsRepository,
  type ExportJobRow,
  type ExportJobsTableQuery,
  type ExportJobsTableQueryResult,
  type SupabaseExportJobsClient,
} from "../../backend/repositories/supabaseExportJobsRepository";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase54-supabase-export-jobs-list-by-status.spec.ts",
);
const repositoryPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseExportJobsRepository.ts",
);
const contractsPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "repositoryContracts.ts",
);

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const buildForbiddenSecretLoggingPattern = (): string =>
  [
    "console",
    "log(process",
    "env",
    ["FREE", "AI", "MIXER", "SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
    ")",
  ].join(".");

const buildForbiddenCliPattern = (segment: string): string =>
  ["supabase", " ", segment].join("");

const createRecord = (
  status: BackendExportLifecycleStatus,
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase54-default",
  requestId: "request-phase54-default",
  timelineId: "timeline-phase54-default",
  ownerId: "owner-phase54",
  workspaceId: "workspace-phase54",
  status,
  attemptCount: 0,
  createdAt: "2026-05-19T16:30:40.071Z",
  updatedAt: "2026-05-19T16:30:40.071Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...overrides,
});

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

class FakeExportJobsTableQuery implements ExportJobsTableQuery<ExportJobRow> {
  private readonly filters = new Map<string, string>();
  private readonly ordering: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | undefined;

  constructor(
    private readonly rows: ExportJobRow[],
    private readonly stats: {
      orderCalls: string[];
      limitCalls: number[];
      insertCalls: number;
      upsertCalls: number;
    },
  ) {}

  select(_columns: string): ExportJobsTableQuery<ExportJobRow> {
    return this;
  }

  eq(
    column: string,
    value: string | number | boolean | null,
  ): ExportJobsTableQuery<ExportJobRow> {
    this.filters.set(column, value);
    return this;
  }

  order(
    column: string,
    options: { ascending: boolean },
  ): ExportJobsTableQuery<ExportJobRow> {
    this.ordering.push({ column, ascending: options.ascending });
    this.stats.orderCalls.push(`${column}:${options.ascending ? "asc" : "desc"}`);
    return this;
  }

  limit(count: number): ExportJobsTableQuery<ExportJobRow> {
    this.limitCount = count;
    this.stats.limitCalls.push(count);
    return this;
  }

  update(_values: Partial<ExportJobRow>): ExportJobsTableQuery<ExportJobRow> {
    return this;
  }

  async maybeSingle(): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    const matches = this.filterRows();
    return { data: matches[0] ?? null, error: null };
  }

  async insert(values: ExportJobRow): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    this.stats.insertCalls += 1;
    return { data: values, error: null };
  }

  async upsert(values: ExportJobRow): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    this.stats.upsertCalls += 1;
    return { data: values, error: null };
  }

  then<TResult1 = ExportJobsTableQueryResult<ExportJobRow>, TResult2 = never>(
    onfulfilled?:
      | ((value: ExportJobsTableQueryResult<ExportJobRow>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private async execute(): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    let matches = this.filterRows();

    for (let index = this.ordering.length - 1; index >= 0; index -= 1) {
      const { column, ascending } = this.ordering[index];
      matches = [...matches].sort((left, right) => {
        const leftValue = this.readSortableValue(left, column);
        const rightValue = this.readSortableValue(right, column);
        if (leftValue < rightValue) {
          return ascending ? -1 : 1;
        }
        if (leftValue > rightValue) {
          return ascending ? 1 : -1;
        }
        return 0;
      });
    }

    if (typeof this.limitCount === "number") {
      matches = matches.slice(0, this.limitCount);
    }

    return { data: matches, error: null };
  }

  private filterRows(): ExportJobRow[] {
    return this.rows.filter((row) => {
      for (const [column, value] of this.filters.entries()) {
        if (this.readSortableValue(row, column) !== value) {
          return false;
        }
      }
      return true;
    });
  }

  private readSortableValue(row: ExportJobRow, column: string): string {
    switch (column) {
      case "status":
        return row.status;
      case "submitted_at":
        return row.submitted_at ?? "";
      case "created_at":
        return row.created_at;
      case "job_id":
        return row.job_id;
      default:
        return String((row as Record<string, unknown>)[column] ?? "");
    }
  }
}

const createFakeClient = (
  seedRecords: BackendExportJobRecord[],
): {
  client: SupabaseExportJobsClient<ExportJobRow>;
  stats: {
    orderCalls: string[];
    limitCalls: number[];
    insertCalls: number;
    upsertCalls: number;
  };
} => {
  const rows = seedRecords.map(toExportJobRow);
  const stats = {
    orderCalls: [] as string[],
    limitCalls: [] as number[],
    insertCalls: 0,
    upsertCalls: 0,
  };

  return {
    client: {
      from: () => new FakeExportJobsTableQuery(rows, stats),
    },
    stats,
  };
};

test.describe("phase54 supabase export jobs listByStatus", () => {
  test("repository lists submitted and non-submitted jobs truthfully with deterministic ordering and optional limit", async () => {
    const submittedOldest = createRecord("submitted", {
      jobId: "job-phase54-a",
      requestId: "request-phase54-a",
      createdAt: "2026-05-19T16:30:00.000Z",
      updatedAt: "2026-05-19T16:30:01.000Z",
    });
    const submittedSameTimeHigherJobId = createRecord("submitted", {
      jobId: "job-phase54-c",
      requestId: "request-phase54-c",
      createdAt: "2026-05-19T16:31:00.000Z",
      updatedAt: "2026-05-19T16:31:01.000Z",
      failure: undefined,
    });
    const submittedSameTimeLowerJobId = createRecord("submitted", {
      jobId: "job-phase54-b",
      requestId: "request-phase54-b",
      createdAt: "2026-05-19T16:31:00.000Z",
      updatedAt: "2026-05-19T16:31:02.000Z",
    });
    const errorRecord = createRecord("error", {
      jobId: "job-phase54-error",
      requestId: "request-phase54-error",
      createdAt: "2026-05-19T16:40:00.000Z",
      updatedAt: "2026-05-19T16:41:00.000Z",
      failure: {
        code: "render_failed",
        message: "Renderer failed.",
      },
    });
    const successRecord = createRecord("success", {
      jobId: "job-phase54-success",
      requestId: "request-phase54-success",
      createdAt: "2026-05-19T16:42:00.000Z",
      updatedAt: "2026-05-19T16:43:00.000Z",
      completedAt: "2026-05-19T16:44:00.000Z",
    });

    const { client, stats } = createFakeClient([
      submittedSameTimeHigherJobId,
      successRecord,
      submittedOldest,
      errorRecord,
      submittedSameTimeLowerJobId,
    ]);
    const repository = new SupabaseExportJobsRepository(client);

    await expect(repository.listByStatus("submitted")).resolves.toEqual([
      submittedOldest,
      submittedSameTimeLowerJobId,
      submittedSameTimeHigherJobId,
    ]);
    expect(stats.orderCalls).toEqual([
      "submitted_at:asc",
      "created_at:asc",
      "job_id:asc",
    ]);
    expect(stats.limitCalls).toEqual([]);
    expect(stats.insertCalls).toBe(0);
    expect(stats.upsertCalls).toBe(0);

    stats.orderCalls.length = 0;
    stats.limitCalls.length = 0;
    await expect(repository.listByStatus("submitted", { limit: 2 })).resolves.toEqual([
      submittedOldest,
      submittedSameTimeLowerJobId,
    ]);
    expect(stats.orderCalls).toEqual([
      "submitted_at:asc",
      "created_at:asc",
      "job_id:asc",
    ]);
    expect(stats.limitCalls).toEqual([2]);
    expect(stats.insertCalls).toBe(0);
    expect(stats.upsertCalls).toBe(0);

    stats.orderCalls.length = 0;
    stats.limitCalls.length = 0;
    await expect(repository.listByStatus("error")).resolves.toEqual([errorRecord]);
    await expect(repository.listByStatus("success")).resolves.toEqual([successRecord]);
    expect(stats.orderCalls).toEqual([
      "submitted_at:asc",
      "created_at:asc",
      "job_id:asc",
      "submitted_at:asc",
      "created_at:asc",
      "job_id:asc",
    ]);
    expect(stats.limitCalls).toEqual([]);
  });

  test("source documents repository-only listByStatus support with no remote env, cli, or write-path implication", async () => {
    const [specSource, repositorySource, contractsSource] = await Promise.all([
      readFileSource(specPath),
      readFileSource(repositoryPath),
      readFileSource(contractsPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("listByStatus");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(contractsSource).toContain("listByStatus(");
    expect(contractsSource).toContain("limit?: number");

    expect(repositorySource).toContain("async listByStatus(");
    expect(repositorySource).toContain('.eq("status", status)');
    expect(repositorySource).toContain('.order("submitted_at", { ascending: true })');
    expect(repositorySource).toContain('.order("created_at", { ascending: true })');
    expect(repositorySource).toContain('.order("job_id", { ascending: true })');
    expect(repositorySource).toContain("query = query.limit(options.limit)");
    expect(repositorySource).toContain("return getManyRows(query)");
    expect(repositorySource).not.toContain("claim(");
    expect(repositorySource).not.toContain("markRendering(");
    expect(repositorySource).not.toContain("markFinalizing(");
    expect(repositorySource).not.toContain("markSuccess(");
    expect(repositorySource).not.toContain("markError(");
    expect(repositorySource).not.toContain(forbiddenSecretLogging);
    expect(repositorySource).not.toContain(forbiddenSupabaseStart);
    expect(repositorySource).not.toContain(forbiddenSupabaseLink);
    expect(repositorySource).not.toContain(forbiddenSupabaseDb);
  });
});
