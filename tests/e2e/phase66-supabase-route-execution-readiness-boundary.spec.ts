import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase66-supabase-route-execution-readiness-boundary.spec.ts",
);
const routesPath = path.join(process.cwd(), "backend", "routes", "exports.ts");
const harnessPath = path.join(
  process.cwd(),
  "backend",
  "renderer",
  "singleProcessRenderHarness.ts",
);
const renderWorkerPath = path.join(
  process.cwd(),
  "backend",
  "workers",
  "renderWorker.ts",
);
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
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

test.describe("phase66 supabase route execution readiness boundary", () => {
  test("source proves route read/create/execute paths depend only on supported registry methods while route execution gating remains separate", async () => {
    const [
      specSource,
      routesSource,
      harnessSource,
      renderWorkerSource,
      backendDependenciesSource,
      registrySource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(routesPath),
      readFileSource(harnessPath),
      readFileSource(renderWorkerPath),
      readFileSource(backendDependenciesPath),
      readFileSource(registryPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(routesSource).toContain(
      "await registry.getByRequestId(body.requestId, requesterContext)",
    );
    expect(routesSource).toContain("await registry.create({");
    expect(routesSource).toContain(
      "const record = await registry.getByIdForOwner(jobId, requesterContext)",
    );
    expect(routesSource).toContain(
      'process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1"',
    );
    expect(routesSource).toContain("executeRenderJob({");
    expect(routesSource).toContain("registry,");
    expect(routesSource).not.toContain("registry.transition(");
    expect(routesSource).not.toContain("signedUrl");
    expect(routesSource).not.toContain("downloadUrl");
    expect(routesSource).not.toContain("storage_refs");
    expect(routesSource).not.toContain("SupabaseExportJobRegistry");
    expect(routesSource).not.toContain(forbiddenSecretLogging);
    expect(routesSource).not.toContain(forbiddenSupabaseStart);
    expect(routesSource).not.toContain(forbiddenSupabaseLink);
    expect(routesSource).not.toContain(forbiddenSupabaseDb);

    expect(harnessSource).toContain("await input.registry.claim");
    expect(harnessSource).toContain("await input.registry.markRendering");
    expect(harnessSource).toContain("await input.registry.markFinalizing");
    expect(harnessSource).toContain("await input.registry.markSuccess");
    expect(harnessSource).toContain("await input.registry.markError");
    expect(harnessSource).not.toContain("input.registry.transition(");
    expect(harnessSource).not.toContain("signedUrl");
    expect(harnessSource).not.toContain("downloadUrl");
    expect(harnessSource).not.toContain("storage_refs");

    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(renderWorkerSource).toContain('await registry.getByStatus("submitted")');
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");

    expect(backendDependenciesSource).toContain("new SupabaseExportJobRegistry");
    expect(backendDependenciesSource).toContain(
      "repositoryComposition.createRepositories().exportJobsRepository",
    );

    expect(registrySource).toContain("async create(");
    expect(registrySource).toContain("async getByIdForOwner(");
    expect(registrySource).toContain("async claim(");
    expect(registrySource).toContain("async markRendering(");
    expect(registrySource).toContain("async markFinalizing(");
    expect(registrySource).toContain("async markSuccess(");
    expect(registrySource).toContain("async markError(");
    expect(registrySource).toContain('throw this.createNotWiredError("transition")');
    expect(registrySource).not.toContain("signedUrl");
    expect(registrySource).not.toContain("downloadUrl");
    expect(registrySource).not.toContain("storage_refs");
  });

  test("source proves worker rollout remains separate and no runtime route boundary introduces CLI or secret logging", async () => {
    const [
      specSource,
      routesSource,
      renderWorkerSource,
      backendDependenciesSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(routesPath),
      readFileSource(renderWorkerPath),
      readFileSource(backendDependenciesPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(routesSource).toContain(
      'FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1"',
    );
    expect(renderWorkerSource).toContain(
      'FREE_AI_MIXER_ENABLE_WORKER_LOOP === "1"',
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_WORKER_LOOP",
    );
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION",
    );
    expect(backendDependenciesSource).not.toContain(forbiddenSecretLogging);
    expect(routesSource).not.toContain(forbiddenSecretLogging);
    expect(renderWorkerSource).not.toContain(forbiddenSecretLogging);
  });
});
