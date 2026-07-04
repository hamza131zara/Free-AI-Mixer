import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import { executeProductionGeneratedImage } from "../../backend/generation/productionGeneratedImageExecution";
import { parseGenerationRouteExecutionMode } from "../../backend/generation/generationRuntimeConfig";
import {
  createSupabaseGeneratedImageProductionStorage,
  type GeneratedImageProductionStorage,
} from "../../backend/generation/supabaseGeneratedImageProductionStorage";
import { verifyGeneratedImageArtifactBytes } from "../../backend/generation/generatedImageArtifactVerification";
import type { BackendGenerationProviderExecutionResult } from "../../backend/generation/generationProviderAdapter";
import type { ProductionSupabasePersistenceWriter } from "../../backend/persistence/productionSupabasePersistenceBoundary";
import type { BackendProviderKeyRepository } from "../../backend/repositories/repositoryContracts";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const verified = verifyGeneratedImageArtifactBytes({
  bytes: pngBytes,
  contentType: "image/png",
  format: "png",
  maxBytes: 1024,
});

if (verified.kind !== "verified") {
  throw new Error("H6-JB fixture image must be valid.");
}

const verifiedProviderResult: BackendGenerationProviderExecutionResult = {
  kind: "verified_image",
  status: "verified_image",
  verifiedImage: verified.image,
  providerMetadata: { model: "gpt-image-2", providerId: "openai" },
  message: "Verified image bytes are ready.",
};

const executionIdentity = {
  ownerId: "11111111-1111-4111-8111-111111111111",
  projectId: "33333333-3333-4333-8333-333333333333",
  providerId: "openai" as const,
  requestId: "h6jb_request_001",
  workspaceId: "22222222-2222-4222-8222-222222222222",
};

const canonicalPersistence = {
  kind: "persisted" as const,
  status: "persisted" as const,
  outcome: "created" as const,
  generationJobId: "44444444-4444-4444-8444-444444444444",
  artifactId: `${executionIdentity.requestId}_openai_image`,
  historyId: "55555555-5555-4555-8555-555555555555",
  generationJobCreated: true,
  artifactCreated: true,
  historyCreated: true,
};

const createStorage = (options: {
  events?: string[];
  failDelete?: boolean;
  failStore?: boolean;
} = {}) => {
  let storeCount = 0;
  let deleteCount = 0;
  let capturedStoreInput: Record<string, unknown> | undefined;
  const storageRef = {
    provider: "supabase_storage" as const,
    bucket: "private-artifacts",
    objectKey:
      "generated-images/workspace/user/project/job/artifact.png",
    contentType: "image/png" as const,
    sizeBytes: pngBytes.byteLength,
    sha256: verified.image.sha256,
    createdAt: "2026-07-03T12:00:00.000Z",
  };

  const storage: GeneratedImageProductionStorage = {
    getReadiness: () => ({ kind: "ready", status: "available" }),
    store: async (input) => {
      storeCount += 1;
      options.events?.push("upload");
      capturedStoreInput = input;
      if (options.failStore) {
        return {
          kind: "unavailable",
          code: "upload_failed",
          message: "Private upload failed safely.",
        };
      }
      return {
        kind: "stored",
        artifact: {
          artifactId: input.artifactId,
          contentType: input.verifiedImage.contentType,
          createdAt: storageRef.createdAt,
          format: input.verifiedImage.format,
          jobId: input.jobId,
          kind: "generated_image",
          ownerId: input.ownerId,
          providerId: input.providerId,
          sha256: input.verifiedImage.sha256,
          sizeBytes: input.verifiedImage.sizeBytes,
          status: "available",
          workspaceId: input.workspaceId,
        },
        storageRef,
      };
    },
    deleteObject: async () => {
      deleteCount += 1;
      options.events?.push("delete");
      return options.failDelete
        ? {
            kind: "unavailable",
            code: "delete_failed",
            message: "Cleanup failed safely.",
          }
        : { kind: "deleted" };
    },
    readObject: async () => ({
      kind: "unavailable",
      code: "object_not_found",
      message: "Not used by orchestration.",
    }),
    resolveRecord: async () => ({
      kind: "unavailable",
      code: "artifact_not_found",
      message: "Not used by orchestration.",
    }),
  };

  return {
    storage,
    getCapturedStoreInput: () => capturedStoreInput,
    getDeleteCount: () => deleteCount,
    getStoreCount: () => storeCount,
  };
};

const createWriter = (options: {
  events?: string[];
  result?: unknown;
  unavailable?: boolean;
} = {}) => {
  let bundleCount = 0;
  let capturedBundle: Record<string, unknown> | undefined;
  const writer = {
    getReadiness: () =>
      options.unavailable
        ? {
            kind: "unavailable",
            status: "persistence_unavailable",
            message: "Persistence unavailable.",
          }
        : { kind: "ready", status: "available" },
    persistGeneratedImageBundle: async (input: Record<string, unknown>) => {
      bundleCount += 1;
      options.events?.push("persistence");
      capturedBundle = input;
      return options.result ?? canonicalPersistence;
    },
    persistGeneratedArtifactRecord: async () => ({ kind: "persisted", status: "persisted" }),
    persistGenerationJobMetadata: async () => ({ kind: "persisted", status: "persisted" }),
    persistImageGenerationHistory: async () => ({ kind: "persisted", status: "persisted" }),
    persistProjectMetadata: async () => ({ kind: "persisted", status: "persisted" }),
  } as unknown as ProductionSupabasePersistenceWriter;

  return {
    writer,
    getBundleCount: () => bundleCount,
    getCapturedBundle: () => capturedBundle,
  };
};

test.describe("H6-JB real image durable orchestration", () => {
  test("verified bytes flow provider to private upload to one atomic persistence call", async () => {
    const events: string[] = [];
    const storage = createStorage({ events });
    const persistence = createWriter({ events });
    let providerCount = 0;

    const result = await executeProductionGeneratedImage({
      ...executionIdentity,
      executeProvider: async () => {
        providerCount += 1;
        events.push("provider");
        return verifiedProviderResult;
      },
      persistenceWriter: persistence.writer,
      prompt: "Create a safe durable image",
      storage: storage.storage,
    });

    expect(result.kind).toBe("completed");
    expect(events).toEqual(["provider", "upload", "persistence"]);
    expect(providerCount).toBe(1);
    expect(storage.getStoreCount()).toBe(1);
    expect(persistence.getBundleCount()).toBe(1);
    expect(storage.getCapturedStoreInput()).toMatchObject({
      ownerId: executionIdentity.ownerId,
      workspaceId: executionIdentity.workspaceId,
      projectId: executionIdentity.projectId,
      jobId: executionIdentity.requestId,
    });
    expect(persistence.getCapturedBundle()).toMatchObject({
      ownerId: executionIdentity.ownerId,
      workspaceId: executionIdentity.workspaceId,
      projectId: executionIdentity.projectId,
      requestId: executionIdentity.requestId,
      providerId: "openai",
    });
  });

  test("identical concurrent requests share one flight while distinct request IDs do not", async () => {
    const storage = createStorage();
    const persistence = createWriter();
    let providerCount = 0;
    let releaseProvider: (() => void) | undefined;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const input = {
      ...executionIdentity,
      executeProvider: async () => {
        providerCount += 1;
        await providerGate;
        return verifiedProviderResult;
      },
      persistenceWriter: persistence.writer,
      prompt: "Concurrent image",
      storage: storage.storage,
    };

    const first = executeProductionGeneratedImage(input);
    const second = executeProductionGeneratedImage(input);
    releaseProvider?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(providerCount).toBe(1);
    expect(storage.getStoreCount()).toBe(1);
    expect(persistence.getBundleCount()).toBe(1);

    await Promise.all([
      executeProductionGeneratedImage({ ...input, requestId: "h6jb_request_002" }),
      executeProductionGeneratedImage({ ...input, requestId: "h6jb_request_003" }),
    ]);
    expect(providerCount).toBe(3);
  });

  test("a failed flight is removed so an explicit retry can execute", async () => {
    const storage = createStorage();
    const persistence = createWriter();
    let providerCount = 0;
    const input = {
      ...executionIdentity,
      executeProvider: async (): Promise<BackendGenerationProviderExecutionResult> => {
        providerCount += 1;
        return providerCount === 1
          ? {
              kind: "provider_unavailable",
              status: "provider_unavailable",
              errorCode: "provider_unavailable",
              message: "Provider unavailable safely.",
            }
          : verifiedProviderResult;
      },
      persistenceWriter: persistence.writer,
      prompt: "Explicit retry",
      storage: storage.storage,
    };

    await expect(executeProductionGeneratedImage(input)).resolves.toMatchObject({
      kind: "provider_failed",
    });
    await expect(executeProductionGeneratedImage(input)).resolves.toMatchObject({
      kind: "completed",
    });
    expect(providerCount).toBe(2);
  });

  test("provider and upload failures stop later durable steps", async () => {
    const providerStorage = createStorage();
    const providerWriter = createWriter();
    const providerFailure = await executeProductionGeneratedImage({
      ...executionIdentity,
      executeProvider: async () => ({
        kind: "provider_unavailable",
        status: "provider_unavailable",
        errorCode: "provider_unavailable",
        message: "Provider unavailable safely.",
      }),
      persistenceWriter: providerWriter.writer,
      prompt: "Provider failure",
      storage: providerStorage.storage,
    });
    expect(providerFailure.kind).toBe("provider_failed");
    expect(providerStorage.getStoreCount()).toBe(0);
    expect(providerWriter.getBundleCount()).toBe(0);

    const invalidOutputStorage = createStorage();
    const invalidOutputWriter = createWriter();
    const invalidOutput = await executeProductionGeneratedImage({
      ...executionIdentity,
      requestId: "h6jb_invalid_output",
      executeProvider: async () => ({
        kind: "generation_failed",
        status: "generation_failed",
        errorCode: "generation_failed",
        message: "Generated image output failed verification.",
        diagnosticCode: "artifact_verification_failed",
        failureCategory: "artifact_storage",
      }),
      persistenceWriter: invalidOutputWriter.writer,
      prompt: "Invalid output",
      storage: invalidOutputStorage.storage,
    });
    expect(invalidOutput.kind).toBe("provider_failed");
    expect(invalidOutputStorage.getStoreCount()).toBe(0);
    expect(invalidOutputWriter.getBundleCount()).toBe(0);

    const uploadStorage = createStorage({ failStore: true });
    const uploadWriter = createWriter();
    const uploadFailure = await executeProductionGeneratedImage({
      ...executionIdentity,
      requestId: "h6jb_upload_failure",
      executeProvider: async () => verifiedProviderResult,
      persistenceWriter: uploadWriter.writer,
      prompt: "Upload failure",
      storage: uploadStorage.storage,
    });
    expect(uploadFailure.kind).toBe("storage_unavailable");
    expect(uploadWriter.getBundleCount()).toBe(0);
  });

  test("persistence failure compensates the exact upload and cleanup failure stays redacted", async () => {
    for (const failDelete of [false, true]) {
      const storage = createStorage({ failDelete });
      const persistence = createWriter({
        result: {
          kind: "unavailable",
          status: "persistence_write_failed",
          message: "raw database detail",
        },
      });
      const result = await executeProductionGeneratedImage({
        ...executionIdentity,
        requestId: failDelete ? "h6jb_cleanup_failure" : "h6jb_persist_failure",
        executeProvider: async () => verifiedProviderResult,
        persistenceWriter: persistence.writer,
        prompt: "Persistence failure",
        storage: storage.storage,
      });

      expect(result).toEqual({
        kind: "persistence_unavailable",
        message: "Generated image persistence is temporarily unavailable.",
      });
      expect(storage.getDeleteCount()).toBe(1);
      expect(JSON.stringify(result)).not.toContain("raw database detail");
      expect(JSON.stringify(result)).not.toContain("private-artifacts");
    }
  });

  test("missing readiness and malformed atomic results fail closed", async () => {
    const unavailableWriter = createWriter({ unavailable: true });
    const storage = createStorage();
    let providerCount = 0;
    const unavailable = await executeProductionGeneratedImage({
      ...executionIdentity,
      requestId: "h6jb_missing_rpc",
      executeProvider: async () => {
        providerCount += 1;
        return verifiedProviderResult;
      },
      persistenceWriter: unavailableWriter.writer,
      prompt: "Missing RPC",
      storage: storage.storage,
    });
    expect(unavailable.kind).toBe("persistence_unavailable");
    expect(providerCount).toBe(0);

    const missingStorageBase = createStorage();
    const missingStorage = {
      ...missingStorageBase.storage,
      getReadiness: () => ({
        kind: "unavailable" as const,
        status: "storage_not_configured" as const,
        message: "Storage unavailable.",
      }),
    };
    const readyWriter = createWriter();
    const storageUnavailable = await executeProductionGeneratedImage({
      ...executionIdentity,
      requestId: "h6jb_missing_storage",
      executeProvider: async () => {
        providerCount += 1;
        return verifiedProviderResult;
      },
      persistenceWriter: readyWriter.writer,
      prompt: "Missing storage",
      storage: missingStorage,
    });
    expect(storageUnavailable.kind).toBe("storage_unavailable");
    expect(providerCount).toBe(0);

    const malformedWriter = createWriter({
      result: { ...canonicalPersistence, generationJobId: "not-a-uuid" },
    });
    const malformedStorage = createStorage();
    const malformed = await executeProductionGeneratedImage({
      ...executionIdentity,
      requestId: "h6jb_malformed_rpc",
      executeProvider: async () => verifiedProviderResult,
      persistenceWriter: malformedWriter.writer,
      prompt: "Malformed RPC",
      storage: malformedStorage.storage,
    });
    expect(malformed.kind).toBe("persistence_unavailable");
    expect(malformedStorage.getDeleteCount()).toBe(1);
  });

  test("OpenAI adapter returns verified bytes without local staging", async () => {
    const repository = {
      getByProviderKeyId: async () => ({
        providerKeyId: "key-1",
        providerName: "openai",
        workspaceId: executionIdentity.workspaceId,
        ownerId: executionIdentity.ownerId,
        createdByUserId: executionIdentity.ownerId,
        encryptedSecret: {
          algorithm: "AES-256-GCM",
          encryptedPayload: "encrypted-test-value",
          keyVersion: "v1",
        },
        status: "active",
        verificationStatus: "validated",
        needsReverification: false,
      }),
    } as unknown as BackendProviderKeyRepository;
    const vault = {
      getVaultReadiness: () => ({ kind: "vault_ready" }),
      decryptProviderKey: async () => ({
        kind: "vault_provider_key_decrypted",
        status: "decrypted",
        plaintextKey: "test-only-key",
      }),
    } as unknown as ProviderSecretVault;
    let fetchCount = 0;
    const adapter = createOpenAiImageGenerationAdapter({
      fetchImpl: (async () => {
        fetchCount += 1;
        return new Response(
          JSON.stringify({ data: [{ b64_json: pngBytes.toString("base64") }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch,
      outputMode: "return_verified_bytes",
      providerKeyRepository: repository,
      providerSecretVault: vault,
      requestShape: "minimal",
    });

    const result = await adapter.generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "Verified bytes only",
      providerId: "openai",
      providerKeyId: "key-1",
      requestId: "h6jb_adapter_001",
      workspaceId: executionIdentity.workspaceId,
    });

    expect(fetchCount).toBe(1);
    expect(result?.kind).toBe("verified_image");
    if (result?.kind === "verified_image") {
      expect(result.verifiedImage.sha256).toBe(verified.image.sha256);
      expect(result.verifiedImage.bytes).toEqual(verified.image.bytes);
    }
  });

  test("private Supabase storage verifies and deletes deterministic scoped objects", async () => {
    const events: string[] = [];
    let objectKey = "";
    const storage = createSupabaseGeneratedImageProductionStorage({
      bucket: "private-artifacts",
      now: () => "2026-07-03T12:00:00.000Z",
      client: {
        from: () => {
          throw new Error("Database lookup is not used by store.");
        },
        storage: {
          from: () => ({
            upload: async (key) => {
              objectKey = key;
              events.push("upload");
              return { error: null };
            },
            list: async () => ({
              data: [
                {
                  name: objectKey.split("/").at(-1) ?? "",
                  metadata: { mimetype: "image/png", size: pngBytes.byteLength },
                },
              ],
              error: null,
            }),
            download: async () => ({ data: pngBytes, error: null }),
            remove: async (keys) => {
              events.push(`delete:${keys[0]}`);
              return { error: null };
            },
          }),
        },
      },
    });

    const stored = await storage.store({
      artifactId: "h6jb_artifact",
      jobId: "h6jb_job",
      ownerId: "h6jb_owner",
      projectId: "h6jb_project",
      providerId: "openai",
      verifiedImage: verified.image,
      workspaceId: "h6jb_workspace",
    });
    expect(stored.kind).toBe("stored");
    expect(objectKey).toBe(
      "generated-images/h6jb_workspace/h6jb_owner/h6jb_project/h6jb_job/h6jb_artifact.png",
    );
    if (stored.kind === "stored") {
      await expect(storage.deleteObject(stored.storageRef)).resolves.toEqual({
        kind: "deleted",
      });
    }
    expect(events).toEqual(["upload", `delete:${objectKey}`]);
  });

  test("mode parsing and source boundaries preserve local, mock, and video behavior", () => {
    expect(
      parseGenerationRouteExecutionMode({
        FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE: "real_provider_production",
      }),
    ).toBe("real_provider_production");

    const route = readSource("backend/routes/generation.ts");
    expect(route).toContain('routeExecutionMode === "mock_image_local_only"');
    expect(route).toContain('routeExecutionMode === "real_provider_local_only"');
    expect(route).toContain('routeExecutionMode === "real_provider_production"');
    expect(route).toContain('routeExecutionMode !== "mock_video_local_only"');
    expect(
      readSource("backend/generation/productionGeneratedImageExecution.ts"),
    ).toContain("persistGeneratedImageBundle");
    expect(route).not.toContain("createSignedUrl");
    expect(route).not.toContain("getPublicUrl");

    const publicSuccessSnippet = route.slice(
      route.indexOf("OpenAI image generation completed with durable private artifact metadata."),
      route.indexOf("OpenAI image generation completed with durable private artifact metadata.") + 2_000,
    );
    for (const forbidden of [
      "storageRef",
      "objectKey",
      "bucket",
      "bytes",
      "base64",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
      "plaintextKey",
      "ownerId",
      "workspaceId",
    ]) {
      expect(publicSuccessSnippet).not.toContain(forbidden);
    }
  });
});
