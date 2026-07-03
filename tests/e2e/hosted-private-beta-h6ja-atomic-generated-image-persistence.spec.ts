import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  createSupabaseProductionPersistenceWriter,
  type SupabaseGeneratedImageBundleRpcRow,
  type SupabaseGeneratedImageBundleRpcResult,
  type SupabaseProductionPersistenceClient,
} from "../../backend/persistence/supabaseProductionPersistenceWriter";
import type { ProductionGeneratedImageBundleInput } from "../../backend/persistence/productionSupabasePersistenceBoundary";

const root = process.cwd();
const readSource = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const toStableUuid = (value: string): string => {
  const bytes = Buffer.from(createHash("sha256").update(value).digest("hex"), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

const bundleInput: ProductionGeneratedImageBundleInput = {
  artifactId: "artifact-h6ja-001",
  contentType: "image/png",
  createdAt: "2026-07-03T12:00:00.000Z",
  jobId: "job-h6ja-001",
  ownerId: "11111111-1111-4111-8111-111111111111",
  projectId: "33333333-3333-4333-8333-333333333333",
  promptSummary: "Safe generated image summary",
  providerId: "openai",
  requestId: "request-h6ja-001",
  sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  sizeBytes: 128,
  storageRef: {
    provider: "supabase_storage",
    bucket: "private-artifacts",
    objectKey: "workspace/job/artifact.png",
    contentType: "image/png",
    sizeBytes: 128,
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    createdAt: "2026-07-03T12:00:00.000Z",
  },
  workspaceId: "22222222-2222-4222-8222-222222222222",
};

const canonicalIds = {
  generationJobId: toStableUuid(
    `generation_job:${bundleInput.workspaceId}:${bundleInput.ownerId}:${bundleInput.jobId}`,
  ),
  historyId: toStableUuid(
    `image_generation_history:${bundleInput.workspaceId}:${bundleInput.ownerId}:${bundleInput.jobId}:${bundleInput.artifactId}`,
  ),
};

const rpcResult = (
  outcome: "created" | "replayed",
): SupabaseGeneratedImageBundleRpcResult => ({
  data: [
    {
      outcome,
      generation_job_id: canonicalIds.generationJobId,
      artifact_id: bundleInput.artifactId,
      history_id: canonicalIds.historyId,
      generation_job_created: outcome === "created",
      artifact_created: outcome === "created",
      history_created: outcome === "created",
    },
  ],
  error: null,
});

const createRpcClient = (
  resultFactory: (
    parameters: Record<string, unknown>,
  ) => SupabaseGeneratedImageBundleRpcResult,
) => {
  const calls: Array<{
    functionName: string;
    parameters: Record<string, unknown>;
  }> = [];
  let tableCallCount = 0;

  const client = {
    from: () => {
      tableCallCount += 1;
      throw new Error("Atomic bundle persistence must not use table inserts.");
    },
    rpc: async (functionName: string, parameters: Record<string, unknown>) => {
      calls.push({ functionName, parameters });
      return resultFactory(parameters);
    },
  } as unknown as SupabaseProductionPersistenceClient;

  return {
    calls,
    client,
    getTableCallCount: () => tableCallCount,
  };
};

test.describe("H6-JA atomic generated-image persistence", () => {
  test("migration defines a locked backend-only transactional RPC", () => {
    const migration = readSource(
      "backend/db/migrations/0011_h6j_atomic_generated_image_persistence.sql",
    );

    expect(migration).toContain("begin;");
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
    expect(migration).toContain(
      "create function public.free_ai_mixer_persist_generated_image_bundle",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toMatch(
      /pg_catalog\.hashtextextended\(\s*p_idempotency_key,\s*0/s,
    );
    expect(migration).toContain("p_idempotency_key");
    expect(migration).toContain(
      "create table public.generated_image_bundle_idempotency",
    );
    expect(migration).toContain(
      "generated_image_bundle_idempotency already exists",
    );
    expect(migration).toMatch(/idempotency_key text primary key/);
    expect(migration).toMatch(
      /from public\.generated_image_bundle_idempotency[\s\S]*idempotency_key = p_idempotency_key/,
    );
    expect(migration).toContain(
      "v_idempotency.workspace_id is distinct from p_workspace_id",
    );
    expect(migration).toContain(
      "v_idempotency.storage_object_key is distinct from p_storage_object_key",
    );
    expect(migration).toMatch(
      /revoke all on table public\.generated_image_bundle_idempotency\s+from public, anon, authenticated, service_role;/,
    );
    expect(migration).toContain("'replayed'::text");
    expect(migration).toContain("'created'::text");
    expect(migration).toMatch(/from public;[\s\S]*from anon;[\s\S]*from authenticated;/);
    expect(migration).toMatch(/grant execute[\s\S]*to service_role;/);
    expect(migration).not.toContain("create or replace function");
  });

  test("one bundle write invokes one RPC and no independent table inserts", async () => {
    const recording = createRpcClient(() => rpcResult("created"));
    const writer = createSupabaseProductionPersistenceWriter(recording.client);

    const result = await writer.persistGeneratedImageBundle(bundleInput);

    expect(recording.calls).toHaveLength(1);
    expect(recording.calls[0].functionName).toBe(
      "free_ai_mixer_persist_generated_image_bundle",
    );
    expect(recording.getTableCallCount()).toBe(0);
    expect(recording.calls[0].parameters).toMatchObject({
      p_artifact_id: bundleInput.artifactId,
      p_generation_job_id: canonicalIds.generationJobId,
      p_history_id: canonicalIds.historyId,
      p_idempotency_key: bundleInput.requestId,
      p_owner_id: bundleInput.ownerId,
      p_project_id: bundleInput.projectId,
      p_workspace_id: bundleInput.workspaceId,
    });
    expect(result).toMatchObject({
      kind: "persisted",
      outcome: "created",
      generationJobCreated: true,
      artifactCreated: true,
      historyCreated: true,
    });
  });

  test("an exact replay preserves canonical IDs and truthful false flags", async () => {
    const recording = createRpcClient(() => rpcResult("replayed"));
    const writer = createSupabaseProductionPersistenceWriter(recording.client);

    await expect(writer.persistGeneratedImageBundle(bundleInput)).resolves.toEqual({
      kind: "persisted",
      status: "persisted",
      outcome: "replayed",
      generationJobId: canonicalIds.generationJobId,
      artifactId: bundleInput.artifactId,
      historyId: canonicalIds.historyId,
      generationJobCreated: false,
      artifactCreated: false,
      historyCreated: false,
    });
    expect(recording.calls).toHaveLength(1);
  });

  test("a missing RPC dependency fails closed without table writes", async () => {
    let tableCallCount = 0;
    const client = {
      from: () => {
        tableCallCount += 1;
        throw new Error("Bundle persistence must not fall back to inserts.");
      },
    } as unknown as SupabaseProductionPersistenceClient;
    const writer = createSupabaseProductionPersistenceWriter(client);

    await expect(writer.persistGeneratedImageBundle(bundleInput)).resolves.toEqual({
      kind: "unavailable",
      status: "persistence_write_failed",
      message: "Generated image persistence is temporarily unavailable.",
    });
    expect(tableCallCount).toBe(0);
  });

  test("empty, multiple, malformed, unknown, and conflicting RPC results fail closed", async () => {
    const createdRow = (rpcResult("created").data as SupabaseGeneratedImageBundleRpcRow[])[0];
    const cases: SupabaseGeneratedImageBundleRpcResult[] = [
      { data: null, error: null },
      { data: [], error: null },
      { data: createdRow, error: null },
      { data: [createdRow, createdRow], error: null },
      { data: [{ ...createdRow, outcome: "unknown" }], error: null },
      { data: [{ ...createdRow, artifact_created: false }], error: null },
      { data: rpcResult("created").data, error: { code: "P6001", message: "database conflict detail" } },
    ];

    for (const rpcResponse of cases) {
      const recording = createRpcClient(() => rpcResponse);
      const writer = createSupabaseProductionPersistenceWriter(recording.client);
      const result = await writer.persistGeneratedImageBundle(bundleInput);

      expect(result).toEqual({
        kind: "unavailable",
        status: "persistence_write_failed",
        message: "Generated image persistence is temporarily unavailable.",
      });
      expect(JSON.stringify(result)).not.toContain("database conflict detail");
      expect(JSON.stringify(result)).not.toContain(bundleInput.storageRef.bucket);
      expect(JSON.stringify(result)).not.toContain(bundleInput.storageRef.objectKey);
      expect(recording.calls).toHaveLength(1);
    }
  });

  test("RPC exceptions are redacted and legacy mock persistence stays available", async () => {
    const rpcClient = createRpcClient(() => {
      throw new Error("raw SQL and storage detail");
    });
    const writer = createSupabaseProductionPersistenceWriter(rpcClient.client);

    const bundleResult = await writer.persistGeneratedImageBundle(bundleInput);
    expect(bundleResult).toMatchObject({
      kind: "unavailable",
      status: "persistence_write_failed",
    });
    expect(JSON.stringify(bundleResult)).not.toContain("raw SQL");

    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const legacyClient = {
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return {
            then: (resolve: (value: { error: null }) => unknown) =>
              Promise.resolve(resolve({ error: null })),
          };
        },
      }),
    } as unknown as SupabaseProductionPersistenceClient;
    const legacyWriter = createSupabaseProductionPersistenceWriter(legacyClient);

    await expect(
      legacyWriter.persistGenerationJobMetadata({
        generationKind: "image",
        jobId: "mock-job",
        ownerId: bundleInput.ownerId,
        projectId: bundleInput.projectId,
        providerId: "mock_local",
        requestId: "mock-request",
        status: "generated_metadata_ready",
        workspaceId: bundleInput.workspaceId,
      }),
    ).resolves.toMatchObject({ kind: "persisted" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("generation_jobs");
  });

  test("the atomic writer contains no external provider or network execution", () => {
    const writerSource = readSource(
      "backend/persistence/supabaseProductionPersistenceWriter.ts",
    );

    expect(writerSource).not.toMatch(/\bfetch\s*\(/);
    expect(writerSource).not.toContain("api.openai.com");
    expect(writerSource).not.toContain("generativelanguage.googleapis.com");
  });
});
