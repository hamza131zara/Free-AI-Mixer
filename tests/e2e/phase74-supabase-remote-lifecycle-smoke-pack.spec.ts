import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readSupabaseConfigFromEnv } from "../../backend/config/supabaseConfig";
import { createSupabaseClientFactory } from "../../backend/db/supabaseClientFactory";
import { createRepositoryComposition } from "../../backend/composition/repositoryComposition";
import { SupabaseExportJobRegistry } from "../../backend/registry/supabaseExportJobRegistry";
import type { BackendArtifactMetadata } from "../../backend/contracts/exportHttpTypes";

const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_LIFECYCLE_SMOKE";
const REQUIRED_ENV_KEYS = [
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
] as const;

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase74-supabase-remote-lifecycle-smoke-pack.spec.ts",
);
const configPath = path.join(
  process.cwd(),
  "backend",
  "config",
  "supabaseConfig.ts",
);
const clientFactoryPath = path.join(
  process.cwd(),
  "backend",
  "db",
  "supabaseClientFactory.ts",
);
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
const repositoryCompositionPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "repositoryComposition.ts",
);
const registryPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const repositoryPath = path.join(
  process.cwd(),
  "backend",
  "repositories",
  "supabaseExportJobsRepository.ts",
);

const readFileSource = async (filePath: string): Promise<string> =>
  fs.readFile(filePath, "utf8");

const getMissingRequiredEnvKeys = (): string[] =>
  REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });

const sanitizeSupabaseErrorMessage = (error: unknown): string => {
  const secret = process.env.FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY ?? "";
  const projectUrl = process.env.FREE_AI_MIXER_SUPABASE_URL ?? "";

  if (error instanceof Error) {
    return error.message
      .replaceAll(secret, "[redacted]")
      .replaceAll(projectUrl, "[redacted]");
  }

  return "Unknown remote Supabase lifecycle smoke failure.";
};

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

const buildForbiddenGenericTransitionCallPattern = (): string =>
  ["await registry", "transition("].join(".");

const buildForbiddenFieldPattern = (
  ...parts: string[]
): string => parts.join("");

test.describe("phase74 supabase remote lifecycle smoke pack", () => {
  test("source keeps remote lifecycle smoke opt-in only and avoids CLI, secret logging, generic transition, worker loop activation, and signed/download/storage URL behavior", async () => {
    const [
      specSource,
      configSource,
      clientFactorySource,
      backendDependenciesSource,
      repositoryCompositionSource,
      registrySource,
      repositorySource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(configPath),
      readFileSource(clientFactoryPath),
      readFileSource(backendDependenciesPath),
      readFileSource(repositoryCompositionPath),
      readFileSource(registryPath),
      readFileSource(repositoryPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");
    const forbiddenGenericTransitionCall =
      buildForbiddenGenericTransitionCallPattern();
    const forbiddenSignedUrlField = buildForbiddenFieldPattern(
      "signed",
      "Url",
    );
    const forbiddenDownloadUrlField = buildForbiddenFieldPattern(
      "download",
      "Url",
    );
    const forbiddenStorageRefsField = buildForbiddenFieldPattern(
      "storage",
      "_refs",
    );
    const forbiddenStorageRefField = buildForbiddenFieldPattern(
      "storage",
      "Ref",
    );
    const forbiddenWorkerLoopEnv = buildForbiddenFieldPattern(
      "FREE_AI_MIXER_ENABLE_WORKER",
      "_LOOP",
    );

    expect(specSource).toContain(
      'const OPT_IN_ENV = "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_LIFECYCLE_SMOKE"',
    );
    expect(specSource).toContain("test.skip(");
    expect(specSource).toContain("markRendering");
    expect(specSource).toContain("markFinalizing");
    expect(specSource).toContain("markSuccess");
    expect(specSource).not.toContain(forbiddenGenericTransitionCall);
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);
    expect(specSource).not.toContain(forbiddenSignedUrlField);
    expect(specSource).not.toContain(forbiddenDownloadUrlField);
    expect(specSource).not.toContain(forbiddenStorageRefsField);
    expect(specSource).not.toContain(forbiddenWorkerLoopEnv);

    expect(configSource).toContain("FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY");
    expect(clientFactorySource).toContain("createClient(");
    expect(clientFactorySource).not.toContain(forbiddenSecretLogging);

    expect(backendDependenciesSource).toContain("drainBackendWorkerOnce");
    expect(backendDependenciesSource).not.toContain(
      "FREE_AI_MIXER_RUN_REMOTE_SUPABASE_LIFECYCLE_SMOKE",
    );
    expect(repositoryCompositionSource).toContain(
      'kind: "repository_composition_available"',
    );

    expect(registrySource).toContain('async markRendering(');
    expect(registrySource).toContain('async markFinalizing(');
    expect(registrySource).toContain('async markSuccess(');
    expect(registrySource).not.toContain(forbiddenSecretLogging);

    expect(repositorySource).toContain('async markSuccessIfOwned(');
    expect(repositorySource).toContain('from("artifact_records")');
    expect(repositorySource).not.toContain(forbiddenSignedUrlField);
    expect(repositorySource).not.toContain(forbiddenDownloadUrlField);
    expect(repositorySource).not.toContain(
      `from("${forbiddenStorageRefsField}")`,
    );
  });

  test("remote lifecycle smoke is opt-in, fails safely on incomplete env, and exercises create-read-claim-render-finalize-success only when enabled", async () => {
    test.skip(
      process.env[OPT_IN_ENV] !== "1",
      `Set ${OPT_IN_ENV}=1 to run the remote Supabase lifecycle smoke test.`,
    );

    const missingEnvKeys = getMissingRequiredEnvKeys();
    expect(
      missingEnvKeys,
      `Remote Supabase lifecycle smoke is opt-in and requires env vars: ${missingEnvKeys.join(", ")}`,
    ).toEqual([]);

    const config = readSupabaseConfigFromEnv(process.env);
    expect(config.enabled).toBe(true);
    expect(config.valid).toBe(true);

    const clientFactoryResult = createSupabaseClientFactory(config);
    expect(clientFactoryResult.kind).toBe("supabase_client_factory");

    if (clientFactoryResult.kind !== "supabase_client_factory") {
      throw new Error(
        "Remote Supabase lifecycle smoke requires a valid backend-only client factory.",
      );
    }

    const repositoryComposition = createRepositoryComposition(
      config,
      clientFactoryResult,
    );
    expect(repositoryComposition.kind).toBe("repository_composition_available");

    if (repositoryComposition.kind !== "repository_composition_available") {
      throw new Error(
        "Remote Supabase lifecycle smoke requires a repository composition.",
      );
    }

    const repositories = repositoryComposition.createRepositories();
    const registry = new SupabaseExportJobRegistry({
      dependencies: {
        jobsRepository: repositories.exportJobsRepository,
      },
    });
    const adminHandle = clientFactoryResult.createAdminClientHandle();
    const runId = `phase74_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const ownerId = `phase74-owner-${runId}`;
    const workspaceId = `phase74-workspace-${runId}`;
    const requestId = `phase74-request-${runId}`;
    const timelineId = `phase74-timeline-${runId}`;
    const workerId = `phase74-worker-${runId}`;
    const artifact: BackendArtifactMetadata = {
      artifactId: `phase74-artifact-${runId}`,
      jobId: "",
      kind: "render_output",
      format: "mp4",
      status: "available",
      createdAt: new Date().toISOString(),
      sizeBytes: 1024,
      durationMs: 1000,
    };

    try {
      const created = await registry.create({
        requestId,
        timelineId,
        ownerId,
        workspaceId,
        renderSettings: {
          format: "mp4",
          resolution: "720p",
          fps: 24,
          quality: "draft",
        },
      });

      artifact.jobId = created.jobId;

      const readById = await registry.getById(created.jobId);
      const readByRequestId = await registry.getByRequestId(requestId, {
        ownerId,
        workspaceId,
      });
      const claimed = await registry.claim(created.jobId, workerId, {
        claimTtlMs: 60_000,
      });
      const rendering = await registry.markRendering(created.jobId, workerId);
      const finalizing = await registry.markFinalizing(created.jobId, workerId);
      const succeeded = await registry.markSuccess(created.jobId, workerId, [
        artifact,
      ]);
      const readBack = await registry.getById(created.jobId);
      const artifactRecordResult = await adminHandle.client
        .from("artifact_records")
        .select(
          "artifact_id, job_id, kind, format, status, size_bytes, duration_ms, created_at",
        )
        .eq("job_id", created.jobId)
        .eq("artifact_id", artifact.artifactId)
        .limit(1);

      expect(readById?.jobId).toBe(created.jobId);
      expect(readByRequestId?.jobId).toBe(created.jobId);
      expect(created.status).toBe("submitted");
      expect(claimed.status).toBe("submitted");
      expect(rendering.status).toBe("rendering");
      expect(finalizing.status).toBe("finalizing");
      expect(succeeded.status).toBe("success");
      expect(readBack?.status).toBe("success");

      expect(succeeded.artifacts).toEqual([
        {
          artifactId: artifact.artifactId,
          jobId: created.jobId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          createdAt: artifact.createdAt,
          sizeBytes: 1024,
          durationMs: 1000,
        },
      ]);
      expect(JSON.stringify(succeeded)).not.toContain(forbiddenSignedUrlField);
      expect(JSON.stringify(succeeded)).not.toContain(
        forbiddenDownloadUrlField,
      );
      expect(JSON.stringify(succeeded)).not.toContain(
        forbiddenStorageRefField,
      );

      expect(artifactRecordResult.error).toBeNull();
      expect(Array.isArray(artifactRecordResult.data)).toBe(true);
      expect(artifactRecordResult.data).toEqual([
        {
          artifact_id: artifact.artifactId,
          job_id: created.jobId,
          kind: "render_output",
          format: "mp4",
          status: "available",
          size_bytes: 1024,
          duration_ms: 1000,
          created_at: artifact.createdAt,
        },
      ]);
    } catch (error) {
      throw new Error(
        `Remote Supabase lifecycle smoke failed: ${sanitizeSupabaseErrorMessage(error)}`,
      );
    }
  });
});
