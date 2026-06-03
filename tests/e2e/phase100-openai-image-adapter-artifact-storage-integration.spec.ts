import { expect, test } from "@playwright/test";
import express from "express";
import { mkdtempSync, readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import {
  createLocalGeneratedImageArtifactStorage,
  createNotConfiguredGeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorage,
} from "../../backend/generation/generatedImageArtifactStorage";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import { createGenerationRouter } from "../../backend/routes/generation";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE100_OPENAI_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE100_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE100_SECRET_REF_DO_NOT_RETURN";
const jwtLike = "phase100.header.payload";
const serviceRoleLike = "supabase_service_role_PHASE100_DO_NOT_RETURN";
const encryptionKeyLike = Buffer.alloc(32).toString("base64");
const providerResponseBody = "FAKE_PHASE100_PROVIDER_BODY_DO_NOT_RETURN";
const providerImageUrl = "https://example.invalid/phase100-provider-image.png";
const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const validBase64Image = pngBytes.toString("base64");
const jpegBase64Image = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9,
]).toString("base64");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    jwtLike,
    serviceRoleLike,
    encryptionKeyLike,
    providerResponseBody,
    providerImageUrl,
    validBase64Image,
    jpegBase64Image,
    "encrypted_payload",
    "secret_ref",
    "b64_json",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "localPath",
    "signedUrl",
    "publicUrl",
    "downloadUrl",
    "providerResponseBody",
    "rawPrompt",
    "Authorization",
    "request_id",
    "organization",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class Phase100ProviderKeyRepository implements BackendProviderKeyRepository {
  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    return {
      providerKeyId,
      providerName: "openai",
      workspaceId: "phase100-workspace",
      ownerId: "phase100-owner",
      createdByUserId: "phase100-owner",
      encryptedSecret: {
        algorithm: "AES-256-GCM",
        encryptedPayload,
        keyVersion: "v1",
      },
      status: "active",
    };
  }

  async listForWorkspace(): Promise<BackendProviderKeyRecord[]> {
    return [];
  }

  async createProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 100 tests.",
    };
  }

  async replaceProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 100 tests.",
    };
  }

  async revokeProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 100 tests.",
    };
  }

  async updateProviderKeyValidationState(
    _input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    return {
      kind: "validation_state_unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 100 tests.",
    };
  }
}

const createReadyVault = (): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 100 tests.",
  }),
  decryptProviderKey: async () => ({
    kind: "vault_provider_key_decrypted",
    status: "decrypted",
    plaintextKey: rawProviderKey,
  }),
  storeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 100 tests.",
  }),
  revokeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 100 tests.",
  }),
  rotateProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 100 tests.",
  }),
});

const createFetchForPayload = (
  payload: Record<string, unknown>,
  onRequest?: (input: RequestInfo | URL, init?: RequestInit) => void,
): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    onRequest?.(input, init);

    return {
      headers: new Headers({ "x-request-id": "req_phase100_do_not_return" }),
      json: async () => payload,
      status: 200,
      text: async () => providerResponseBody,
    } as Response;
  }) as typeof fetch;

const generate = async ({
  fetchImpl,
  generatedImageArtifactStorage,
  maxImageBytes,
  requestId = "phase100_request",
}: {
  fetchImpl: typeof fetch;
  generatedImageArtifactStorage?: GeneratedImageArtifactStorage;
  maxImageBytes?: number;
  requestId?: string;
}) =>
  createOpenAiImageGenerationAdapter({
    fetchImpl,
    generatedImageArtifactStorage,
    maxImageBytes,
    providerKeyRepository: new Phase100ProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: "A safe single-image prompt",
    providerId: "openai",
    providerKeyId: "phase100-provider-key",
    requestId,
    workspaceId: "phase100-workspace",
  });

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

const startGenerationApp = async (
  requesterContext: BackendRequesterContext,
): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: BackendRequesterContext }).backendRequesterContext =
      requesterContext;
    next();
  });
  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "future_session_provider",
      },
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
};

test.describe("phase100 OpenAI image adapter storage integration", () => {
  test("2xx with no storage or not-configured storage remains artifact-storage-unavailable", async () => {
    const payload = { data: [{ b64_json: validBase64Image }] };
    const noStorage = await generate({
      fetchImpl: createFetchForPayload(payload),
    });
    const notConfigured = await generate({
      fetchImpl: createFetchForPayload(payload),
      generatedImageArtifactStorage: createNotConfiguredGeneratedImageArtifactStorage(),
    });

    expect(noStorage).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expect(notConfigured).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expectNoLeak(JSON.stringify([noStorage, notConfigured]));
  });

  test("valid mocked b64_json plus injected local storage returns safe generated metadata only", async () => {
    const rootPath = mkdtempSync(path.join(os.tmpdir(), "phase100-generated-"));
    let requestCount = 0;
    const result = await generate({
      fetchImpl: createFetchForPayload(
        { data: [{ b64_json: validBase64Image }] },
        (input, init) => {
          requestCount += 1;
          expect(input.toString()).toBe("https://api.openai.com/v1/images/generations");
          expect(init?.method).toBe("POST");
        },
      ),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        now: () => "2026-06-03T00:00:00.000Z",
        rootPath,
      }),
    });

    expect(requestCount).toBe(1);
    expect(result).toMatchObject({
      kind: "generated",
      status: "generated",
      artifact: {
        artifactId: "phase100_request_openai_image",
        contentType: "image/png",
        createdAt: "2026-06-03T00:00:00.000Z",
        generationKind: "image",
        providerId: "openai",
        sizeBytes: 12,
        status: "metadata_only",
        storageState: "metadata_only",
      },
    });

    if (result?.kind === "generated") {
      expect(result.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    }

    expectNoLeak(JSON.stringify(result));
  });

  test("provider URL output is rejected without fetching or serializing the URL", async () => {
    let requestCount = 0;
    const result = await generate({
      fetchImpl: createFetchForPayload(
        { data: [{ url: providerImageUrl }] },
        () => {
          requestCount += 1;
        },
      ),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: mkdtempSync(path.join(os.tmpdir(), "phase100-url-")),
      }),
    });

    expect(requestCount).toBe(1);
    expect(result).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expectNoLeak(JSON.stringify(result));
  });

  test("invalid empty mismatched oversized base64 and storage write failures map safely", async () => {
    const invalidBase64 = await generate({
      fetchImpl: createFetchForPayload({ data: [{ b64_json: "not base64!" }] }),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: mkdtempSync(path.join(os.tmpdir(), "phase100-invalid-")),
      }),
    });
    const emptyBase64 = await generate({
      fetchImpl: createFetchForPayload({ data: [{ b64_json: Buffer.alloc(0).toString("base64") }] }),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: mkdtempSync(path.join(os.tmpdir(), "phase100-empty-")),
      }),
    });
    const mismatchedBase64 = await generate({
      fetchImpl: createFetchForPayload({ data: [{ b64_json: jpegBase64Image }] }),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: mkdtempSync(path.join(os.tmpdir(), "phase100-mismatch-")),
      }),
    });
    const oversizedBase64 = await generate({
      fetchImpl: createFetchForPayload({ data: [{ b64_json: validBase64Image }] }),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: mkdtempSync(path.join(os.tmpdir(), "phase100-oversized-")),
      }),
      maxImageBytes: 4,
    });
    const storageWriteFailure = await generate({
      fetchImpl: createFetchForPayload({ data: [{ b64_json: validBase64Image }] }),
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: mkdtempSync(path.join(os.tmpdir(), "phase100-write-")),
      }),
      requestId: "../unsafe",
    });

    expect(invalidBase64).toMatchObject({
      kind: "generation_failed",
      errorCode: "generation_failed",
    });
    expect(emptyBase64).toMatchObject({
      kind: "generation_failed",
      errorCode: "generation_failed",
    });
    expect(mismatchedBase64).toMatchObject({
      kind: "generation_failed",
      errorCode: "generation_failed",
    });
    expect(oversizedBase64).toMatchObject({
      kind: "generation_failed",
      errorCode: "generation_failed",
    });
    expect(storageWriteFailure).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });

    expectNoLeak(
      JSON.stringify([
        invalidBase64,
        emptyBase64,
        mismatchedBase64,
        oversizedBase64,
        storageWriteFailure,
      ]),
    );
  });

  test("generation route remains disabled and vendor calls remain false", async () => {
    const { baseUrl, server } = await startGenerationApp({
      authProvider: "session",
      authSubject: "phase100-subject",
      kind: "authenticated",
      userId: "phase100-user",
      workspaceId: "phase100-workspace",
    });

    try {
      const statusResponse = await fetch(`${baseUrl}/generation/runtime-status`);
      const statusBody = await statusResponse.json();
      const jobResponse = await fetch(`${baseUrl}/generation/jobs`, {
        body: JSON.stringify({
          prompt: "A safe prompt",
          rawApiKey: rawProviderKey,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const jobBody = await jobResponse.json();

      expect(statusBody.runtime.vendorCallsEnabled).toBe(false);
      expect(statusBody.runtime.executionState).toBe("disabled_by_default");
      expect(jobResponse.status).toBe(503);
      expect(jobBody.status).toBe("generation_runtime_disabled");
      expect(jobBody.runtime.vendorCallsEnabled).toBe(false);
      expectNoLeak(JSON.stringify([statusBody, jobBody]));
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries avoid frontend changes provider SDKs public delivery fake artifacts and unrelated runtime expansion", () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const routeSource = readSource("backend/routes/generation.ts");
    const backendDependencies = readSource("backend/composition/backendDependencies.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/store/sceneStore.ts"),
      readSource("src/agents/sceneGenerationAgent.ts"),
      readSource("src/pages/MixerPage.tsx"),
    ].join("\n");
    const creditsBillingSource = [
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/services/billingService.ts"),
    ].join("\n");
    const exportRouteSource = readSource("backend/routes/exports.ts");

    expect(adapterSource).toContain("generatedImageArtifactStorage");
    expect(adapterSource).toContain("verifyGeneratedImageArtifactBytes");
    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(backendDependencies).not.toContain("createOpenAiImageGenerationAdapter");

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "signedUrl:",
      "publicUrl:",
      "downloadUrl:",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "generation_enabled",
    ]) {
      expect(adapterSource).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(frontendSource).not.toContain("GeneratedImageArtifactMetadata");
    expect(frontendSource).not.toContain("/v1/images/generations");
    expect(creditsBillingSource).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(exportRouteSource).toContain("route_execution_disabled");
  });
});
