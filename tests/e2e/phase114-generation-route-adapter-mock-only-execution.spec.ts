import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendGenerationMockExecutionAdapterSelection,
  BackendGenerationRouteExecutionMode,
} from "../../backend/generation/generationRuntimeConfig";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationMockExecutionAdapterSelection,
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
const rawKey = "FAKE_PHASE114_RAW_KEY_DO_NOT_RETURN";
const promptText = "A phase 114 prompt that must not be echoed or generated";
const providerUrl = "https://api.openai.com/v1/images/generations";
const base64Image = Buffer.from("phase114-image").toString("base64");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase114-subject",
  kind: "authenticated",
  userId: "phase114-user",
  workspaceId: "phase114-workspace",
};

interface DependencyCalls {
  adapterReadiness: number;
  keyLookup: number;
  membership: number;
  mockExecution: number;
  storageReadiness: number;
  vault: number;
}

const createCalls = (): DependencyCalls => ({
  adapterReadiness: 0,
  keyLookup: 0,
  membership: 0,
  mockExecution: 0,
  storageReadiness: 0,
  vault: 0,
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
  providerKeyId: "phase114-provider-key",
  providerName: "openai",
  workspaceId: "phase114-workspace",
  ownerId: "phase114-owner",
  createdByUserId: "phase114-owner",
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
  ...patch,
});

const validJobRequest = () => ({
  generationKind: "image",
  prompt: promptText,
  providerId: "openai",
  requestId: "phase114_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  record?: BackendProviderKeyRecord,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (): Promise<BackendProviderKeyRecord | undefined> => {
    throw new Error("Direct provider key lookup must not run in mock-only route mode.");
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase114-workspace");
    expect(providerId).toBe("openai");

    return record;
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in generation mock-only mode.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in generation mock-only mode.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in generation mock-only mode.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in generation mock-only mode.");
  },
});

const createTripwireVault = (calls: DependencyCalls): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vault += 1;
    throw new Error("Vault readiness must not run in generation mock-only mode.");
  },
  encryptProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault encrypt must not run in generation mock-only mode.");
  },
  decryptProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault decrypt must not run in generation mock-only mode.");
  },
  storeProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault store must not run in generation mock-only mode.");
  },
  revokeProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault revoke must not run in generation mock-only mode.");
  },
  rotateProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault rotate must not run in generation mock-only mode.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
  role: "owner" | "admin" | "member" | "viewer" = "owner",
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase114-user");
    expect(workspaceId).toBe("phase114-workspace");

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

const startGenerationApp = async ({
  controls = controlsReady(),
  generationRuntimeConfig = parseGenerationRuntimeConfig({
    FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
    FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
    FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: "1",
  }),
  keyRecord = createActiveValidatedKey(),
  mockSelection = "mock_local",
  mode = "adapter_mock_only",
  requester = authenticatedRequester,
  role = "owner",
}: {
  controls?: BackendGenerationExecutionControlReadiness;
  generationRuntimeConfig?: ReturnType<typeof parseGenerationRuntimeConfig>;
  keyRecord?: BackendProviderKeyRecord | null;
  mockSelection?: BackendGenerationMockExecutionAdapterSelection;
  mode?: BackendGenerationRouteExecutionMode;
  requester?: BackendRequesterContext;
  role?: "owner" | "admin" | "member" | "viewer";
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
        provider: "phase114-session",
      },
      generatedArtifactStorageReadiness: {
        getReadiness: () => {
          calls.storageReadiness += 1;
          throw new Error("Storage readiness must not run in generation mock-only mode.");
        },
      },
      generationExecutionControlReadiness: controls,
      generationMockExecutionAdapterSelection: mockSelection,
      generationMockExecutor: async (input) => {
        calls.mockExecution += 1;
        expect(input).toEqual({
          providerId: "openai",
          requestId: "phase114_request",
        });

        return { kind: "mock_execution_blocked" };
      },
      generationProviderAdapter: {
        providerId: "openai",
        getReadiness: () => {
          calls.adapterReadiness += 1;
          throw new Error("Real adapter readiness must not run in mock-only mode.");
        },
      },
      generationRouteExecutionMode: mode,
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      providerKeyRepository: createProviderKeyRepository(
        calls,
        keyRecord ?? undefined,
      ),
      providerSecretVault: createTripwireVault(calls),
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
  const response = await fetch(`${baseUrl}/generation/jobs`, {
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
    providerUrl,
    base64Image,
    "submitted",
    "running",
    "generated_metadata_ready",
    "fake_success",
    "fake_progress",
    "fake_artifact",
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
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase114 generation route adapter mock-only execution", () => {
  test("mock execution selector is fail-closed unless explicitly mock_local", () => {
    expect(parseGenerationMockExecutionAdapterSelection({})).toBe("not_configured");
    expect(
      parseGenerationMockExecutionAdapterSelection({
        FREE_AI_MIXER_GENERATION_MOCK_EXECUTION_ADAPTER: "mock_local",
      }),
    ).toBe("mock_local");
  });

  test("default disabled and preconditions-only behavior remain unchanged", async () => {
    for (const entry of [
      {
        expectedAttempted: [],
        expectedStatus: "generation_runtime_disabled",
        mode: "disabled" as const,
      },
      {
        expectedAttempted: [],
        expectedStatus: "generation_execution_blocked",
        mode: "preconditions_only" as const,
      },
    ]) {
      const { baseUrl, calls, server } = await startGenerationApp({
        mode: entry.mode,
      });

      try {
        const { body, status } = await postGenerationJob(baseUrl);

        expect(status).toBe(503);
        expect(body.status).toBe(entry.expectedStatus);
        expect(body.runtime.vendorCallsEnabled).toBe(false);
        expect(body.attemptedProviderIds).toEqual(entry.expectedAttempted);
        expect(calls.mockExecution).toBe(0);
        expect(calls.vault).toBe(0);
        expect(calls.adapterReadiness).toBe(0);
        expect(calls.storageReadiness).toBe(0);
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("adapter mock-only requires auth workspace owner/admin gates controls and active validated key", async () => {
    const cases: Array<{
      expectedStatus: string;
      keyRecord?: BackendProviderKeyRecord | null;
      requester?: BackendRequesterContext;
      role?: "owner" | "admin" | "member" | "viewer";
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
    ];

    for (const entry of cases) {
      const { baseUrl, calls, server } = await startGenerationApp(entry);

      try {
        const { body } = await postGenerationJob(baseUrl);

        expect(body.status).toBe(entry.expectedStatus);
        expect(calls.mockExecution).toBe(0);
        expect(calls.vault).toBe(0);
        expect(calls.adapterReadiness).toBe(0);
        expect(calls.storageReadiness).toBe(0);
        expect(body.attemptedProviderIds).toEqual([]);
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("generation gates and preflight controls must pass before mock execution", async () => {
    const generationGateOff = parseGenerationRuntimeConfig({
      FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
      FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
    });
    const cases = [
      {
        expectedStatus: "generation_runtime_disabled",
        generationRuntimeConfig: generationGateOff,
      },
      {
        controls: getGenerationExecutionControlReadiness(),
        expectedStatus: "rate_limit_not_configured",
      },
      {
        expectedStatus: "generation_execution_blocked",
        mockSelection: "not_configured" as const,
      },
    ];

    for (const entry of cases) {
      const { baseUrl, calls, server } = await startGenerationApp(entry);

      try {
        const { body } = await postGenerationJob(baseUrl);

        expect(body.status).toBe(entry.expectedStatus);
        expect(calls.mockExecution).toBe(0);
        expect(calls.vault).toBe(0);
        expect(calls.adapterReadiness).toBe(0);
        expect(calls.storageReadiness).toBe(0);
        expect(body.attemptedProviderIds).toEqual([]);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("mock executor is called only after all preconditions pass and response remains blocked", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({ role: "admin" });

    try {
      const { body, status } = await postGenerationJob(baseUrl);
      const serialized = JSON.stringify(body);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");
      expect(body.status).toBe("generation_mock_execution_blocked");
      expect(body.message).toBe(
        "Mock generation execution completed for backend plumbing only; real provider execution remains disabled.",
      );
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual(["openai"]);
      expect(calls).toMatchObject({
        adapterReadiness: 0,
        keyLookup: 1,
        membership: 1,
        mockExecution: 1,
        storageReadiness: 0,
        vault: 0,
      });
      expect(serialized).not.toContain("status\":\"generated\"");
      expectNoLeak(serialized);
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries keep real adapter frontend credits billing export and artifacts untouched", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const appSource = readSource("backend/app.ts");
    const backendDependencies = readSource("backend/composition/backendDependencies.ts");
    const openAiAdapter = readSource("backend/generation/openAiImageGenerationAdapter.ts");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");

    expect(routeSource).not.toContain(".decryptProviderKey(");
    expect(routeSource).not.toContain("generateImageFromStoredProviderKey(");
    expect(routeSource).not.toContain(".store(");
    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(appSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(backendDependencies).not.toContain("createOpenAiImageGenerationAdapter");
    expect(openAiAdapter).toContain("https://api.openai.com/v1/images/generations");
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
      "b64_json",
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
