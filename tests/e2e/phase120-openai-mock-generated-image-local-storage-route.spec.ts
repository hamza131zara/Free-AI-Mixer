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
import type {
  BackendGenerationOpenAiAdapterFetchMode,
  BackendGenerationRouteExecutionMode,
} from "../../backend/generation/generationRuntimeConfig";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationGeneratedImageStorageMode,
  parseGenerationGeneratedImageStorageRoot,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import {
  getGenerationExecutionControlReadiness,
} from "../../backend/generation/generationRuntimeOrchestrator";
import {
  createLocalGeneratedImageArtifactStorage,
  createNotConfiguredGeneratedImageArtifactStorage,
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
const rawKey = "FAKE_PHASE120_DECRYPTED_KEY_DO_NOT_RETURN";
const promptText = "A phase 120 prompt that must not be echoed";
const providerUrl = "https://api.openai.com/v1/images/generations";
const validPngBase64 = "iVBORw0KGgo=";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase120-subject",
  kind: "authenticated",
  userId: "phase120-user",
  workspaceId: "phase120-workspace",
};

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  mockFetch: number;
  storage: number;
  vaultReadiness: number;
}

const createCalls = (): DependencyCalls => ({
  decrypt: 0,
  keyLookup: 0,
  membership: 0,
  mockFetch: 0,
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

const createActiveValidatedKey = (
  patch: Partial<BackendProviderKeyRecord> = {},
): BackendProviderKeyRecord => ({
  providerKeyId: "phase120-provider-key",
  providerName: "openai",
  workspaceId: "phase120-workspace",
  ownerId: "phase120-owner",
  createdByUserId: "phase120-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload: "PHASE120_ENCRYPTED_PAYLOAD_NOT_RETURNED",
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
  requestId: "phase120_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  record?: BackendProviderKeyRecord,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (providerKeyId): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase120-provider-key");
    return record;
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase120-workspace");
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
  readiness: "ready" | "not_configured" = "ready",
): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vaultReadiness += 1;
    return readiness === "ready"
      ? { kind: "vault_ready" }
      : {
          kind: "vault_unavailable",
          message: "Vault unavailable for test.",
          status: "not_configured",
        };
  },
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in generation route execution.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase120-provider-key");
    expect(input.workspaceId).toBe("phase120-workspace");
    expect(input.secretHandle?.kind).toBe("encrypted_secret");
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
    expect(userId).toBe("phase120-user");
    expect(workspaceId).toBe("phase120-workspace");
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

const createMockFetch = (
  calls: DependencyCalls,
  payload: { b64Json?: string; url?: string } | "empty" = {
    b64Json: validPngBase64,
  },
): typeof fetch =>
  (async (input, init) => {
    calls.mockFetch += 1;
    expect(String(input)).toBe(providerUrl);
    expect(init?.method).toBe("POST");
    expect(JSON.stringify(init?.body)).not.toContain(rawKey);
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawKey}`);

    const data = payload === "empty"
      ? []
      : [
          {
            ...(payload.b64Json ? { b64_json: payload.b64Json } : {}),
            ...(payload.url ? { url: payload.url } : {}),
          },
        ];

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
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
  fs.mkdtemp(path.join(os.tmpdir(), "phase120-generated-images-"));

const removeStorageRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { force: true, recursive: true });
};

const startGenerationApp = async ({
  controls = controlsReady(),
  decryptApproved = true,
  fetchMode = "mock_only",
  generationRuntimeConfig = parseGenerationRuntimeConfig({
    FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
    FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
    FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: "1",
  }),
  keyRecord = createActiveValidatedKey(),
  maxImageBytes,
  mode = "openai_adapter_mock_storage_only",
  mockPayload = { b64Json: validPngBase64 },
  requester = authenticatedRequester,
  role = "owner",
  storage,
  vaultReadiness = "ready",
}: {
  controls?: BackendGenerationExecutionControlReadiness;
  decryptApproved?: boolean;
  fetchMode?: BackendGenerationOpenAiAdapterFetchMode;
  generationRuntimeConfig?: ReturnType<typeof parseGenerationRuntimeConfig>;
  keyRecord?: BackendProviderKeyRecord | null;
  maxImageBytes?: number;
  mode?: BackendGenerationRouteExecutionMode;
  mockPayload?: { b64Json?: string; url?: string } | "empty";
  requester?: BackendRequesterContext;
  role?: "owner" | "admin" | "member" | "viewer";
  storage?: GeneratedImageArtifactStorage;
  vaultReadiness?: "ready" | "not_configured";
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
        provider: "phase120-session",
      },
      ...(storage ? { generatedImageArtifactStorage: createStorage(calls, storage) } : {}),
      generatedArtifactStorageReadiness: {
        getReadiness: () => {
          throw new Error("Generated image storage readiness must not drive Phase 120.");
        },
      },
      generationByokDecryptForMockExecutionEnabled: decryptApproved,
      generationExecutionControlReadiness: controls,
      generationOpenAiAdapterFetchMode: fetchMode,
      generationRouteExecutionMode: mode,
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      ...(typeof maxImageBytes === "number" ? { openAiAdapterMaxImageBytes: maxImageBytes } : {}),
      openAiAdapterMockFetch:
        fetchMode === "mock_only" ? createMockFetch(calls, mockPayload) : undefined,
      providerKeyRepository: createProviderKeyRepository(
        calls,
        keyRecord ?? undefined,
      ),
      providerSecretVault: createVault(calls, vaultReadiness),
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
    "PHASE120_ENCRYPTED_PAYLOAD_NOT_RETURNED",
    providerUrl,
    validPngBase64,
    "submitted",
    "running",
    "status\":\"generated\"",
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

test.describe("phase120 OpenAI mock generated-image local storage route", () => {
  test("new storage env parsing remains fail-closed", () => {
    expect(parseGenerationGeneratedImageStorageMode({})).toBe("not_configured");
    expect(
      parseGenerationGeneratedImageStorageMode({
        FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE: "local_staging",
      }),
    ).toBe("local_staging");
    expect(parseGenerationGeneratedImageStorageRoot({})).toBeUndefined();
    expect(
      parseGenerationGeneratedImageStorageRoot({
        FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT: "  C:/safe/generated  ",
      }),
    ).toBe("C:/safe/generated");
  });

  test("existing route modes remain unchanged", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });

    try {
      for (const entry of [
        { attempted: [] as string[], mode: "disabled" as const, status: "generation_runtime_disabled" },
        { attempted: [] as string[], mode: "preconditions_only" as const, status: "generation_execution_blocked" },
        { attempted: [] as string[], mode: "adapter_mock_only" as const, status: "generation_execution_blocked" },
        { attempted: ["openai"], mode: "openai_adapter_mock_only" as const, status: "artifact_storage_unavailable" },
      ]) {
        const { baseUrl, calls, server } = await startGenerationApp({
          mode: entry.mode,
          storage,
        });

        try {
          const { body, status } = await postGenerationJob(baseUrl);
          expect(status).toBe(503);
          expect(body.status).toBe(entry.status);
          expect(body.runtime.vendorCallsEnabled).toBe(false);
          expect(body.attemptedProviderIds).toEqual(entry.attempted);
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

  test("storage mode blocks unsafe states before decrypt fetch or storage", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const generationGateOff = parseGenerationRuntimeConfig({
      FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
      FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
    });
    const cases: Array<{
      controls?: BackendGenerationExecutionControlReadiness;
      decryptApproved?: boolean;
      expectedStatus: string;
      fetchMode?: BackendGenerationOpenAiAdapterFetchMode;
      generationRuntimeConfig?: ReturnType<typeof parseGenerationRuntimeConfig>;
      keyRecord?: BackendProviderKeyRecord | null;
      requester?: BackendRequesterContext;
      role?: "owner" | "admin" | "member" | "viewer";
      storage?: GeneratedImageArtifactStorage;
      vaultReadiness?: "ready" | "not_configured";
    }> = [
      {
        expectedStatus: "unauthenticated",
        requester: { kind: "unauthenticated", reason: "missing_credentials" },
      },
      {
        expectedStatus: "workspace_permission_not_verified",
        requester: { ...authenticatedRequester, workspaceId: undefined },
      },
      { expectedStatus: "workspace_owner_or_admin_required", role: "member" },
      { expectedStatus: "workspace_owner_or_admin_required", role: "viewer" },
      {
        expectedStatus: "generation_runtime_disabled",
        generationRuntimeConfig: generationGateOff,
      },
      {
        controls: getGenerationExecutionControlReadiness(),
        expectedStatus: "rate_limit_not_configured",
      },
      { expectedStatus: "provider_key_not_configured", keyRecord: null },
      {
        expectedStatus: "provider_key_not_configured",
        keyRecord: createActiveValidatedKey({ verificationStatus: "not_validated" }),
      },
      {
        expectedStatus: "provider_key_not_configured",
        keyRecord: createActiveValidatedKey({ needsReverification: true }),
      },
      { expectedStatus: "generation_execution_blocked", fetchMode: "not_configured" },
      { decryptApproved: false, expectedStatus: "generation_execution_blocked" },
      { expectedStatus: "generation_execution_blocked", vaultReadiness: "not_configured" },
      { expectedStatus: "artifact_storage_unavailable", storage: undefined },
    ];

    try {
      for (const entry of cases) {
        const { baseUrl, calls, server } = await startGenerationApp({
          ...entry,
          storage: Object.hasOwn(entry, "storage") ? entry.storage : storage,
        });

        try {
          const { body } = await postGenerationJob(baseUrl);
          expect(body.status).toBe(entry.expectedStatus);
          expect(calls.decrypt).toBe(0);
          expect(calls.mockFetch).toBe(0);
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

  test("valid mocked PNG verifies stores locally and returns safe metadata only", async () => {
    const originalGlobalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("globalThis.fetch must not run in Phase 120 route execution.");
    }) as typeof fetch;
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({
      now: () => "2026-06-04T00:00:00.000Z",
      rootPath,
    });
    const { baseUrl, calls, server } = await startGenerationApp({ storage });

    try {
      const { body, status } = await postGenerationJob(baseUrl);
      const serialized = JSON.stringify(body);

      expect(status).toBe(200);
      expect(body.kind).toBe("generation_job_metadata_ready");
      expect(body.status).toBe("generated_metadata_ready");
      expect(body.message).toBe(
        "Mock OpenAI adapter output was verified and stored locally for backend smoke only; delivery remains unavailable.",
      );
      expect(body.artifact).toEqual({
        artifactId: "phase120_request_openai_image",
        providerId: "openai",
        contentType: "image/png",
        sizeBytes: 8,
        sha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
        createdAt: "2026-06-04T00:00:00.000Z",
        deliveryStatus: "unavailable",
      });
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["openai"]);
      expect(calls).toMatchObject({
        decrypt: 1,
        keyLookup: 2,
        membership: 1,
        mockFetch: 1,
        storage: 1,
        vaultReadiness: 1,
      });
      expectNoLeak(serialized);
      const storedPath = path.join(
        rootPath,
        "phase120_request",
        "phase120_request_openai_image.png",
      );
      await fs.access(storedPath);
    } finally {
      globalThis.fetch = originalGlobalFetch;
      await stopServer(server);
      await removeStorageRoot(rootPath);
    }
  });

  test("invalid empty mismatched oversized and URL image outputs map safely", async () => {
    const rootPath = await makeStorageRoot();
    const storage = createLocalGeneratedImageArtifactStorage({ rootPath });
    const jpegBase64 = Buffer.from([0xff, 0xd8, 0x00, 0xff, 0xd9]).toString("base64");
    const invalidCases: Array<{
      expectedStatus: string;
      maxImageBytes?: number;
      payload: { b64Json?: string; url?: string } | "empty";
    }> = [
      { expectedStatus: "generation_execution_blocked", payload: { b64Json: "not-valid-base64" } },
      { expectedStatus: "artifact_storage_unavailable", payload: "empty" },
      { expectedStatus: "generation_execution_blocked", payload: { b64Json: jpegBase64 } },
      { expectedStatus: "generation_execution_blocked", maxImageBytes: 1, payload: { b64Json: validPngBase64 } },
      { expectedStatus: "artifact_storage_unavailable", payload: { url: "https://example.invalid/image.png" } },
    ];

    try {
      for (const entry of invalidCases) {
        const { baseUrl, calls, server } = await startGenerationApp({
          maxImageBytes: entry.maxImageBytes,
          mockPayload: entry.payload,
          storage,
        });

        try {
          const { body, status } = await postGenerationJob(baseUrl);
          expect(status).toBe(503);
          expect(body.status).toBe(entry.expectedStatus);
          expect(body.runtime.vendorCallsEnabled).toBe(false);
          expect(body.attemptedProviderIds).toEqual(["openai"]);
          expect(calls.decrypt).toBe(1);
          expect(calls.mockFetch).toBe(1);
          expectNoLeak(JSON.stringify(body));
        } finally {
          await stopServer(server);
        }
      }
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("not configured and failing storage roots map safely without path leakage", async () => {
    const cases: GeneratedImageArtifactStorage[] = [
      createNotConfiguredGeneratedImageArtifactStorage(),
      createLocalGeneratedImageArtifactStorage({
        rootPath: path.join(await makeStorageRoot(), "..", "unsafe", "\0"),
      }),
    ];

    for (const storage of cases) {
      const { baseUrl, server } = await startGenerationApp({ storage });

      try {
        const { body, status } = await postGenerationJob(baseUrl);
        expect(status).toBe(503);
        expect(body.status).toBe("artifact_storage_unavailable");
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("source boundaries keep frontend export credits billing provider calls and delivery untouched", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const appSource = readSource("backend/app.ts");
    const backendDependencies = readSource("backend/composition/backendDependencies.ts");
    const packageJson = readSource("package.json");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");

    expect(routeSource).toContain("openai_adapter_mock_storage_only");
    expect(routeSource).toContain("generatedImageArtifactStorage");
    expect(routeSource).toContain("deliveryStatus: \"unavailable\"");
    expect(routeSource).not.toContain("globalThis.fetch");
    expect(appSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(backendDependencies).not.toContain("createOpenAiImageGenerationAdapter");
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
