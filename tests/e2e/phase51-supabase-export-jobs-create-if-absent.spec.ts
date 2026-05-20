import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
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
  "phase51-supabase-export-jobs-create-if-absent.spec.ts",
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
  overrides: Partial<BackendExportJobRecord> = {},
): BackendExportJobRecord => ({
  jobId: "job-phase51",
  requestId: "request-phase51",
  timelineId: "timeline-phase51",
  ownerId: "owner-phase51",
  workspaceId: "workspace-phase51",
  status: "submitted",
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

const toScopeKey = (row: ExportJobRow): string =>
  `${row.workspace_id}::${row.owner_id}::${row.request_id}`;

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

class FakeExportJobsTableQuery implements ExportJobsTableQuery<ExportJobRow> {
  private readonly filters = new Map<string, string>();

  constructor(
    private readonly rowsByJobId: Map<string, ExportJobRow>,
    private readonly jobIdByScope: Map<string, string>,
    private readonly stats: { insertCalls: number; upsertCalls: number },
    private readonly mode: "normal" | "db_error",
  ) {}

  select(_columns: string): ExportJobsTableQuery<ExportJobRow> {
    return this;
  }

  eq(column: string, value: string): ExportJobsTableQuery<ExportJobRow> {
    this.filters.set(column, value);
    return this;
  }

  async maybeSingle(): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    if (this.filters.has("job_id")) {
      const row = this.rowsByJobId.get(this.filters.get("job_id") as string) ?? null;
      return { data: row, error: null };
    }

    if (
      this.filters.has("workspace_id") &&
      this.filters.has("owner_id") &&
      this.filters.has("request_id")
    ) {
      const scopeKey = `${this.filters.get("workspace_id")}::${this.filters.get("owner_id")}::${this.filters.get("request_id")}`;
      const jobId = this.jobIdByScope.get(scopeKey);
      const row = jobId ? this.rowsByJobId.get(jobId) ?? null : null;
      return { data: row, error: null };
    }

    return { data: null, error: null };
  }

  async insert(values: ExportJobRow): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    this.stats.insertCalls += 1;

    if (this.mode === "db_error") {
      return {
        data: null,
        error: { message: "database offline", code: "57P01" },
      };
    }

    const scopeKey = toScopeKey(values);
    const existingJobId = this.jobIdByScope.get(scopeKey);
    if (existingJobId) {
      return {
        data: null,
        error: {
          message: "duplicate key value violates unique constraint export_jobs_workspace_owner_request_unique",
          code: "23505",
        },
      };
    }

    if (this.rowsByJobId.has(values.job_id)) {
      return {
        data: null,
        error: {
          message: "duplicate key value violates unique constraint export_jobs_pkey",
          code: "23505",
        },
      };
    }

    this.rowsByJobId.set(values.job_id, values);
    this.jobIdByScope.set(scopeKey, values.job_id);
    return { data: values, error: null };
  }

  async upsert(_values: ExportJobRow): Promise<ExportJobsTableQueryResult<ExportJobRow>> {
    this.stats.upsertCalls += 1;
    return { data: null, error: null };
  }
}

const createFakeClient = (
  seedRecords: BackendExportJobRecord[] = [],
  mode: "normal" | "db_error" = "normal",
): {
  client: SupabaseExportJobsClient<ExportJobRow>;
  stats: { insertCalls: number; upsertCalls: number };
} => {
  const rowsByJobId = new Map<string, ExportJobRow>();
  const jobIdByScope = new Map<string, string>();
  const stats = { insertCalls: 0, upsertCalls: 0 };

  for (const record of seedRecords) {
    const row = toExportJobRow(record);
    rowsByJobId.set(row.job_id, row);
    jobIdByScope.set(toScopeKey(row), row.job_id);
  }

  return {
    client: {
      from: () =>
        new FakeExportJobsTableQuery(rowsByJobId, jobIdByScope, stats, mode),
    },
    stats,
  };
};

test.describe("phase51 supabase export jobs createIfAbsent", () => {
  test("repository creates, returns existing, returns conflict, and does not use broad upsert semantics", async () => {
    const initialRecord = createRecord();
    const { client, stats } = createFakeClient();
    const repository = new SupabaseExportJobsRepository(client);

    await expect(repository.createIfAbsent(initialRecord)).resolves.toEqual({
      kind: "created",
      record: initialRecord,
    });
    expect(stats.insertCalls).toBe(1);
    expect(stats.upsertCalls).toBe(0);

    await expect(repository.createIfAbsent(initialRecord)).resolves.toEqual({
      kind: "existing",
      record: initialRecord,
    });
    expect(stats.insertCalls).toBe(2);
    expect(stats.upsertCalls).toBe(0);

    const mismatchedJobIdRecord = createRecord({ jobId: "job-phase51-other" });
    await expect(repository.createIfAbsent(mismatchedJobIdRecord)).resolves.toEqual({
      kind: "conflict",
      reason: "job_id_mismatch",
      existingRecord: initialRecord,
    });
    expect(stats.insertCalls).toBe(3);
    expect(stats.upsertCalls).toBe(0);

    const incompatibleTimelineRecord = createRecord({
      timelineId: "timeline-phase51-other",
    });
    await expect(repository.createIfAbsent(incompatibleTimelineRecord)).resolves.toEqual({
      kind: "conflict",
      reason: "non_create_safe_difference",
      existingRecord: initialRecord,
    });
    expect(stats.insertCalls).toBe(4);
    expect(stats.upsertCalls).toBe(0);
  });

  test("repository still throws for unrelated db errors and source documents truthful createIfAbsent boundary", async () => {
    const record = createRecord();
    const { client } = createFakeClient([], "db_error");
    const repository = new SupabaseExportJobsRepository(client);

    await expect(repository.createIfAbsent(record)).rejects.toThrow("database offline");

    const [specSource, repositorySource, contractsSource] = await Promise.all([
      readFileSource(specPath),
      readFileSource(repositoryPath),
      readFileSource(contractsPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("createIfAbsent");
    expect(specSource).toContain("upsertCalls");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(contractsSource).toContain("BackendExportJobCreateIfAbsentResult");
    expect(contractsSource).toContain('kind: "created"');
    expect(contractsSource).toContain('kind: "existing"');
    expect(contractsSource).toContain('kind: "conflict"');
    expect(contractsSource).toContain("createIfAbsent(");

    expect(repositorySource).toContain("async createIfAbsent(");
    expect(repositorySource).toContain('kind: "created"');
    expect(repositorySource).toContain('kind: "existing"');
    expect(repositorySource).toContain('kind: "conflict"');
    expect(repositorySource).toContain('reason: "job_id_mismatch"');
    expect(repositorySource).toContain('reason: "non_create_safe_difference"');
    expect(repositorySource).toContain("this.client.from(\"export_jobs\").insert(row)");
    expect(repositorySource).not.toContain("createIfAbsent(record) { return this.upsertJob");
    expect(repositorySource).not.toContain(forbiddenSecretLogging);
    expect(repositorySource).not.toContain(forbiddenSupabaseStart);
    expect(repositorySource).not.toContain(forbiddenSupabaseLink);
    expect(repositorySource).not.toContain(forbiddenSupabaseDb);
  });
});
