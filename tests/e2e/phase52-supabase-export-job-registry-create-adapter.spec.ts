import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BackendExportJobRecord } from "../../backend/contracts/exportHttpTypes";
import {
  SupabaseExportJobRegistry,
  type SupabaseExportJobRegistryReadRepository,
} from "../../backend/registry/supabaseExportJobRegistry";

const specPath = path.join(
  process.cwd(),
  "tests",
  "e2e",
  "phase52-supabase-export-job-registry-create-adapter.spec.ts",
);
const adapterPath = path.join(
  process.cwd(),
  "backend",
  "registry",
  "supabaseExportJobRegistry.ts",
);
const appPath = path.join(process.cwd(), "backend", "app.ts");
const backendDependenciesPath = path.join(
  process.cwd(),
  "backend",
  "composition",
  "backendDependencies.ts",
);
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
  jobId: "job-phase52-existing",
  requestId: "request-phase52",
  timelineId: "timeline-phase52",
  ownerId: "owner-phase52",
  workspaceId: "workspace-phase52",
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

const withPatchedRandomUuid = async (
  jobId: string,
  run: () => Promise<void>,
): Promise<void> => {
  const original = globalThis.crypto.randomUUID;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => jobId,
    configurable: true,
  });

  try {
    await run();
  } finally {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      value: original,
      configurable: true,
    });
  }
};

test.describe("phase52 supabase export job registry create adapter", () => {
  test("create delegates to createIfAbsent, returns created/existing records, throws on conflict, and keeps blocked methods fail-closed", async () => {
    const createCalls: BackendExportJobRecord[] = [];
    let nextCreateResult:
      | Awaited<
          ReturnType<
            NonNullable<SupabaseExportJobRegistryReadRepository["createIfAbsent"]>
          >
        >
      | undefined;

    const existingRecord = createRecord();

    const fakeRepository: SupabaseExportJobRegistryReadRepository = {
      createIfAbsent: async (candidate) => {
        createCalls.push(candidate);
        if (!nextCreateResult) {
          throw new Error("nextCreateResult was not configured");
        }

        return nextCreateResult;
      },
      getByJobId: async () => undefined,
      getByIdempotencyScope: async () => undefined,
    };

    const registry = new SupabaseExportJobRegistry({
      dependencies: {
        jobsRepository: fakeRepository,
      },
    });

    await withPatchedRandomUuid("job-phase52-created", async () => {
      nextCreateResult = {
        kind: "created",
        record: createRecord({
          jobId: "job-phase52-created",
          requestId: "request-created",
          timelineId: "timeline-created",
          ownerId: "owner-created",
          workspaceId: "workspace-created",
        }),
      };

      await expect(
        registry.create({
          requestId: "request-created",
          timelineId: "timeline-created",
          renderSettings: existingRecord.renderSettings,
          ownerId: "owner-created",
          workspaceId: "workspace-created",
        }),
      ).resolves.toEqual(nextCreateResult.record);

      expect(createCalls).toHaveLength(1);
      expect(createCalls[0]).toMatchObject({
        jobId: "job-phase52-created",
        requestId: "request-created",
        timelineId: "timeline-created",
        ownerId: "owner-created",
        workspaceId: "workspace-created",
        status: "submitted",
        attemptCount: 0,
        renderSettings: existingRecord.renderSettings,
      });
      expect(createCalls[0].createdAt).toBeTruthy();
      expect(createCalls[0].updatedAt).toBeTruthy();
      expect(createCalls[0]).not.toHaveProperty("startedAt");
      expect(createCalls[0]).not.toHaveProperty("claimExpiresAt");
      expect(createCalls[0]).not.toHaveProperty("claimedByWorkerId");
      expect(createCalls[0]).not.toHaveProperty("renderingAt");
      expect(createCalls[0]).not.toHaveProperty("finalizingAt");
      expect(createCalls[0]).not.toHaveProperty("completedAt");
      expect(createCalls[0]).not.toHaveProperty("expiredAt");
      expect(createCalls[0]).not.toHaveProperty("failure");
      expect(createCalls[0]).not.toHaveProperty("artifacts");
    });

    createCalls.length = 0;
    nextCreateResult = {
      kind: "existing",
      record: existingRecord,
    };
    await expect(
      registry.create({
        requestId: existingRecord.requestId,
        timelineId: existingRecord.timelineId,
        renderSettings: existingRecord.renderSettings,
        ownerId: existingRecord.ownerId,
        workspaceId: existingRecord.workspaceId,
      }),
    ).resolves.toBe(existingRecord);
    expect(createCalls).toHaveLength(1);

    createCalls.length = 0;
    nextCreateResult = {
      kind: "conflict",
      reason: "job_id_mismatch",
      existingRecord,
    };
    await expect(
      registry.create({
        requestId: existingRecord.requestId,
        timelineId: existingRecord.timelineId,
        renderSettings: existingRecord.renderSettings,
        ownerId: existingRecord.ownerId,
        workspaceId: existingRecord.workspaceId,
      }),
    ).rejects.toThrow(/different jobId/);
    expect(createCalls).toHaveLength(1);

    createCalls.length = 0;
    nextCreateResult = {
      kind: "conflict",
      reason: "non_create_safe_difference",
      existingRecord,
    };
    await expect(
      registry.create({
        requestId: existingRecord.requestId,
        timelineId: existingRecord.timelineId,
        renderSettings: existingRecord.renderSettings,
        ownerId: existingRecord.ownerId,
        workspaceId: existingRecord.workspaceId,
      }),
    ).rejects.toThrow(/create-time payload/);
    expect(createCalls).toHaveLength(1);

    const expectedErrorPattern =
      /SupabaseExportJobRegistry is a boundary scaffold only and is not wired for runtime DB persistence yet\./;

    await expect(registry.getByStatus("submitted")).rejects.toThrow(expectedErrorPattern);
    await expect(registry.claim("job-phase52", "worker-phase52")).rejects.toThrow(
      expectedErrorPattern,
    );
    await expect(
      registry.markRendering("job-phase52", "worker-phase52"),
    ).rejects.toThrow(expectedErrorPattern);
    await expect(
      registry.markFinalizing("job-phase52", "worker-phase52"),
    ).rejects.toThrow(expectedErrorPattern);
    await expect(
      registry.markSuccess("job-phase52", "worker-phase52", []),
    ).rejects.toThrow(expectedErrorPattern);
    await expect(
      registry.markError("job-phase52", "worker-phase52", { message: "failure" }),
    ).rejects.toThrow(expectedErrorPattern);
    await expect(registry.transition("job-phase52", "rendering")).rejects.toThrow(
      expectedErrorPattern,
    );
  });

  test("source proves adapter-only create wiring and no runtime dependency activation", async () => {
    const [
      specSource,
      adapterSource,
      appSource,
      backendDependenciesSource,
      exportsRouteSource,
      renderWorkerSource,
    ] = await Promise.all([
      readFileSource(specPath),
      readFileSource(adapterPath),
      readFileSource(appPath),
      readFileSource(backendDependenciesPath),
      readFileSource(exportsRoutePath),
      readFileSource(renderWorkerPath),
    ]);

    const forbiddenSecretLogging = buildForbiddenSecretLoggingPattern();
    const forbiddenSupabaseStart = buildForbiddenCliPattern("start");
    const forbiddenSupabaseLink = buildForbiddenCliPattern("link");
    const forbiddenSupabaseDb = buildForbiddenCliPattern("db ");

    expect(specSource).toContain("createIfAbsent");
    expect(specSource).toContain("job_id_mismatch");
    expect(specSource).toContain("non_create_safe_difference");
    expect(specSource).not.toContain(forbiddenSecretLogging);
    expect(specSource).not.toContain(forbiddenSupabaseStart);
    expect(specSource).not.toContain(forbiddenSupabaseLink);
    expect(specSource).not.toContain(forbiddenSupabaseDb);

    expect(adapterSource).toContain("async create(_input: CreateExportJobInput)");
    expect(adapterSource).toContain("jobsRepository.createIfAbsent(record)");
    expect(adapterSource).toContain("status: \"submitted\"");
    expect(adapterSource).toContain("attemptCount: 0");
    expect(adapterSource).toContain("result.reason === \"job_id_mismatch\"");
    expect(adapterSource).toContain("existing job differs from the requested create-time payload");
    expect(adapterSource).not.toContain("upsertJob");
    expect(adapterSource).not.toContain("../routes/");
    expect(adapterSource).not.toContain("../workers/");
    expect(adapterSource).not.toContain("../composition/");
    expect(adapterSource).not.toContain("createClient(");
    expect(adapterSource).not.toContain("readSupabaseConfigFromEnv");
    expect(adapterSource).not.toContain(forbiddenSecretLogging);
    expect(adapterSource).not.toContain(forbiddenSupabaseStart);
    expect(adapterSource).not.toContain(forbiddenSupabaseLink);
    expect(adapterSource).not.toContain(forbiddenSupabaseDb);

    expect(appSource).not.toContain("SupabaseExportJobRegistry");
    expect(backendDependenciesSource).not.toContain("SupabaseExportJobRegistry");
    expect(exportsRouteSource).not.toContain("SupabaseExportJobRegistry");
    expect(renderWorkerSource).not.toContain("SupabaseExportJobRegistry");
    expect(backendDependenciesSource).toContain("new InMemoryExportJobRegistry()");
  });
});
