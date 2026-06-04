import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type { BackendGenerationRouteExecutionMode } from "../../backend/generation/generationRuntimeConfig";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationOpenAiImageRealLocalSmokeEnabled,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import {
  getGenerationExecutionControlReadiness,
} from "../../backend/generation/generationRuntimeOrchestrator";
import {
  createLocalGeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorage,
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
const rawKey = "FAKE_PHASE123_DECRYPTED_KEY_DO_NOT_RETURN";
const promptText = "A phase 123 prompt that must not be echoed";
const providerUrl = "https://api.openai.com/v1/images/generations";
const validPngBase64 = "iVBORw0KGgo=";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase123-subject",
  kind: "authenticated",
  userId: "phase123-user",
  workspaceId: "phase123-workspace",
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
  providerKeyId: "phase123-provider-key",
  providerName: "openai",
  workspaceId: "phase123-workspace",
  ownerId: "phase123-owner",
  createdByUserId: "phase123-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload: "PHASE123_ENCRYPTED_PAYLOAD_NOT_RETURNED",
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
  requestId: "phase123_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  record?: BackendProviderKeyRecord,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (providerKeyId): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase123-provider-key");
    return record;
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase123-workspace");
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

const createVault = (calls: DependencyCalls): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vaultReadiness += 1;
    return { kind: "vault_ready" };
  },
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in generation route execution.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase123-provider-key");
    expect(input.workspaceId).toBe("phase123-workspace");
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
  role: "owner" | "admin" | "member" | "viewer" = "owner",
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase123-user");
    expect(workspaceId).toBe("phase123-workspace");
    return {
      kind: "member",
      membership: {
        role,
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
    | { kind: "response"; status: number; body?: unknown }
    | { kind: "network" }
    | { kind: "timeout" } = {
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

    if (result.kind === "timeout") {
      const error = new Error("mocked abort");
      error.name = "AbortError";
      throw error;
    }

    return new Response(JSON.stringify(result.body ?? { error: "raw body" }), {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "phase123-provider-request-id",
      },
      status: result.status,
    });
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

const makeStorageRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase123-generated-images-"));

const removeStorageRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { force: true, recursive: true });
};

const startGenerationApp = async ({
  controls = controlsReady(),
  fetchResult,
  generationRuntimeConfig = generationRuntimeConfigReady(),
  keyRecord = createActiveValidatedKey(),
  mode = "real_provider_local_only",
  realSmokeEnabled = true,
  requester = authenticatedRequester,
  role = "owner",
  storage,
}: {
  controls?: BackendGenerationExecutionControlReadiness;
  fetchResult?:
    | { kind: "response"; status: number; body?: unknown }
    | { kind: "network" }
    | { kind: "timeout" };
  generationRuntimeConfig?: ReturnType<typeof parseGenerationRuntimeConfig>;
  keyRecord?: BackendProviderKeyRecord | null;
  mode?: BackendGenerationRouteExecutionMode;
  realSmokeEnabled?: boolean;
  requester?: BackendRequesterContext;
  role?: "owner" | "admin" | "member" | "viewer";
  storage?: GeneratedImageArtifactStorage;
} = {}): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
  const calls = createCalls();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: BackendRequesterContext }).backendRequesterContext =
      requester;
    next();
  });

  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "phase123-session",
      },
      ...(storage ? { generatedImageArtifactStorage: createStorage(calls, storage) } : {}),
      generationExecutionControlReadiness: controls,
      generationOpenAiImageRealLocalSmokeEnabled: realSmokeEnabled,
      generationRouteExecutionMode: mode,
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createProviderFetch(calls, fetchResult),
      providerKeyRepository: createProviderKeyRepository(
        calls,
        keyRecord ?? undefined,
      ),
      providerSecretVault: createVault(calls),
      workspaceMembershipRepository: createMembershipRepository(calls, role),
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
    "PHASE123_ENCRYPTED_PAYLOAD_NOT_RETURNED",
    providerUrl,
    validPngBase64,
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
    "b64_json",
    "raw body",
    "phase123-provider-request-id",
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

test.describe("phase123 OpenAI real-provider local route boundary", () => {
  test("real local smoke gate parses fail-closed", () => {
    expect(parseGenerationOpenAiImageRealLocalSmokeEnabled({})).toBe(false);
    expect(
      parseGenerationOpenAiImageRealLocalSmokeEnabled({
        FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED: "1",
      }),
    ).toBe(true);
  });

  test("real provider local-only requires all gates and storage before provider fetch", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const gateOff = parseGenerationRuntimeConfig({
      FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
      FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
    });
    const cases = [
      { expectedStatus: "generation_runtime_disabled", generationRuntimeConfig: gateOff },
      { expectedStatus: "generation_execution_blocked", realSmokeEnabled: false },
      { expectedStatus: "artifact_storage_unavailable", storage: undefined },
    ];

    try {
      for (const entry of cases) {
        const { baseUrl, calls, server } = await startGenerationApp({
          ...entry,
          storage: Object.hasOwn(entry, "storage") ? entry.storage : storage,
        });

        try {
          const { body, status } = await postGenerationJob(baseUrl);
          expect(status).toBe(503);
          expect(body.status).toBe(entry.expectedStatus);
          expect(body.runtime.vendorCallsEnabled).toBe(false);
          expect(calls.decrypt).toBe(0);
          expect(calls.providerFetch).toBe(0);
          expect(calls.storage).toBe(0);
          expectNoLeak(JSON.stringify(body));
        } finally {
          await stopServer(server);
        }
      }
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("unsafe preconditions block before decrypt fetch or storage", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const unsafeRecords = [
      null,
      createActiveValidatedKey({ verificationStatus: "not_validated" }),
      createActiveValidatedKey({ needsReverification: true }),
      createActiveValidatedKey({ revokedAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ disabledAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ rotatedAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ deletedAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ status: "disabled" }),
      createActiveValidatedKey({ status: "rotated" }),
    ];
    const cases = [
      {
        expectedStatus: "unauthenticated",
        requester: { kind: "unauthenticated", reason: "missing_credentials" } as BackendRequesterContext,
      },
      {
        expectedStatus: "workspace_permission_not_verified",
        requester: { ...authenticatedRequester, workspaceId: undefined },
      },
      { expectedStatus: "workspace_owner_or_admin_required", role: "member" as const },
      { expectedStatus: "workspace_owner_or_admin_required", role: "viewer" as const },
      {
        controls: getGenerationExecutionControlReadiness(),
        expectedStatus: "rate_limit_not_configured",
      },
      ...unsafeRecords.map((keyRecord) => ({
        expectedStatus: "provider_key_not_configured",
        keyRecord,
      })),
    ];

    try {
      for (const entry of cases) {
        const { baseUrl, calls, server } = await startGenerationApp({
          ...entry,
          storage,
        });

        try {
          const { body } = await postGenerationJob(baseUrl);
          expect(body.status).toBe(entry.expectedStatus);
          expect(calls.decrypt).toBe(0);
          expect(calls.providerFetch).toBe(0);
          expect(calls.storage).toBe(0);
          expectNoLeak(JSON.stringify(body));
        } finally {
          await stopServer(server);
        }
      }
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("mocked 2xx provider response stores image and returns safe metadata with vendor calls enabled", async () => {
    const originalGlobalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("globalThis.fetch must not run unless explicitly injected.");
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
      expect(body.kind).toBe("generation_job_metadata_ready");
      expect(body.status).toBe("generated_metadata_ready");
      expect(body.artifact).toEqual({
        artifactId: "phase123_request_openai_image",
        providerId: "openai",
        contentType: "image/png",
        sizeBytes: 8,
        sha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
        createdAt: "2026-06-04T00:00:00.000Z",
        deliveryStatus: "unavailable",
      });
      expect(body.runtime.vendorCallsEnabled).toBe(true);
      expect(body.attemptedProviderIds).toEqual(["openai"]);
      expect(calls).toMatchObject({
        decrypt: 1,
        keyLookup: 2,
        membership: 1,
        providerFetch: 1,
        storage: 1,
        vaultReadiness: 1,
      });
      expectNoLeak(JSON.stringify(body));
    } finally {
      globalThis.fetch = originalGlobalFetch;
      await stopServer(server);
      await removeStorageRoot(rootPath);
    }
  });

  test("provider failures map safely without provider body header prompt key or path leaks", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const cases = [
      { expectedStatus: 400, provider: { kind: "response" as const, status: 400 }, status: "invalid_prompt" },
      { expectedStatus: 403, provider: { kind: "response" as const, status: 401 }, status: "invalid_credentials" },
      { expectedStatus: 403, provider: { kind: "response" as const, status: 403 }, status: "invalid_credentials" },
      { expectedStatus: 429, provider: { kind: "response" as const, status: 429 }, status: "rate_limited" },
      { expectedStatus: 504, provider: { kind: "timeout" as const }, status: "timeout" },
      { expectedStatus: 503, provider: { kind: "network" as const }, status: "provider_unavailable" },
      { expectedStatus: 503, provider: { kind: "response" as const, status: 500 }, status: "provider_unavailable" },
    ];

    try {
      for (const entry of cases) {
        const { baseUrl, calls, server } = await startGenerationApp({
          fetchResult: entry.provider,
          storage,
        });

        try {
          const { body, status } = await postGenerationJob(baseUrl);
          expect(status).toBe(entry.expectedStatus);
          expect(body.kind).toBe("generation_job_rejected");
          expect(body.status).toBe(entry.status);
          expect(body.runtime.vendorCallsEnabled).toBe(true);
          expect(body.attemptedProviderIds).toEqual(["openai"]);
          expect(calls.decrypt).toBe(1);
          expect(calls.providerFetch).toBe(1);
          expect(calls.storage).toBe(0);
          expectNoLeak(JSON.stringify(body));
        } finally {
          await stopServer(server);
        }
      }
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("existing mock modes and source boundaries remain safe", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });

    try {
      for (const mode of [
        "disabled",
        "preconditions_only",
        "adapter_mock_only",
        "openai_adapter_mock_only",
        "openai_adapter_mock_storage_only",
      ] as BackendGenerationRouteExecutionMode[]) {
        const { baseUrl, calls, server } = await startGenerationApp({
          mode,
          storage,
        });

        try {
          const { body } = await postGenerationJob(baseUrl);
          if (mode === "real_provider_local_only") {
            continue;
          }
          expect(body.runtime.vendorCallsEnabled).toBe(false);
          if (mode !== "openai_adapter_mock_storage_only") {
            expect(body.kind).toBe("generation_job_rejected");
          }
          expect(calls.providerFetch).toBe(0);
        } finally {
          await stopServer(server);
        }
      }
    } finally {
      await removeStorageRoot(rootPath);
    }

    const routeSource = readSource("backend/routes/generation.ts");
    const appSource = readSource("backend/app.ts");
    const packageJson = readSource("package.json");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");

    expect(routeSource).toContain("real_provider_local_only");
    expect(routeSource).toContain("openAiRealProviderFetch");
    expect(appSource).toContain("generationOpenAiImageRealLocalSmokeEnabled");
    expect(appSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(sceneService).not.toContain("/generation/jobs");
    expect(exportRoute).toContain("route_execution_disabled");

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
      "publicUrl",
      "signedUrl",
      "downloadUrl",
      "internalRef",
      "filePath",
      "rootPath",
    ]) {
      expect(packageJson).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      if (
        forbidden !== "publicUrl" &&
        forbidden !== "signedUrl" &&
        forbidden !== "downloadUrl" &&
        forbidden !== "internalRef" &&
        forbidden !== "filePath" &&
        forbidden !== "rootPath"
      ) {
        expect(unrelatedSource).not.toContain(forbidden);
      }
    }
  });
});
