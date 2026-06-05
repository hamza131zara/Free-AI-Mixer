import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs, readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import {
  createLocalGeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorageResult,
} from "../../backend/generation/generatedImageArtifactStorage";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const originalFetch = globalThis.fetch;
const rawKey = "FAKE_PHASE126_DECRYPTED_KEY_DO_NOT_RETURN";
const promptText = "A phase 126 prompt that must stay out of responses";
const providerUrl = "https://api.openai.com/v1/images/generations";
const validPngBase64 = "iVBORw0KGgo=";
const invalidPngBase64 = Buffer.from("not-a-png").toString("base64");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase126-subject",
  kind: "authenticated",
  userId: "phase126-user",
  workspaceId: "phase126-workspace",
};

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  providerFetch: number;
  storage: number;
  vaultReadiness: number;
}

const createCalls = (): DependencyCalls => ({
  decrypt: 0,
  keyLookup: 0,
  membership: 0,
  providerFetch: 0,
  storage: 0,
  vaultReadiness: 0,
});

const controlsReady = (): BackendGenerationExecutionControlReadiness => ({
  kind: "generation_execution_controls_readiness",
  costControlsReady: true,
  idempotencyReady: true,
  rateLimitReady: true,
  singleFlightReady: true,
});

const generationRuntimeConfigReady = () =>
  parseGenerationRuntimeConfig({
    FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
    FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
    FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: "1",
  });

const createActiveValidatedKey = (
  patch: Partial<BackendProviderKeyRecord> = {},
): BackendProviderKeyRecord => ({
  providerKeyId: "phase126-provider-key",
  providerName: "openai",
  workspaceId: "phase126-workspace",
  ownerId: "phase126-owner",
  createdByUserId: "phase126-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload: "PHASE126_ENCRYPTED_PAYLOAD_NOT_RETURNED",
    keyVersion: "v1",
  },
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
  ...patch,
});

const validJobRequest = () => ({
  generationKind: "image",
  prompt: promptText,
  providerId: "openai",
  requestId: "phase126_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  record = createActiveValidatedKey(),
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (providerKeyId): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase126-provider-key");
    return record;
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase126-workspace");
    expect(providerId).toBe("openai");
    return record;
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in generation route execution.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in generation route execution.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in generation route execution.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in generation route execution.");
  },
});

const createVault = (
  calls: DependencyCalls,
  options: { decryptReady?: boolean; readinessReady?: boolean } = {},
): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vaultReadiness += 1;
    return options.readinessReady === false
      ? {
          kind: "vault_unavailable",
          message: "Vault is not configured.",
          status: "not_configured",
        }
      : { kind: "vault_ready" };
  },
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in generation route execution.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase126-provider-key");
    expect(input.workspaceId).toBe("phase126-workspace");

    if (options.decryptReady === false) {
      return {
        kind: "vault_decrypt_failed",
        message: "Vault decrypt failed.",
        status: "decrypt_failed",
      };
    }

    return {
      kind: "vault_provider_key_decrypted",
      plaintextKey: rawKey,
      status: "decrypted",
    };
  },
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in generation route execution.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in generation route execution.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in generation route execution.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase126-user");
    expect(workspaceId).toBe("phase126-workspace");
    return {
      kind: "member",
      membership: {
        role: "owner",
        source: "workspace_memberships",
        status: "active",
        userId,
        workspaceId,
      },
    };
  },
});

const createProviderFetch = (
  calls: DependencyCalls,
  result:
    | { kind: "response"; status: number; body?: unknown; rawBody?: string }
    | { kind: "network" } = {
    body: { data: [{ b64_json: validPngBase64 }] },
    kind: "response",
    status: 200,
  },
): typeof fetch =>
  (async (input, init) => {
    calls.providerFetch += 1;
    expect(String(input)).toBe(providerUrl);
    expect(init?.method).toBe("POST");
    expect(JSON.stringify(init?.body)).not.toContain(rawKey);
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawKey}`);

    if (result.kind === "network") {
      throw new Error("mocked network failure");
    }

    return new Response(
      result.rawBody ?? JSON.stringify(result.body ?? { rawProviderBody: true }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "phase126-provider-request-id",
        },
        status: result.status,
      },
    );
  }) as typeof fetch;

const createStorage = (
  calls: DependencyCalls,
  storage: GeneratedImageArtifactStorage,
): GeneratedImageArtifactStorage => ({
  cleanup: (input) => storage.cleanup(input),
  store: async (input) => {
    calls.storage += 1;
    return storage.store(input);
  },
});

const createFailingStorage = (calls: DependencyCalls): GeneratedImageArtifactStorage => ({
  cleanup: async () => ({ kind: "cleaned" }),
  store: async (): Promise<GeneratedImageArtifactStorageResult> => {
    calls.storage += 1;
    return {
      kind: "failed",
      code: "write_failed",
      message: "Generated image artifact write failed.",
    };
  },
});

const makeStorageRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase126-generated-images-"));

const removeStorageRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { force: true, recursive: true });
};

const startGenerationApp = async ({
  fetchResult,
  realSmokeEnabled = true,
  storage,
  vaultOptions,
}: {
  fetchResult?:
    | { kind: "response"; status: number; body?: unknown; rawBody?: string }
    | { kind: "network" };
  realSmokeEnabled?: boolean;
  storage?: GeneratedImageArtifactStorage;
  vaultOptions?: { decryptReady?: boolean; readinessReady?: boolean };
} = {}): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
  const calls = createCalls();
  const generationRuntimeConfig = generationRuntimeConfigReady();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: BackendRequesterContext }).backendRequesterContext =
      authenticatedRequester;
    next();
  });

  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "phase126-session",
      },
      ...(storage ? { generatedImageArtifactStorage: createStorage(calls, storage) } : {}),
      generationExecutionControlReadiness: controlsReady(),
      generationOpenAiImageRealLocalSmokeEnabled: realSmokeEnabled,
      generationRouteExecutionMode: "real_provider_local_only",
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createProviderFetch(calls, fetchResult),
      providerKeyRepository: createProviderKeyRepository(calls),
      providerSecretVault: createVault(calls, vaultOptions),
      workspaceMembershipRepository: createMembershipRepository(calls),
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    calls,
    server,
  };
};

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

const postGenerationJob = async (
  baseUrl: string,
  body: unknown = validJobRequest(),
) => {
  const response = await originalFetch(`${baseUrl}/generation/jobs`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return {
    body: await response.json(),
    status: response.status,
  };
};

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawKey,
    promptText,
    "PHASE126_ENCRYPTED_PAYLOAD_NOT_RETURNED",
    providerUrl,
    validPngBase64,
    invalidPngBase64,
    "workspaceId",
    "ownerId",
    "providerKeyId",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "bytes",
    "\"b64_json\":",
    "\"base64\":",
    "rawProviderBody",
    "phase126-provider-request-id",
    "encrypted_payload",
    "secret_ref",
    "service_role",
    "JWT",
    "fake_success",
    "fake_progress",
    "fake_artifact",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase126 OpenAI real smoke failure diagnostics", () => {
  test("existing successful mocked real-provider local behavior remains unchanged", async () => {
    const originalGlobalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("globalThis.fetch must not run in mocked diagnostics.");
    }) as typeof fetch;
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({
      now: () => "2026-06-04T00:00:00.000Z",
      rootPath,
    });
    const { baseUrl, calls, server } = await startGenerationApp({ storage });

    try {
      const { body, status } = await postGenerationJob(baseUrl);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        kind: "generation_job_metadata_ready",
        status: "generated_metadata_ready",
        artifact: {
          artifactId: "phase126_request_openai_image",
          providerId: "openai",
          contentType: "image/png",
          sizeBytes: 8,
          sha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
          createdAt: "2026-06-04T00:00:00.000Z",
          deliveryStatus: "unavailable",
        },
        attemptedProviderIds: ["openai"],
      });
      expect(body.diagnosticCode).toBeUndefined();
      expect(body.failureCategory).toBeUndefined();
      expect(body.runtime.vendorCallsEnabled).toBe(true);
      expect(calls).toMatchObject({
        decrypt: 1,
        keyLookup: 2,
        membership: 1,
        providerFetch: 1,
        storage: 1,
      });
      expectNoLeak(JSON.stringify(body));
    } finally {
      globalThis.fetch = originalGlobalFetch;
      await stopServer(server);
      await removeStorageRoot(rootPath);
    }
  });

  test("safe route diagnostics identify missing real gate storage and vault readiness before provider fetch", async () => {
    const cases = [
      {
        expectedDiagnosticCode: "real_provider_gate_missing",
        expectedFailureCategory: "runtime_gate",
        expectedStatus: "generation_execution_blocked",
        realSmokeEnabled: false,
        storage: undefined,
      },
      {
        expectedDiagnosticCode: "real_provider_storage_not_ready",
        expectedFailureCategory: "artifact_storage",
        expectedStatus: "artifact_storage_unavailable",
        realSmokeEnabled: true,
        storage: undefined,
      },
      {
        expectedDiagnosticCode: "vault_not_ready",
        expectedFailureCategory: "vault",
        expectedStatus: "vault_decrypt_failed",
        realSmokeEnabled: true,
        storage: createFailingStorage(createCalls()),
        vaultOptions: { readinessReady: false },
      },
    ];

    for (const entry of cases) {
      const { baseUrl, calls, server } = await startGenerationApp({
        realSmokeEnabled: entry.realSmokeEnabled,
        storage: entry.storage,
        vaultOptions: entry.vaultOptions,
      });

      try {
        const { body, status } = await postGenerationJob(baseUrl);
        expect(status).toBe(503);
        expect(body).toMatchObject({
          kind: "generation_job_rejected",
          status: entry.expectedStatus,
          diagnosticCode: entry.expectedDiagnosticCode,
          failureCategory: entry.expectedFailureCategory,
        });
        expect(calls.providerFetch).toBe(0);
        expect(calls.storage).toBe(0);
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("provider response and storage failures map to sanitized diagnostics", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const responseCases = [
      {
        diagnosticCode: "provider_url_output_unsupported",
        failureCategory: "provider_response",
        result: { kind: "response" as const, status: 200, body: { data: [{ url: "https://provider.example/image.png" }] } },
        status: "artifact_storage_unavailable",
      },
      {
        diagnosticCode: "provider_missing_b64_json",
        failureCategory: "provider_response",
        result: { kind: "response" as const, status: 200, body: { data: [{}] } },
        status: "artifact_storage_unavailable",
      },
      {
        diagnosticCode: "provider_empty_data",
        failureCategory: "provider_response",
        result: { kind: "response" as const, status: 200, body: { data: [] } },
        status: "artifact_storage_unavailable",
      },
      {
        diagnosticCode: "provider_response_shape_unsupported",
        failureCategory: "provider_response",
        result: { kind: "response" as const, status: 200, body: { data: [{ b64_json: validPngBase64 }, { b64_json: validPngBase64 }] } },
        status: "artifact_storage_unavailable",
      },
      {
        diagnosticCode: "provider_malformed_json",
        failureCategory: "provider_response",
        result: { kind: "response" as const, status: 200, rawBody: "{not-json" },
        status: "artifact_storage_unavailable",
      },
      {
        diagnosticCode: "artifact_verification_failed",
        failureCategory: "artifact_storage",
        result: { kind: "response" as const, status: 200, body: { data: [{ b64_json: invalidPngBase64 }] } },
        status: "generation_failed",
      },
      {
        diagnosticCode: "provider_fetch_failed",
        failureCategory: "provider_fetch",
        result: { kind: "network" as const },
        status: "provider_unavailable",
      },
      {
        diagnosticCode: "provider_5xx",
        failureCategory: "provider_fetch",
        result: { kind: "response" as const, status: 500 },
        status: "provider_unavailable",
      },
      {
        diagnosticCode: "provider_unexpected_status",
        failureCategory: "provider_status",
        result: { kind: "response" as const, status: 418 },
        status: "generation_failed",
      },
      {
        diagnosticCode: "provider_unexpected_status",
        failureCategory: "provider_status",
        result: { kind: "response" as const, status: 422 },
        status: "generation_failed",
      },
    ];

    try {
      for (const entry of responseCases) {
        const { baseUrl, calls, server } = await startGenerationApp({
          fetchResult: entry.result,
          storage,
        });

        try {
          const { body, status } = await postGenerationJob(baseUrl);
          expect(status).toBe(503);
          expect(body).toMatchObject({
            kind: "generation_job_rejected",
            status: entry.status,
            diagnosticCode: entry.diagnosticCode,
            failureCategory: entry.failureCategory,
            attemptedProviderIds: ["openai"],
          });
          expect(body.runtime.vendorCallsEnabled).toBe(true);
          expect(calls.decrypt).toBe(1);
          expect(calls.providerFetch).toBe(1);
          expectNoLeak(JSON.stringify(body));
        } finally {
          await stopServer(server);
        }
      }

      const { baseUrl, calls, server } = await startGenerationApp({
        storage: createFailingStorage(createCalls()),
      });

      try {
        const { body, status } = await postGenerationJob(baseUrl);
        expect(status).toBe(503);
        expect(body).toMatchObject({
          kind: "generation_job_rejected",
          status: "artifact_storage_unavailable",
          diagnosticCode: "artifact_storage_write_failed",
          failureCategory: "artifact_storage",
        });
        expect(calls.providerFetch).toBe(1);
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("vault decrypt failure maps safely and never fetches provider", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const { baseUrl, calls, server } = await startGenerationApp({
      storage,
      vaultOptions: { decryptReady: false },
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl);
      expect(status).toBe(503);
      expect(body).toMatchObject({
        kind: "generation_job_rejected",
        status: "vault_decrypt_failed",
        diagnosticCode: "vault_decrypt_failed",
        failureCategory: "vault",
      });
      expect(calls.decrypt).toBe(1);
      expect(calls.providerFetch).toBe(0);
      expect(calls.storage).toBe(0);
      expectNoLeak(JSON.stringify(body));
    } finally {
      await stopServer(server);
      await removeStorageRoot(rootPath);
    }
  });

  test("source boundaries do not add SDK frontend export credits or fake artifact behavior", () => {
    const packageJson = readSource("package.json");
    const adapterSource = readSource("backend/generation/openAiImageGenerationAdapter.ts");
    const routeSource = readSource("backend/routes/generation.ts");
    const phase123 = readSource("tests/e2e/phase123-openai-real-provider-local-route-boundary.spec.ts");
    const phase120 = readSource("tests/e2e/phase120-openai-mock-generated-image-local-storage-route.spec.ts");
    const frontendSource = [
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/store/sceneStore.ts"),
      readSource("src/agents/sceneGenerationAgent.ts"),
    ].join("\n");
    const unrelatedRuntimeSource = [
      readSource("backend/routes/exports.ts"),
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/services/billingService.ts"),
    ].join("\n");

    expect(adapterSource).toContain("provider_response_shape_unsupported");
    expect(routeSource).toContain("diagnosticCode");
    expect(phase123).toContain("real_provider_local_only");
    expect(phase120).toContain("openai_adapter_mock_storage_only");

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "recordLedger",
      "mutateLedger",
      "checkoutEnabled",
      "/generation/jobs",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
    ]) {
      expect(packageJson).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      if (
        forbidden !== "/generation/jobs" &&
        forbidden !== "publicUrl" &&
        forbidden !== "signedUrl" &&
        forbidden !== "downloadUrl"
      ) {
        expect(unrelatedRuntimeSource).not.toContain(forbidden);
      }
    }
  });
});
