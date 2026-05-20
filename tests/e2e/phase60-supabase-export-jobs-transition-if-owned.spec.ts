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
  "phase60-supabase-export-jobs-transition-if-owned.spec.ts",
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
  status: BackendExportLifecycleStatus,
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase60-default",
  requestId: "request-phase60-default",
  timelineId: "timeline-phase60-default",
  ownerId: "owner-phase60",
  workspaceId: "workspace-phase60",
  status,
  attemptCount: 1,
  claimedByWorkerId: "worker-phase60",
  claimExpiresAt: "2026-05-20T12:30:00.000Z",
  startedAt: "2026-05-20T12:00:00.000Z",
  createdAt: "2026-05-20T11:00:00.000Z",
  updatedAt: "2026-05-20T12:00:00.000Z",
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
    private readonly stats: { updateCalls: number },
    private readonly versionConflictJobIds: Set<string>,
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
    if (this.pendingUpdate) {
      this.simulateVersionConflictIfConfigured();
    }

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
    return { data: values, error: null };
  }

  async upsert(
    values: ExportJobRow,
    _options: { onConflict: string },
  ): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
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

  private simulateVersionConflictIfConfigured(): void {
    const jobId = this.filters.get("job_id");
    if (typeof jobId !== "string" || !this.versionConflictJobIds.has(jobId)) {
      return;
    }

    const current = this.rowsByJobId.get(jobId);
    if (!current) {
      this.versionConflictJobIds.delete(jobId);
      return;
    }

    this.rowsByJobId.set(jobId, {
      ...current,
      row_version: current.row_version + 1,
      updated_at: "2026-05-20T12:09:00.000Z",
    });
    this.versionConflictJobIds.delete(jobId);
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
  options?: { versionConflictJobIds?: string[] },
): {
  client: SupabaseExportJobsClient<ExportJobRow>;
  stats: { updateCalls: number };
} => {
  const rowsByJobId = new Map<string, ExportJobRow>();
  for (const row of seedRows) {
    rowsByJobId.set(row.job_id, row);
  }

  const stats = {
    updateCalls: 0,
  };

  return {
    client: {
      from: () =>
        new FakeExportJobsTableQuery(
          rowsByJobId,
          stats,
          new Set(options?.versionConflictJobIds ?? []),
        ),
    },
    stats,
  };
};

test.describe("phase60 supabase export jobs transitionIfOwned", () => {
  test("repository transitions owned jobs truthfully, persists error data, and reports non-success outcomes without implying runtime wiring", async () => {
    const now = "2026-05-20T12:10:00.000Z";

    const submittedOwned = createRecord("submitted", {
      jobId: "job-phase60-submitted",
      requestId: "request-phase60-submitted",
      startedAt: undefined,
      updatedAt: "2026-05-20T12:00:00.000Z",
    });
    const renderingOwned = createRecord("rendering", {
      jobId: "job-phase60-rendering",
      requestId: "request-phase60-rendering",
      renderingAt: "2026-05-20T12:01:00.000Z",
    });
    const renderingError = createRecord("rendering", {
      jobId: "job-phase60-rendering-error",
      requestId: "request-phase60-rendering-error",
    });
    const finalizingError = createRecord("finalizing", {
      jobId: "job-phase60-finalizing-error",
      requestId: "request-phase60-finalizing-error",
      finalizingAt: "2026-05-20T12:05:00.000Z",
      completedAt: "2026-05-20T12:05:00.000Z",
    });
    const otherWorker = createRecord("rendering", {
      jobId: "job-phase60-other-worker",
      requestId: "request-phase60-other-worker",
      claimedByWorkerId: "worker-other",
    });
    const expiredLease = createRecord("rendering", {
      jobId: "job-phase60-expired",
      requestId: "request-phase60-expired",
      claimExpiresAt: "2026-05-20T12:00:00.000Z",
    });
    const statusMismatch = createRecord("submitted", {
      jobId: "job-phase60-status-mismatch",
      requestId: "request-phase60-status-mismatch",
    });
    const versionConflict = createRecord("submitted", {
      jobId: "job-phase60-version-conflict",
      requestId: "request-phase60-version-conflict",
    });

    const { client, stats } = createFakeClient(
      [
        toExportJobRow(submittedOwned, 2),
        toExportJobRow(renderingOwned, 3),
        toExportJobRow(renderingError, 4),
        toExportJobRow(finalizingError, 5),
        toExportJobRow(otherWorker, 6),
        toExportJobRow(expiredLease, 7),
        toExportJobRow(statusMismatch, 8),
        toExportJobRow(versionConflict, 9),
      ],
      {
        versionConflictJobIds: ["job-phase60-version-conflict"],
      },
    );
    const repository = new SupabaseExportJobsRepository(client);

    await expect(
      repository.transitionIfOwned({
        jobId: submittedOwned.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "submitted",
        nextStatus: "rendering",
        now,
      }),
    ).resolves.toEqual({
      kind: "transitioned",
      record: {
        ...submittedOwned,
        status: "rendering",
        startedAt: now,
        updatedAt: now,
      },
    });

    await expect(
      repository.transitionIfOwned({
        jobId: renderingOwned.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "rendering",
        nextStatus: "finalizing",
        now,
      }),
    ).resolves.toEqual({
      kind: "transitioned",
      record: {
        ...(() => {
          const { renderingAt: _ignoredRenderingAt, ...rest } = renderingOwned;
          return rest;
        })(),
        status: "finalizing",
        updatedAt: now,
        completedAt: now,
        finalizingAt: now,
      },
    });

    await expect(
      repository.transitionIfOwned({
        jobId: renderingError.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "rendering",
        nextStatus: "error",
        now,
        failureCode: "render_failed",
        failureMessage: "Renderer failed.",
      }),
    ).resolves.toEqual({
      kind: "transitioned",
      record: {
        ...renderingError,
        status: "error",
        updatedAt: now,
        completedAt: now,
        failure: {
          code: "render_failed",
          message: "Renderer failed.",
        },
      },
    });

    await expect(
      repository.transitionIfOwned({
        jobId: finalizingError.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "finalizing",
        nextStatus: "error",
        now,
        failureCode: "finalize_failed",
        failureMessage: "Finalize failed.",
      }),
    ).resolves.toEqual({
      kind: "transitioned",
      record: {
        ...(() => {
          const { finalizingAt: _ignoredFinalizingAt, ...rest } =
            finalizingError;
          return rest;
        })(),
        status: "error",
        updatedAt: now,
        completedAt: finalizingError.completedAt,
        failure: {
          code: "finalize_failed",
          message: "Finalize failed.",
        },
      },
    });

    await expect(
      repository.transitionIfOwned({
        jobId: "job-phase60-missing",
        workerId: "worker-phase60",
        expectedCurrentStatus: "submitted",
        nextStatus: "rendering",
        now,
      }),
    ).resolves.toEqual({
      kind: "not_found",
    });

    await expect(
      repository.transitionIfOwned({
        jobId: otherWorker.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "rendering",
        nextStatus: "finalizing",
        now,
      }),
    ).resolves.toEqual({
      kind: "not_owned",
    });

    await expect(
      repository.transitionIfOwned({
        jobId: expiredLease.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "rendering",
        nextStatus: "finalizing",
        now,
      }),
    ).resolves.toEqual({
      kind: "claim_expired",
    });

    await expect(
      repository.transitionIfOwned({
        jobId: statusMismatch.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "rendering",
        nextStatus: "finalizing",
        now,
      }),
    ).resolves.toEqual({
      kind: "not_transitionable",
      reason: "status_mismatch",
    });

    await expect(
      repository.transitionIfOwned({
        jobId: versionConflict.jobId,
        workerId: "worker-phase60",
        expectedCurrentStatus: "submitted",
        nextStatus: "rendering",
        now,
      }),
    ).resolves.toEqual({
      kind: "version_conflict",
      existingRecord: {
        ...versionConflict,
        updatedAt: "2026-05-20T12:09:00.000Z",
      },
    });

    expect(stats.updateCalls).toBe(5);
  });

  test("source documents repository-only lifecycle transition support with no success/artifact persistence and no runtime wiring", async () => {
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

    expect(specSource).toContain("transitionIfOwned");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(contractsSource).toContain("BackendExportJobTransitionInput");
    expect(contractsSource).toContain("BackendExportJobTransitionResult");
    expect(contractsSource).toContain("transitionIfOwned(");
    expect(contractsSource).toContain('kind: "transitioned"');
    expect(contractsSource).toContain('kind: "not_found"');
    expect(contractsSource).toContain('kind: "not_owned"');
    expect(contractsSource).toContain('kind: "claim_expired"');
    expect(contractsSource).toContain('kind: "not_transitionable"');
    expect(contractsSource).toContain('kind: "version_conflict"');

    expect(repositorySource).toContain("async transitionIfOwned(");
    expect(repositorySource).toContain("claimed_by_worker_id");
    expect(repositorySource).toContain("claim_expires_at");
    expect(repositorySource).toContain("row_version");
    expect(repositorySource).toContain('kind: "transitioned"');
    expect(repositorySource).toContain('kind: "not_found"');
    expect(repositorySource).toContain('kind: "not_owned"');
    expect(repositorySource).toContain('kind: "claim_expired"');
    expect(repositorySource).toContain('kind: "not_transitionable"');
    expect(repositorySource).toContain('kind: "version_conflict"');
    expect(repositorySource).not.toContain("artifact_records");
    expect(repositorySource).not.toContain("markSuccess(");
    expect(repositorySource).not.toContain("artifacts");
    expect(repositorySource).not.toContain(forbiddenSecretLogging);
    expect(repositorySource).not.toContain(forbiddenSupabaseStart);
    expect(repositorySource).not.toContain(forbiddenSupabaseLink);
    expect(repositorySource).not.toContain(forbiddenSupabaseDb);

    expect(registrySource).toContain('throw this.createNotWiredError("markRendering")');
    expect(registrySource).toContain('throw this.createNotWiredError("markFinalizing")');
    expect(registrySource).toContain('throw this.createNotWiredError("markSuccess")');
    expect(registrySource).toContain('throw this.createNotWiredError("markError")');
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
  });
});
