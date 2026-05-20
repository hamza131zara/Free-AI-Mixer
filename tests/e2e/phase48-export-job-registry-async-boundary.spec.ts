import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const registryContractPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "exportJobRegistry.ts",
);
const supabaseRegistryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const supabaseRepositoryPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseExportJobsRepository.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const exportsRoutePath = path.join(
  process.cwd(),
  "backend",
  "routes",
  "exports.ts",
);
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);
const renderHarnessPath = path.join(
  process.cwd(),
  "backend",
  "renderer",
  "singleProcessRenderHarness.ts",
);
const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase48-export-job-registry-async-boundary.spec.ts",
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

test.describe("phase48 export job registry async boundary", () => {
  test("source proves registry is async, repository is async, and runtime wiring remains deferred", async () => {
    const [
      registryContractSource,
      supabaseRegistrySource,
      supabaseRepositorySource,
      appSource,
      exportsRouteSource,
      renderWorkerSource,
      renderHarnessSource,
      specSource,
    ] = await Promise.all([
      readFileSource(registryContractPath),
      readFileSource(supabaseRegistryPath),
      readFileSource(supabaseRepositoryPath),
      readFileSource(appPath),
      readFileSource(exportsRoutePath),
      readFileSource(renderWorkerPath),
      readFileSource(renderHarnessPath),
      readFileSource(specPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(registryContractSource).toContain(
      "create(input: CreateExportJobInput): Promise<BackendExportJobRecord>;",
    );
    expect(registryContractSource).toContain(
      "getById(jobId: string): Promise<BackendExportJobRecord | undefined>;",
    );
    expect(registryContractSource).toContain(
      "getByStatus(status: BackendExportLifecycleStatus): Promise<BackendExportJobRecord[]>;",
    );
    expect(registryContractSource).toContain(
      "markRendering(jobId: string, workerId: string): Promise<BackendExportJobRecord>;",
    );
    expect(registryContractSource).toContain(
      "transition(",
    );
    expect(registryContractSource).toContain(
      "): Promise<BackendExportJobRecord>;",
    );

    expect(supabaseRepositorySource).toContain(
      "async upsertJob(record: BackendExportJobRecord): Promise<BackendExportJobRecord>",
    );
    expect(supabaseRepositorySource).toContain(
      "async getByJobId(jobId: string): Promise<BackendExportJobRecord | undefined>",
    );
    expect(supabaseRepositorySource).toContain(
      "async getByIdempotencyScope(",
    );
    expect(supabaseRepositorySource).toContain(
      "): Promise<BackendExportJobRecord | undefined>",
    );

    expect(supabaseRegistrySource).toContain("type MaybePromise<T> = T | Promise<T>;");
    expect(supabaseRegistrySource).toContain("private async readRequiredAsync");
    expect(supabaseRegistrySource).toContain("await this.getById(jobId)");
    expect(supabaseRegistrySource).toContain("jobsRepository.getByJobId(jobId)");
    expect(supabaseRegistrySource).toContain("jobsRepository.getByIdempotencyScope({");
    expect(supabaseRegistrySource).not.toContain("createClient(");
    expect(supabaseRegistrySource).not.toContain("readSupabaseConfigFromEnv");
    expect(supabaseRegistrySource).not.toContain(forbiddenSecretLogging);
    expect(supabaseRegistrySource).not.toContain(forbiddenSupabaseStart);
    expect(supabaseRegistrySource).not.toContain(forbiddenSupabaseLink);
    expect(supabaseRegistrySource).not.toContain(forbiddenSupabaseDb);

    expect(exportsRouteSource).toContain(
      "const existingRecord = await registry.getByRequestId(body.requestId, requesterContext);",
    );
    expect(exportsRouteSource).toContain(
      "const record = await registry.getByIdForOwner(jobId, requesterContext);",
    );
    expect(exportsRouteSource).toContain("await registry.getByRequestId");
    expect(exportsRouteSource).toContain("await registry.getByIdForOwner");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("repositoryComposition");

    expect(renderWorkerSource).toContain(
      'const submittedJobs = await registry.getByStatus("submitted");',
    );
    expect(renderWorkerSource).toContain("await registry.getByStatus");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("repositoryComposition");

    expect(renderHarnessSource).toContain(
      "await input.registry.claim(input.jobId, input.workerId);",
    );
    expect(renderHarnessSource).toContain(
      "await input.registry.markRendering(input.jobId, input.workerId);",
    );
    expect(renderHarnessSource).toContain(
      "await input.registry.markFinalizing(input.jobId, input.workerId);",
    );
    expect(renderHarnessSource).toContain(
      "await input.registry.markSuccess(",
    );
    expect(renderHarnessSource).toContain(
      "await input.registry.markError(input.jobId, input.workerId, asExportFailure(mapped));",
    );
    expect(renderHarnessSource).toContain("await input.registry.claim");
    expect(renderHarnessSource).toContain("await input.registry.markRendering");
    expect(renderHarnessSource).toContain("await input.registry.markFinalizing");
    expect(renderHarnessSource).toContain("await input.registry.markSuccess");
    expect(renderHarnessSource).toContain("await input.registry.markError");

    expect(appSource).toContain(
      "createExportRouter(backendDeps.registry, exportRouterOptions)",
    );
    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(appSource).not.toContain("repositoryComposition, exportRouterOptions");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);
  });
});
