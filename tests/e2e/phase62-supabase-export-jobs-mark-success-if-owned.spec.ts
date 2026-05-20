import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BackendArtifactMetadata,
  BackendExportJobRecord,
  BackendExportLifecycleStatus,
} from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobsRepository,
  type ArtifactRecordRow,
  type ArtifactRecordsTableQuery,
  type ArtifactRecordsTableQueryResult,
  type ExportJobRow,
  type ExportJobsTableQuery,
  type ExportJobsTableQueryResult,
  type SupabaseExportJobsClient,
} from "../../backend/repositories/supabaseExportJobsRepository";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase62-supabase-export-jobs-mark-success-if-owned.spec.ts",
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
  jobId: "job-phase62-default",
  requestId: "request-phase62-default",
  timelineId: "timeline-phase62-default",
  ownerId: "owner-phase62",
  workspaceId: "workspace-phase62",
  status,
  attemptCount: 1,
  claimedByWorkerId: "worker-phase62",
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

class FakeArtifactRecordsTableQuery
  implements ArtifactRecordsTableQuery<ArtifactRecordRow>
{
  constructor(
    private readonly rowsByArtifactKey: Map<string, ArtifactRecordRow>,
    private readonly stats: { artifactUpsertCalls: number },
  ) {}

  async upsert(
    values: ArtifactRecordRow[],
    _options: { onConflict: string },
  ): Promise<ArtifactRecordsTableQueryResult<ArtifactRecordRow>> {
    this.stats.artifactUpsertCalls += 1;
    for (const value of values) {
      this.rowsByArtifactKey.set(`${value.job_id}::${value.artifact_id}`, value);
    }
    return { data: values, error: null };
  }
}

const createFakeClient = (
  seedRows: ExportJobRow[] = [],
  options?: { versionConflictJobIds?: string[] },
): {
  client: SupabaseExportJobsClient<ExportJobRow>;
  stats: { updateCalls: number; artifactUpsertCalls: number };
  getArtifactRows: () => ArtifactRecordRow[];
} => {
  const rowsByJobId = new Map<string, ExportJobRow>();
  for (const row of seedRows) {
    rowsByJobId.set(row.job_id, row);
  }

  const rowsByArtifactKey = new Map<string, ArtifactRecordRow>();
  const stats = {
    updateCalls: 0,
    artifactUpsertCalls: 0,
  };

  const from = (table: "export_jobs" | "artifact_records") => {
    if (table === "artifact_records") {
      return new FakeArtifactRecordsTableQuery(rowsByArtifactKey, stats);
    }

    return new FakeExportJobsTableQuery(
      rowsByJobId,
      stats,
      new Set(options?.versionConflictJobIds ?? []),
    );
  };

  return {
    client: {
      from,
    } as unknown as SupabaseExportJobsClient<ExportJobRow>,
    stats,
    getArtifactRows: () => Array.from(rowsByArtifactKey.values()),
  };
};

test.describe("phase62 supabase export jobs markSuccessIfOwned", () => {
  test("repository persists success state and artifact metadata truthfully without implying runtime wiring", async () => {
    const now = "2026-05-20T12:10:00.000Z";
    const finalizingOwned = createRecord("finalizing", {
      jobId: "job-phase62-finalizing",
      requestId: "request-phase62-finalizing",
      finalizingAt: "2026-05-20T12:05:00.000Z",
      completedAt: "2026-05-20T12:05:00.000Z",
      updatedAt: "2026-05-20T12:05:00.000Z",
    });
    const wrongWorker = createRecord("finalizing", {
      jobId: "job-phase62-wrong-worker",
      requestId: "request-phase62-wrong-worker",
      claimedByWorkerId: "worker-other",
      finalizingAt: "2026-05-20T12:04:00.000Z",
      completedAt: "2026-05-20T12:04:00.000Z",
    });
    const expiredLease = createRecord("finalizing", {
      jobId: "job-phase62-expired",
      requestId: "request-phase62-expired",
      claimExpiresAt: "2026-05-20T12:00:00.000Z",
      finalizingAt: "2026-05-20T12:03:00.000Z",
      completedAt: "2026-05-20T12:03:00.000Z",
    });
    const statusMismatch = createRecord("rendering", {
      jobId: "job-phase62-status-mismatch",
      requestId: "request-phase62-status-mismatch",
    });
    const terminalJob = createRecord("error", {
      jobId: "job-phase62-terminal",
      requestId: "request-phase62-terminal",
      failure: {
        code: "render_failed",
        message: "Renderer exploded.",
      },
      completedAt: "2026-05-20T12:06:00.000Z",
    });
    const versionConflict = createRecord("finalizing", {
      jobId: "job-phase62-version-conflict",
      requestId: "request-phase62-version-conflict",
      finalizingAt: "2026-05-20T12:05:30.000Z",
      completedAt: "2026-05-20T12:05:30.000Z",
    });

    const artifactWithUnsafeExtras = {
      artifactId: "artifact-phase62-1",
      jobId: finalizingOwned.jobId,
      kind: "render_output",
      format: "mp4",
      status: "available",
      createdAt: "2026-05-20T12:09:00.000Z",
      sizeBytes: 123456,
      durationMs: 42000,
      signedUrl: "https://evil.example/signed",
      downloadUrl: "https://evil.example/download",
      bucketName: "should-not-persist",
    } as BackendArtifactMetadata & Record<string, unknown>;

    const { client, stats, getArtifactRows } = createFakeClient(
      [
        toExportJobRow(finalizingOwned, 3),
        toExportJobRow(wrongWorker, 4),
        toExportJobRow(expiredLease, 5),
        toExportJobRow(statusMismatch, 6),
        toExportJobRow(terminalJob, 7),
        toExportJobRow(versionConflict, 8),
      ],
      {
        versionConflictJobIds: ["job-phase62-version-conflict"],
      },
    );
    const repository = new SupabaseExportJobsRepository(client);

    await expect(
      repository.markSuccessIfOwned({
        jobId: finalizingOwned.jobId,
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({
      kind: "succeeded",
      record: {
        jobId: finalizingOwned.jobId,
        requestId: finalizingOwned.requestId,
        timelineId: finalizingOwned.timelineId,
        ownerId: finalizingOwned.ownerId,
        workspaceId: finalizingOwned.workspaceId,
        status: "success",
        attemptCount: finalizingOwned.attemptCount,
        claimedByWorkerId: finalizingOwned.claimedByWorkerId,
        claimExpiresAt: finalizingOwned.claimExpiresAt,
        startedAt: finalizingOwned.startedAt,
        createdAt: finalizingOwned.createdAt,
        updatedAt: now,
        renderSettings: finalizingOwned.renderSettings,
        completedAt: now,
        artifacts: [
          {
            artifactId: "artifact-phase62-1",
            jobId: finalizingOwned.jobId,
            kind: "render_output",
            format: "mp4",
            status: "available",
            createdAt: "2026-05-20T12:09:00.000Z",
            sizeBytes: 123456,
            durationMs: 42000,
          },
        ],
      },
    });

    await expect(
      repository.markSuccessIfOwned({
        jobId: "job-phase62-missing",
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({ kind: "not_found" });

    await expect(
      repository.markSuccessIfOwned({
        jobId: wrongWorker.jobId,
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({ kind: "not_owned" });

    await expect(
      repository.markSuccessIfOwned({
        jobId: expiredLease.jobId,
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({ kind: "claim_expired" });

    await expect(
      repository.markSuccessIfOwned({
        jobId: statusMismatch.jobId,
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({
      kind: "not_transitionable",
      reason: "status_mismatch",
    });

    await expect(
      repository.markSuccessIfOwned({
        jobId: terminalJob.jobId,
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({
      kind: "not_transitionable",
      reason: "terminal",
    });

    await expect(
      repository.markSuccessIfOwned({
        jobId: versionConflict.jobId,
        workerId: "worker-phase62",
        now,
        artifacts: [artifactWithUnsafeExtras],
      }),
    ).resolves.toEqual({
      kind: "version_conflict",
      existingRecord: {
        ...versionConflict,
        updatedAt: "2026-05-20T12:09:00.000Z",
      },
    });

    expect(stats.updateCalls).toBe(2);
    expect(stats.artifactUpsertCalls).toBe(2);
    expect(getArtifactRows()).toEqual(
      expect.arrayContaining([
        {
          artifact_id: "artifact-phase62-1",
          job_id: finalizingOwned.jobId,
          workspace_id: finalizingOwned.workspaceId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          size_bytes: 123456,
          duration_ms: 42000,
          created_at: "2026-05-20T12:09:00.000Z",
          updated_at: now,
        },
      ]),
    );
    expect(
      getArtifactRows().every(
        (row) =>
          !Object.prototype.hasOwnProperty.call(row, "signedUrl") &&
          !Object.prototype.hasOwnProperty.call(row, "downloadUrl") &&
          !Object.prototype.hasOwnProperty.call(row, "bucketName"),
      ),
    ).toBe(true);
  });

  test("source keeps markSuccess repository-only, leaves registry/runtime wiring deferred, and does not introduce signed-url or download behavior", async () => {
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

    expect(specSource).toContain("markSuccessIfOwned");
    expect(contractsSource).toContain("BackendExportJobMarkSuccessInput");
    expect(contractsSource).toContain("BackendExportJobMarkSuccessResult");
    expect(contractsSource).toContain("markSuccessIfOwned(");

    expect(repositorySource).toContain('async markSuccessIfOwned(');
    expect(repositorySource).toContain('from("artifact_records")');
    expect(repositorySource).toContain('status: "success"');
    expect(repositorySource).not.toContain("signedUrl");
    expect(repositorySource).not.toContain("downloadUrl");
    expect(repositorySource).not.toContain('from("storage_refs")');

    expect(registrySource).toContain('async markSuccess(');
    expect(registrySource).toContain('createNotWiredError("markSuccess")');

    expect(backendDependenciesSource).not.toContain("new SupabaseExportJobRegistry(");
    expect(appSource).not.toContain("new SupabaseExportJobRegistry(");
    expect(renderWorkerSource).not.toContain("new SupabaseExportJobRegistry(");

    const forbiddenSecretLoggingPattern = buildForbiddenSecretLoggingPattern();
    expect(repositorySource).not.toContain(forbiddenSecretLoggingPattern);
    expect(backendDependenciesSource).not.toContain(forbiddenSecretLoggingPattern);
    expect(appSource).not.toContain(forbiddenSecretLoggingPattern);
    expect(renderWorkerSource).not.toContain(forbiddenSecretLoggingPattern);

    expect(repositorySource).not.toContain(buildForbiddenCliPattern("start"));
    expect(repositorySource).not.toContain(buildForbiddenCliPattern("stop"));
    expect(backendDependenciesSource).not.toContain(buildForbiddenCliPattern("start"));
    expect(appSource).not.toContain(buildForbiddenCliPattern("start"));
    expect(renderWorkerSource).not.toContain(buildForbiddenCliPattern("start"));
  });
});
