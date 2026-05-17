import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import {
  createSupabaseExportJobsRepository,
  type ExportJobRow,
  type SupabaseExportJobsClient,
} from "../../backend/repositories/supabaseExportJobsRepository";

const adapterSourcePath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseExportJobsRepository.ts",
);
const routeRoot = path.join(process.cwd(), "backend", "routes");
const authRoot = path.join(process.cwd(), "backend", "auth");
const requesterRoot = path.join(process.cwd(), "backend", "requester");
const frontendRoot = path.join(process.cwd(), "src");
const appSourcePath = path.join(process.cwd(), "backend", "app.ts");

const getAllFileContents = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        return getAllFileContents(fullPath);
      }

      if (!entry.isFile()) {
        return [] as string[];
      }

      return [await fs.readFile(fullPath, "utf8")];
    }),
  );

  return nested.flat();
};

class FakeExportJobsQuery {
  readonly selectCalls: string[] = [];
  readonly eqCalls: Array<{ column: string; value: string }> = [];
  readonly upsertCalls: Array<{
    values: ExportJobRow;
    options: { onConflict: string };
  }> = [];

  constructor(
    private readonly selectedRow: ExportJobRow | null = null,
  ) {}

  select(columns: string): FakeExportJobsQuery {
    this.selectCalls.push(columns);
    return this;
  }

  eq(column: string, value: string): FakeExportJobsQuery {
    this.eqCalls.push({ column, value });
    return this;
  }

  async maybeSingle() {
    return {
      data: this.selectedRow,
      error: null,
    };
  }

  async upsert(values: ExportJobRow, options: { onConflict: string }) {
    this.upsertCalls.push({ values, options });
    return {
      data: values,
      error: null,
    };
  }
}

class FakeSupabaseExportJobsClient
  implements SupabaseExportJobsClient<ExportJobRow>
{
  readonly queries: FakeExportJobsQuery[] = [];

  constructor(private readonly selectedRow: ExportJobRow | null = null) {}

  from(table: "export_jobs"): FakeExportJobsQuery {
    expect(table).toBe("export_jobs");
    const query = new FakeExportJobsQuery(this.selectedRow);
    this.queries.push(query);
    return query;
  }
}

const exampleRecord: BackendExportJobRecord = {
  jobId: "job-1",
  requestId: "request-1",
  timelineId: "timeline-1",
  ownerId: "owner-1",
  workspaceId: "workspace-1",
  status: "queued",
  attemptCount: 2,
  createdAt: "2026-05-17T00:00:00.000Z",
  updatedAt: "2026-05-17T00:01:00.000Z",
  startedAt: "2026-05-17T00:00:05.000Z",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
  },
  failure: {
    code: "provider_timeout",
    message: "Provider timed out.",
  },
  finalizingAt: "2026-05-17T00:02:00.000Z",
  completedAt: "2026-05-17T00:02:30.000Z",
};

const exampleRow: ExportJobRow = {
  job_id: "job-1",
  request_id: "request-1",
  timeline_id: "timeline-1",
  owner_id: "owner-1",
  workspace_id: "workspace-1",
  status: "queued",
  attempt_count: 2,
  render_settings: exampleRecord.renderSettings,
  failure_code: "provider_timeout",
  failure_message: "Provider timed out.",
  failure_retryable: null,
  submitted_at: "2026-05-17T00:00:00.000Z",
  started_at: "2026-05-17T00:00:05.000Z",
  finalized_at: "2026-05-17T00:02:30.000Z",
  created_at: "2026-05-17T00:00:00.000Z",
  updated_at: "2026-05-17T00:01:00.000Z",
};

test.describe("phase32 export jobs adapter", () => {
  test("adapter maps export job create upsert fields with owner and workspace semantics", async () => {
    const client = new FakeSupabaseExportJobsClient();
    const repository = createSupabaseExportJobsRepository(client);

    const result = await repository.upsertJob(exampleRecord);

    expect(result).toEqual(exampleRecord);
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].upsertCalls).toHaveLength(1);
    expect(client.queries[0].upsertCalls[0]).toEqual({
      values: exampleRow,
      options: { onConflict: "workspace_id,owner_id,request_id" },
    });
  });

  test("adapter preserves requestId idempotency scope using workspaceId ownerId and requestId", async () => {
    const client = new FakeSupabaseExportJobsClient(exampleRow);
    const repository = createSupabaseExportJobsRepository(client);

    const result = await repository.getByIdempotencyScope({
      workspaceId: "workspace-1",
      ownerId: "owner-1",
      requestId: "request-1",
    });

    expect(result?.workspaceId).toBe("workspace-1");
    expect(result?.ownerId).toBe("owner-1");
    expect(result?.requestId).toBe("request-1");
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].eqCalls).toEqual([
      { column: "workspace_id", value: "workspace-1" },
      { column: "owner_id", value: "owner-1" },
      { column: "request_id", value: "request-1" },
    ]);
  });

  test("adapter uses injected fake client only and does not expose service role key", async () => {
    const client = new FakeSupabaseExportJobsClient(exampleRow);
    const repository = createSupabaseExportJobsRepository(client);
    const source = await fs.readFile(adapterSourcePath, "utf8");

    const result = await repository.getByJobId("job-1");

    expect(result?.jobId).toBe("job-1");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain("serviceRoleKey");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("../db/supabaseClientFactory");
  });

  test("adapter does not execute migrations or introduce artifact storage or billing behavior", async () => {
    const source = await fs.readFile(adapterSourcePath, "utf8");

    expect(source).not.toContain("migrate(");
    expect(source).not.toContain("migrationWorkflow");
    expect(source).not.toContain("storage_refs");
    expect(source).not.toContain("signed_url");
    expect(source).not.toContain("credit_ledger");
    expect(source).not.toContain("provider_keys");
  });

  test("routes app frontend auth and requester sources do not import the adapter", async () => {
    const [routeSources, authSources, requesterSources, frontendSources, appSource] =
      await Promise.all([
        getAllFileContents(routeRoot),
        getAllFileContents(authRoot),
        getAllFileContents(requesterRoot),
        getAllFileContents(frontendRoot),
        fs.readFile(appSourcePath, "utf8"),
      ]);

    expect(routeSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(authSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(requesterSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(frontendSources.join("\n")).not.toContain("supabaseExportJobsRepository");
    expect(appSource).not.toContain("supabaseExportJobsRepository");
  });
});
