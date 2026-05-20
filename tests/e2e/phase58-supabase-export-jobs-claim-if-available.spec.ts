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
  "phase58-supabase-export-jobs-claim-if-available.spec.ts",
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
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
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
  status: BackendExportLifecycleStatus = "submitted",
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase58-default",
  requestId: "request-phase58-default",
  timelineId: "timeline-phase58-default",
  ownerId: "owner-phase58",
  workspaceId: "workspace-phase58",
  status,
  attemptCount: 0,
  createdAt: "2026-05-20T10:00:00.000Z",
  updatedAt: "2026-05-20T10:00:00.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "720p",
    fps: 24,
    quality: "draft",
  },
  ...overrides,
});

const toExportJobRow = (
  record: BackendExportJobRecord,
  rowVersion = 0,
): ExportJobRow => ({
  job_id: record.jobId,
  request_id: record.requestId,
  timeline_id: record.timelineId,
  owner_id: record.ownerId,
  workspace_id: record.workspaceId,
  status: record.status,
  attempt_count: record.attemptCount,
  claimed_by_worker_id: record.claimedByWorkerId ?? null,
  claim_expires_at: record.claimExpiresAt ?? null,
  row_version: rowVersion,
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
  private readonly filters = new Map<string, string | number | boolean | null>();
  private pendingUpdate: Partial<ExportJobRow> | undefined;

  constructor(
    private readonly rowsByJobId: Map<string, ExportJobRow>,
    private readonly stats: {
      updateCalls: number;
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
    _column: string,
    _options: { ascending: boolean },
  ): ExportJobsTableQuery<ExportJobRow> {
    return this;
  }

  limit(_count: number): ExportJobsTableQuery<ExportJobRow> {
    return this;
  }

  update(values: Partial<ExportJobRow>): ExportJobsTableQuery<ExportJobRow> {
    this.pendingUpdate = values;
    this.stats.updateCalls += 1;
    return this;
  }

  async maybeSingle(): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    const matches = this.filterRows();
    const row = matches[0] ?? null;

    if (this.pendingUpdate && row) {
      const updated = {
        ...row,
        ...this.pendingUpdate,
      };
      this.rowsByJobId.set(updated.job_id, updated);
      return { data: updated, error: null };
    }

    return { data: row, error: null };
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
    const matches = this.filterRows();

    if (this.pendingUpdate && matches.length > 0) {
      const updatedRows = matches.map((row) => {
        const updated = {
          ...row,
          ...this.pendingUpdate,
        };
        this.rowsByJobId.set(updated.job_id, updated);
        return updated;
      });
      return { data: updatedRows, error: null };
    }

    return { data: matches, error: null };
  }

  private filterRows(): ExportJobRow[] {
    return Array.from(this.rowsByJobId.values()).filter((row) => {
      for (const [column, value] of this.filters.entries()) {
        if (this.readValue(row, column) !== value) {
          return false;
        }
      }
      return true;
    });
  }

  private readValue(
    row: ExportJobRow,
    column: string,
  ): string | number | boolean | null {
    return (row as Record<string, string | number | boolean | null | undefined>)[
      column
    ] ?? null;
  }
}

const createFakeClient = (
  seedRows: ExportJobRow[] = [],
): {
  client: SupabaseExportJobsClient<ExportJobRow>;
  stats: {
    updateCalls: number;
    insertCalls: number;
    upsertCalls: number;
  };
} => {
  const rowsByJobId = new Map<string, ExportJobRow>();
  for (const row of seedRows) {
    rowsByJobId.set(row.job_id, row);
  }

  const stats = {
    updateCalls: 0,
    insertCalls: 0,
    upsertCalls: 0,
  };

  return {
    client: {
      from: () => new FakeExportJobsTableQuery(rowsByJobId, stats),
    },
    stats,
  };
};

test.describe("phase58 supabase export jobs claimIfAvailable", () => {
  test("repository claims submitted jobs truthfully and preserves non-success results without implying runtime wiring", async () => {
    const now = "2026-05-20T11:00:00.000Z";

    const unclaimedSubmitted = createRecord("submitted", {
      jobId: "job-phase58-unclaimed",
      requestId: "request-phase58-unclaimed",
    });
    const expiredLeaseSubmitted = createRecord("submitted", {
      jobId: "job-phase58-expired",
      requestId: "request-phase58-expired",
      attemptCount: 2,
      claimedByWorkerId: "worker-old",
      claimExpiresAt: "2026-05-20T10:30:00.000Z",
      startedAt: "2026-05-20T10:05:00.000Z",
      updatedAt: "2026-05-20T10:30:00.000Z",
    });
    const activelyClaimedSubmitted = createRecord("submitted", {
      jobId: "job-phase58-active",
      requestId: "request-phase58-active",
      attemptCount: 1,
      claimedByWorkerId: "worker-active",
      claimExpiresAt: "2026-05-20T11:30:00.000Z",
      startedAt: "2026-05-20T10:10:00.000Z",
      updatedAt: "2026-05-20T10:10:00.000Z",
    });
    const renderingJob = createRecord("rendering", {
      jobId: "job-phase58-rendering",
      requestId: "request-phase58-rendering",
    });
    const terminalJob = createRecord("success", {
      jobId: "job-phase58-terminal",
      requestId: "request-phase58-terminal",
      completedAt: "2026-05-20T10:20:00.000Z",
    });

    const { client, stats } = createFakeClient([
      toExportJobRow(unclaimedSubmitted, 3),
      toExportJobRow(expiredLeaseSubmitted, 7),
      toExportJobRow(activelyClaimedSubmitted, 5),
      toExportJobRow(renderingJob, 2),
      toExportJobRow(terminalJob, 4),
    ]);
    const repository = new SupabaseExportJobsRepository(client);

    await expect(
      repository.claimIfAvailable({
        jobId: unclaimedSubmitted.jobId,
        workerId: "worker-phase58",
        claimTtlMs: 60000,
        now,
      }),
    ).resolves.toEqual({
      kind: "claimed",
      record: {
        ...unclaimedSubmitted,
        claimedByWorkerId: "worker-phase58",
        claimExpiresAt: "2026-05-20T11:01:00.000Z",
        attemptCount: 1,
        startedAt: now,
        updatedAt: now,
      },
    });

    await expect(
      repository.claimIfAvailable({
        jobId: expiredLeaseSubmitted.jobId,
        workerId: "worker-phase58",
        claimTtlMs: 120000,
        now,
      }),
    ).resolves.toEqual({
      kind: "claimed",
      record: {
        ...expiredLeaseSubmitted,
        claimedByWorkerId: "worker-phase58",
        claimExpiresAt: "2026-05-20T11:02:00.000Z",
        attemptCount: 3,
        startedAt: expiredLeaseSubmitted.startedAt,
        updatedAt: now,
      },
    });

    await expect(
      repository.claimIfAvailable({
        jobId: activelyClaimedSubmitted.jobId,
        workerId: "worker-phase58",
        claimTtlMs: 60000,
        now,
      }),
    ).resolves.toEqual({
      kind: "already_claimed",
      existingRecord: activelyClaimedSubmitted,
    });

    await expect(
      repository.claimIfAvailable({
        jobId: renderingJob.jobId,
        workerId: "worker-phase58",
        claimTtlMs: 60000,
        now,
      }),
    ).resolves.toEqual({
      kind: "not_claimable",
      reason: "status_not_submitted",
    });

    await expect(
      repository.claimIfAvailable({
        jobId: terminalJob.jobId,
        workerId: "worker-phase58",
        claimTtlMs: 60000,
        now,
      }),
    ).resolves.toEqual({
      kind: "not_claimable",
      reason: "terminal",
    });

    await expect(
      repository.claimIfAvailable({
        jobId: "job-phase58-missing",
        workerId: "worker-phase58",
        claimTtlMs: 60000,
        now,
      }),
    ).resolves.toEqual({
      kind: "not_found",
    });

    expect(stats.updateCalls).toBe(2);
    expect(stats.insertCalls).toBe(0);
    expect(stats.upsertCalls).toBe(0);
  });

  test("source documents repository-only claim support with no registry or runtime wiring", async () => {
    const [
      specSource,
      repositorySource,
      contractsSource,
      registrySource,
      backendDependenciesSource,
      appSource,
      renderWorkerSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(repositoryPath),
      readFileSource(contractsPath),
      readFileSource(registryPath),
      readFileSource(backendDependenciesPath),
      readFileSource(appPath),
      readFileSource(renderWorkerPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("claimIfAvailable");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(contractsSource).toContain("BackendExportJobClaimInput");
    expect(contractsSource).toContain("BackendExportJobClaimResult");
    expect(contractsSource).toContain("claimIfAvailable(");
    expect(contractsSource).toContain('kind: "claimed"');
    expect(contractsSource).toContain('kind: "not_found"');
    expect(contractsSource).toContain('kind: "not_claimable"');
    expect(contractsSource).toContain('kind: "already_claimed"');

    expect(repositorySource).toContain("async claimIfAvailable(");
    expect(repositorySource).toContain('current.status !== "submitted"');
    expect(repositorySource).toContain("claimed_by_worker_id");
    expect(repositorySource).toContain("claim_expires_at");
    expect(repositorySource).toContain("row_version");
    expect(repositorySource).toContain('kind: "claimed"');
    expect(repositorySource).toContain('kind: "not_found"');
    expect(repositorySource).toContain('kind: "not_claimable"');
    expect(repositorySource).toContain('kind: "already_claimed"');
    expect(repositorySource).not.toContain(forbiddenSecretLogging);
    expect(repositorySource).not.toContain(forbiddenSupabaseStart);
    expect(repositorySource).not.toContain(forbiddenSupabaseLink);
    expect(repositorySource).not.toContain(forbiddenSupabaseDb);

    expect(registrySource).toContain('throw this.createNotWiredError("claim")');
    expect(registrySource).not.toContain("claimIfAvailable");
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
  });
});
