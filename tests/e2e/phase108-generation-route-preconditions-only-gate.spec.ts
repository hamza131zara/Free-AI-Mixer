import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendGenerationProviderAdapter,
} from "../../backend/generation/generationProviderAdapter";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const rawKey = "FAKE_PHASE108_RAW_KEY_DO_NOT_RETURN";
const providerUrl = "https://example.invalid/phase108-provider-output.png";
const base64Image = Buffer.from("phase108-image").toString("base64");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase108-subject",
  kind: "authenticated",
  userId: "phase108-user",
  workspaceId: "phase108-workspace",
};

const unauthenticatedRequester: BackendRequesterContext = {
  kind: "unauthenticated",
  reason: "missing_credentials",
};

interface DependencyCalls {
  adapterReadiness: number;
  keyLookup: number;
  membership: number;
  storageReadiness: number;
  vault: number;
}

const createCalls = (): DependencyCalls => ({
  adapterReadiness: 0,
  keyLookup: 0,
  membership: 0,
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
  providerKeyId: "phase108-provider-key",
  providerName: "openai",
  workspaceId: "phase108-workspace",
  ownerId: "phase108-owner",
  createdByUserId: "phase108-owner",
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
  ...patch,
});

const validJobRequest = () => ({
  generationKind: "image",
  prompt: "A safe image prompt that must not reach a provider",
  providerId: "openai",
  requestId: "phase108_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  record?: BackendProviderKeyRecord,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (): Promise<BackendProviderKeyRecord | undefined> => {
    throw new Error("Direct provider key lookup must not run in preconditions-only mode.");
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ): Promise<BackendProviderKeyRecord | undefined> => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase108-workspace");
    expect(providerId).toBe("openai");

    return record;
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in preconditions-only mode.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in generation preconditions.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in generation preconditions.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in generation preconditions.");
  },
});

const createTripwireVault = (calls: DependencyCalls): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vault += 1;
    throw new Error("Vault readiness must not run in preconditions-only mode.");
  },
  encryptProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault encrypt must not run in preconditions-only mode.");
  },
  decryptProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault decrypt must not run in preconditions-only mode.");
  },
  storeProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault store must not run in preconditions-only mode.");
  },
  revokeProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault revoke must not run in preconditions-only mode.");
  },
  rotateProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault rotate must not run in preconditions-only mode.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
  role: "owner" | "admin" | "member" | "viewer" = "owner",
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase108-user");
    expect(workspaceId).toBe("phase108-workspace");

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

const createTripwireAdapter = (
  calls: DependencyCalls,
): Pick<BackendGenerationProviderAdapter, "getReadiness" | "providerId"> => ({
  providerId: "openai",
  getReadiness: () => {
    calls.adapterReadiness += 1;
    throw new Error("Adapter readiness must not run in preconditions-only mode.");
  },
});

const createTripwireStorageReadiness = (calls: DependencyCalls) => ({
  getReadiness: (): "ready" => {
    calls.storageReadiness += 1;
    throw new Error("Storage readiness must not run in preconditions-only mode.");
  },
});

const startGenerationApp = async ({
  controls = controlsReady(),
  keyRecord = createActiveValidatedKey(),
  mode = "preconditions_only",
  requester = authenticatedRequester,
  role = "owner",
}: {
  controls?: BackendGenerationExecutionControlReadiness;
  keyRecord?: BackendProviderKeyRecord;
  mode?: "disabled" | "preconditions_only";
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

  const generationRuntimeConfig = parseGenerationRuntimeConfig({
    FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED: "1",
    FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER: "openai_image_minimal",
    FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS: "1",
  });

  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "phase108-session",
      },
      generatedArtifactStorageReadiness: createTripwireStorageReadiness(calls),
      generationExecutionControlReadiness: controls,
      generationProviderAdapter: createTripwireAdapter(calls),
      generationRouteExecutionMode: mode,
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      providerKeyRepository: createProviderKeyRepository(calls, keyRecord),
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

const postGenerationJob = async (baseUrl: string, body: unknown = validJobRequest()) => {
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
    providerUrl,
    base64Image,
    "submitted",
    "running",
    "generated",
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
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase108 generation route preconditions-only gate", () => {
  test("default disabled route remains hard-stopped and calls no dependencies", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({
      mode: "disabled",
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl, {
        ...validJobRequest(),
        rawApiKey: rawKey,
        deliveryOptions: { publicUrl: providerUrl },
      });
      const serialized = JSON.stringify(body);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");
      expect(body.status).toBe("generation_runtime_disabled");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual([]);
      expect(calls).toEqual(createCalls());
      expectNoLeak(serialized);
    } finally {
      await stopServer(server);
    }
  });

  test("preconditions-only rejects raw key frontend workspace provider key and unsafe generation fields before dependency calls", async () => {
    const unsafeBodies = [
      { ...validJobRequest(), apiKey: rawKey },
      { ...validJobRequest(), rawApiKey: rawKey },
      { ...validJobRequest(), workspaceId: "frontend-workspace" },
      { ...validJobRequest(), providerKeyId: "frontend-provider-key" },
      { ...validJobRequest(), model: "unapproved-model" },
      { ...validJobRequest(), n: 2 },
      { ...validJobRequest(), count: 2 },
      { ...validJobRequest(), uploads: ["file"] },
      { ...validJobRequest(), files: ["file"] },
      { ...validJobRequest(), mask: "mask" },
      { ...validJobRequest(), edit: true },
      { ...validJobRequest(), stream: true },
      { ...validJobRequest(), deliveryOptions: { publicUrl: providerUrl } },
    ];

    for (const body of unsafeBodies) {
      const { baseUrl, calls, server } = await startGenerationApp();

      try {
        const result = await postGenerationJob(baseUrl, body);
        const serialized = JSON.stringify(result.body);

        expect(result.status).toBe(400);
        expect(result.body.status).toBe("unsupported_generation_request");
        expect(calls).toEqual(createCalls());
        expectNoLeak(serialized);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("missing auth and missing workspace fail before membership repository vault adapter or storage", async () => {
    const cases: Array<{
      expectedStatus: string;
      requester: BackendRequesterContext;
    }> = [
      {
        expectedStatus: "unauthenticated",
        requester: unauthenticatedRequester,
      },
      {
        expectedStatus: "workspace_permission_not_verified",
        requester: {
          ...authenticatedRequester,
          workspaceId: undefined,
        },
      },
    ];

    for (const entry of cases) {
      const { baseUrl, calls, server } = await startGenerationApp({
        requester: entry.requester,
      });

      try {
        const { body } = await postGenerationJob(baseUrl);

        expect(body.status).toBe(entry.expectedStatus);
        expect(calls).toEqual(createCalls());
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("member and viewer roles are blocked before key lookup vault adapter or storage", async () => {
    for (const role of ["member", "viewer"] as const) {
      const { baseUrl, calls, server } = await startGenerationApp({ role });

      try {
        const { body, status } = await postGenerationJob(baseUrl);

        expect(status).toBe(403);
        expect(body.status).toBe("workspace_owner_or_admin_required");
        expect(calls).toMatchObject({
          adapterReadiness: 0,
          keyLookup: 0,
          membership: 1,
          storageReadiness: 0,
          vault: 0,
        });
      } finally {
        await stopServer(server);
      }
    }
  });

  test("execution controls fail closed before active key lookup unless explicitly ready", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({
      controls: {
        kind: "generation_execution_controls_readiness",
        costControlsReady: false,
        idempotencyReady: false,
        rateLimitReady: false,
        singleFlightReady: false,
      },
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl);

      expect(status).toBe(503);
      expect(body.status).toBe("rate_limit_not_configured");
      expect(calls).toMatchObject({
        adapterReadiness: 0,
        keyLookup: 0,
        membership: 1,
        storageReadiness: 0,
        vault: 0,
      });
    } finally {
      await stopServer(server);
    }
  });

  test("active validated key lookup is server-side only and blocks unsafe key states", async () => {
    const unsafeRecords = [
      createActiveValidatedKey({ verificationStatus: "not_validated" }),
      createActiveValidatedKey({ needsReverification: true }),
      createActiveValidatedKey({ revokedAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ disabledAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ rotatedAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ deletedAt: "2026-06-03T00:00:00.000Z" }),
      createActiveValidatedKey({ status: "disabled" }),
      createActiveValidatedKey({ status: "rotated" }),
    ];

    for (const keyRecord of unsafeRecords) {
      const { baseUrl, calls, server } = await startGenerationApp({ keyRecord });

      try {
        const { body, status } = await postGenerationJob(baseUrl);

        expect(status).toBe(403);
        expect(body.status).toBe("provider_key_not_configured");
        expect(calls).toMatchObject({
          adapterReadiness: 0,
          keyLookup: 1,
          membership: 1,
          storageReadiness: 0,
          vault: 0,
        });
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("preconditions-passed response remains execution-blocked with no provider or artifact state", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({
      keyRecord: createActiveValidatedKey(),
      role: "admin",
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl);
      const serialized = JSON.stringify(body);

      expect(status).toBe(503);
      expect(body.kind).toBe("generation_job_rejected");
      expect(body.status).toBe("generation_execution_blocked");
      expect(body.message).toBe(
        "Generation preconditions passed, but provider execution remains disabled.",
      );
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual([]);
      expect(calls).toMatchObject({
        adapterReadiness: 0,
        keyLookup: 1,
        membership: 1,
        storageReadiness: 0,
        vault: 0,
      });
      expectNoLeak(serialized);
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries keep frontend provider execution credits billing export and artifact delivery untouched", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const configSource = readSource("backend/generation/generationRuntimeConfig.ts");
    const orchestratorSource = readSource(
      "backend/generation/generationRuntimeOrchestrator.ts",
    );
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");

    expect(configSource).toContain(
      "FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE",
    );
    expect(configSource).toContain("preconditions_only");
    expect(routeSource).not.toContain(".decryptProviderKey(");
    expect(routeSource).not.toContain("generateImageFromStoredProviderKey(");
    expect(routeSource).not.toContain(".store(");
    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(routeSource).not.toContain("GeneratedImageArtifactStorage");
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
      expect(orchestratorSource).not.toContain(forbidden);
    }
  });
});
