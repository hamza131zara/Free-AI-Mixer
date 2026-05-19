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

const expectNoPromiseReturn = (source: string, signature: string): void => {
  expect(source).toContain(signature);
  expect(source).not.toContain(`${signature}: Promise<`);
};

test.describe("phase48 export job registry async boundary", () => {
  test("source proves registry is sync, supabase repository is async, and runtime wiring remains deferred", async () => {
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

    expectNoPromiseReturn(
      registryContractSource,
      "create(input: CreateExportJobInput): BackendExportJobRecord;",
    );
    expectNoPromiseReturn(
      registryContractSource,
      "getById(jobId: string): BackendExportJobRecord | undefined;",
    );
    expectNoPromiseReturn(
      registryContractSource,
      "getByStatus(status: BackendExportLifecycleStatus): BackendExportJobRecord[];",
    );
    expectNoPromiseReturn(
      registryContractSource,
      "markRendering(jobId: string, workerId: string): BackendExportJobRecord;",
    );
    expectNoPromiseReturn(
      registryContractSource,
      "transition(",
    );
    expect(registryContractSource).not.toContain("Promise<BackendExportJobRecord");

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
    expect(supabaseRegistrySource).toContain(
      'if (result && typeof result === "object" && "then" in result)',
    );
    expect(supabaseRegistrySource).toContain(
      "received an async repository dependency",
    );
    expect(supabaseRegistrySource).not.toContain("await jobsRepository");
    expect(supabaseRegistrySource).not.toContain("await this.getJobsRepository");
    expect(supabaseRegistrySource).not.toContain("createClient(");
    expect(supabaseRegistrySource).not.toContain("readSupabaseConfigFromEnv");
    expect(supabaseRegistrySource).not.toContain(forbiddenSecretLogging);
    expect(supabaseRegistrySource).not.toContain(forbiddenSupabaseStart);
    expect(supabaseRegistrySource).not.toContain(forbiddenSupabaseLink);
    expect(supabaseRegistrySource).not.toContain(forbiddenSupabaseDb);

    expect(exportsRouteSource).toContain(
      "const existingRecord = registry.getByRequestId(body.requestId, requesterContext);",
    );
    expect(exportsRouteSource).toContain(
      "const record = registry.getByIdForOwner(jobId, requesterContext);",
    );
    expect(exportsRouteSource).not.toContain("await registry.getByRequestId");
    expect(exportsRouteSource).not.toContain("await registry.getByIdForOwner");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("repositoryComposition");

    expect(renderWorkerSource).toContain(
      'const submittedJobs = registry.getByStatus("submitted");',
    );
    expect(renderWorkerSource).not.toContain("await registry.getByStatus");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("repositoryComposition");

    expect(renderHarnessSource).toContain(
      "input.registry.claim(input.jobId, input.workerId);",
    );
    expect(renderHarnessSource).toContain(
      "input.registry.markRendering(input.jobId, input.workerId);",
    );
    expect(renderHarnessSource).toContain(
      "input.registry.markFinalizing(input.jobId, input.workerId);",
    );
    expect(renderHarnessSource).toContain(
      "input.registry.markSuccess(input.jobId, input.workerId, [verification.artifact]);",
    );
    expect(renderHarnessSource).toContain(
      "input.registry.markError(input.jobId, input.workerId, asExportFailure(mapped));",
    );
    expect(renderHarnessSource).not.toContain("await input.registry.claim");
    expect(renderHarnessSource).not.toContain("await input.registry.markRendering");
    expect(renderHarnessSource).not.toContain("await input.registry.markFinalizing");
    expect(renderHarnessSource).not.toContain("await input.registry.markSuccess");
    expect(renderHarnessSource).not.toContain("await input.registry.markError");

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
