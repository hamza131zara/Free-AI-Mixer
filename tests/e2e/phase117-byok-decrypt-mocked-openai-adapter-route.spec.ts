import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendGenerationOpenAiAdapterFetchMode,
  BackendGenerationRouteExecutionMode,
} from "../../backend/generation/generationRuntimeConfig";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationByokDecryptForMockExecutionEnabled,
  parseGenerationOpenAiAdapterFetchMode,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import {
  getGenerationExecutionControlReadiness,
} from "../../backend/generation/generationRuntimeOrchestrator";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const originalFetch = globalThis.fetch;
const rawKey = "FAKE_PHASE117_DECRYPTED_KEY_DO_NOT_RETURN";
const promptText = "A phase 117 prompt that must not be echoed";
const providerUrl = "https://api.openai.com/v1/images/generations";
const b64Json = "iVBORw0KGgo=";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase117-subject",
  kind: "authenticated",
  userId: "phase117-user",
  workspaceId: "phase117-workspace",
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
  providerKeyId: "phase117-provider-key",
  providerName: "openai",
  workspaceId: "phase117-workspace",
  ownerId: "phase117-owner",
  createdByUserId: "phase117-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload: "PHASE117_ENCRYPTED_PAYLOAD_NOT_RETURNED",
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
  requestId: "phase117_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  record?: BackendProviderKeyRecord,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (providerKeyId): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase117-provider-key");
    return record;
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase117-workspace");
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
    expect(input.providerKeyId).toBe("phase117-provider-key");
    expect(input.workspaceId).toBe("phase117-workspace");
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
    expect(userId).toBe("phase117-user");
    expect(workspaceId).toBe("phase117-workspace");
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

const createMockFetch = (calls: DependencyCalls): typeof fetch =>
  (async (input, init) => {
    calls.mockFetch += 1;
    expect(String(input)).toBe(providerUrl);
    expect(init?.method).toBe("POST");
    expect(JSON.stringify(init?.body)).not.toContain(rawKey);
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawKey}`);
    return new Response(
      JSON.stringify({
        data: [{ b64_json: b64Json }],
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  }) as typeof fetch;

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
  mode = "openai_adapter_mock_only",
  requester = authenticatedRequester,
  role = "owner",
  vaultReadiness = "ready",
}: {
  controls?: BackendGenerationExecutionControlReadiness;
  decryptApproved?: boolean;
  fetchMode?: BackendGenerationOpenAiAdapterFetchMode;
  generationRuntimeConfig?: ReturnType<typeof parseGenerationRuntimeConfig>;
  keyRecord?: BackendProviderKeyRecord | null;
  mode?: BackendGenerationRouteExecutionMode;
  requester?: BackendRequesterContext;
  role?: "owner" | "admin" | "member" | "viewer";
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
        provider: "phase117-session",
      },
      generatedArtifactStorageReadiness: {
        getReadiness: () => {
          calls.storage += 1;
          throw new Error("Generated image storage must not run in Phase 117.");
        },
      },
      generationByokDecryptForMockExecutionEnabled: decryptApproved,
      generationExecutionControlReadiness: controls,
      generationOpenAiAdapterFetchMode: fetchMode,
      generationRouteExecutionMode: mode,
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiAdapterMockFetch:
        fetchMode === "mock_only" ? createMockFetch(calls) : undefined,
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
    "PHASE117_ENCRYPTED_PAYLOAD_NOT_RETURNED",
    providerUrl,
    b64Json,
    "submitted",
    "running",
    "generated_metadata_ready",
    "status\":\"generated\"",
    "artifactId",
    "providerKeyId",
    "workspaceId",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
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

test.describe("phase117 byok decrypt plus mocked OpenAI adapter route execution", () => {
  test("new gates parse fail-closed", () => {
    expect(parseGenerationOpenAiAdapterFetchMode({})).toBe("not_configured");
    expect(
      parseGenerationOpenAiAdapterFetchMode({
        FREE_AI_MIXER_GENERATION_OPENAI_ADAPTER_FETCH_MODE: "mock_only",
      }),
    ).toBe("mock_only");
    expect(parseGenerationByokDecryptForMockExecutionEnabled({})).toBe(false);
    expect(
      parseGenerationByokDecryptForMockExecutionEnabled({
        FREE_AI_MIXER_GENERATION_BYOK_DECRYPT_FOR_MOCK_EXECUTION: "1",
      }),
    ).toBe(true);
  });

  test("disabled preconditions-only and adapter-mock-only behavior remain unchanged", async () => {
    for (const entry of [
      { mode: "disabled" as const, status: "generation_runtime_disabled" },
      { mode: "preconditions_only" as const, status: "generation_execution_blocked" },
      { mode: "adapter_mock_only" as const, status: "generation_execution_blocked" },
    ]) {
      const { baseUrl, calls, server } = await startGenerationApp({
        mode: entry.mode,
      });

      try {
        const { body, status } = await postGenerationJob(baseUrl);
        expect(status).toBe(503);
        expect(body.status).toBe(entry.status);
        expect(body.runtime.vendorCallsEnabled).toBe(false);
        expect(body.attemptedProviderIds).toEqual([]);
        expect(calls).toMatchObject({
          decrypt: 0,
          mockFetch: 0,
          storage: 0,
        });
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("OpenAI adapter mock-only blocks unsafe states before decrypt or mock fetch", async () => {
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
      {
        expectedStatus: "provider_key_not_configured",
        keyRecord: createActiveValidatedKey({ revokedAt: "2026-06-03T00:00:00.000Z" }),
      },
      {
        expectedStatus: "provider_key_not_configured",
        keyRecord: createActiveValidatedKey({ disabledAt: "2026-06-03T00:00:00.000Z" }),
      },
      {
        expectedStatus: "provider_key_not_configured",
        keyRecord: createActiveValidatedKey({ rotatedAt: "2026-06-03T00:00:00.000Z" }),
      },
      {
        expectedStatus: "provider_key_not_configured",
        keyRecord: createActiveValidatedKey({ deletedAt: "2026-06-03T00:00:00.000Z" }),
      },
      { expectedStatus: "generation_execution_blocked", fetchMode: "not_configured" },
      { decryptApproved: false, expectedStatus: "generation_execution_blocked" },
      { expectedStatus: "generation_execution_blocked", vaultReadiness: "not_configured" },
    ];

    for (const entry of cases) {
      const { baseUrl, calls, server } = await startGenerationApp(entry);

      try {
        const { body } = await postGenerationJob(baseUrl);
        expect(body.status).toBe(entry.expectedStatus);
        expect(calls.decrypt).toBe(0);
        expect(calls.mockFetch).toBe(0);
        expect(calls.storage).toBe(0);
        expect(body.attemptedProviderIds).toEqual([]);
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("decrypt and mocked fetch happen only after all preconditions pass", async () => {
    const originalGlobalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("globalThis.fetch must not run in Phase 117 route execution.");
    }) as typeof fetch;
    const { baseUrl, calls, server } = await startGenerationApp();

    try {
      const { body, status } = await postGenerationJob(baseUrl);
      const serialized = JSON.stringify(body);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");
      expect(body.status).toBe("artifact_storage_unavailable");
      expect(body.message).toBe(
        "OpenAI image generation returned a provider result, but generated artifact storage is not configured.",
      );
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["openai"]);
      expect(calls).toMatchObject({
        decrypt: 1,
        keyLookup: 2,
        membership: 1,
        mockFetch: 1,
        storage: 0,
        vaultReadiness: 1,
      });
      expectNoLeak(serialized);
    } finally {
      globalThis.fetch = originalGlobalFetch;
      await stopServer(server);
    }
  });

  test("source boundaries keep frontend storage artifacts credits billing export and provider SDK untouched", () => {
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

    expect(routeSource).toContain("createOpenAiImageGenerationAdapter");
    expect(routeSource).toContain("fetchImpl: options.openAiAdapterMockFetch");
    expect(routeSource).not.toContain("generatedImageArtifactStorage:");
    expect(routeSource).not.toContain("globalThis.fetch");
    expect(appSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(backendDependencies).not.toContain("createOpenAiImageGenerationAdapter");
    expect(appSource).not.toContain("createLocalGeneratedImageArtifactStorage");
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
