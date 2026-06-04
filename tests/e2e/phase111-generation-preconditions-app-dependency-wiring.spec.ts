import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import {
  getGenerationExecutionControlReadiness,
  parseGenerationExecutionControlReadiness,
} from "../../backend/generation/generationRuntimeOrchestrator";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const rawKey = "FAKE_PHASE111_RAW_KEY_DO_NOT_RETURN";
const providerUrl = "https://example.invalid/phase111-provider-output.png";
const base64Image = Buffer.from("phase111-image").toString("base64");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase111-subject",
  kind: "authenticated",
  userId: "phase111-user",
  workspaceId: "phase111-workspace",
};

interface DependencyCalls {
  keyLookup: number;
  membership: number;
  vault: number;
}

const createCalls = (): DependencyCalls => ({
  keyLookup: 0,
  membership: 0,
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
  providerKeyId: "phase111-provider-key",
  providerName: "openai",
  workspaceId: "phase111-workspace",
  ownerId: "phase111-owner",
  createdByUserId: "phase111-owner",
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
  ...patch,
});

const validJobRequest = () => ({
  generationKind: "image",
  prompt: "A safe phase 111 image prompt that must not execute",
  providerId: "openai",
  requestId: "phase111_request",
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
    expect(workspaceId).toBe("phase111-workspace");
    expect(providerId).toBe("openai");

    return record;
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in generation preconditions.");
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
    throw new Error("Vault readiness must not run in generation preconditions.");
  },
  encryptProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault encrypt must not run in generation preconditions.");
  },
  decryptProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault decrypt must not run in generation preconditions.");
  },
  storeProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault store must not run in generation preconditions.");
  },
  revokeProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault revoke must not run in generation preconditions.");
  },
  rotateProviderKey: async () => {
    calls.vault += 1;
    throw new Error("Vault rotate must not run in generation preconditions.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
  role: "owner" | "admin" | "member" | "viewer" = "owner",
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase111-user");
    expect(workspaceId).toBe("phase111-workspace");

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
  controls = getGenerationExecutionControlReadiness(),
  keyRecord = createActiveValidatedKey(),
  mode = "preconditions_only",
  role = "owner",
}: {
  controls?: BackendGenerationExecutionControlReadiness;
  keyRecord?: BackendProviderKeyRecord | null;
  mode?: "disabled" | "preconditions_only";
  role?: "owner" | "admin" | "member" | "viewer";
} = {}): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
  const calls = createCalls();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: BackendRequesterContext }).backendRequesterContext =
      authenticatedRequester;
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
        provider: "phase111-session",
      },
      generationExecutionControlReadiness: controls,
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
    "encrypted_payload",
    "secret_ref",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const getGenerationRouterOptionsSource = (): string => {
  const appSource = readSource("backend/app.ts");
  const start = appSource.indexOf("createGenerationRouter({");
  const end = appSource.indexOf("app.use(\n    createProviderSettingsRouter", start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return appSource.slice(start, end);
};

test.describe("phase111 generation preconditions app dependency wiring", () => {
  test("app passes only safe precondition dependencies into generation router", () => {
    const generationRouterOptions = getGenerationRouterOptionsSource();
    const backendDependencies = readSource("backend/composition/backendDependencies.ts");
    const orchestratorSource = readSource(
      "backend/generation/generationRuntimeOrchestrator.ts",
    );

    expect(generationRouterOptions).toContain("generationRuntimeConfig");
    expect(generationRouterOptions).toContain("generationRuntimeReadiness");
    expect(generationRouterOptions).toContain("generationExecutionControlReadiness");
    expect(generationRouterOptions).toContain("routeAccessResolver");
    expect(generationRouterOptions).toContain("providerKeyRepository");
    expect(generationRouterOptions).toContain("workspaceMembershipRepository");
    expect(generationRouterOptions).not.toContain("providerSecretVault");
    expect(generationRouterOptions).not.toContain("generationProviderAdapter");
    expect(generationRouterOptions).not.toContain("generatedArtifactStorage");
    expect(generationRouterOptions).not.toContain("generatedArtifactStorageReadiness");
    expect(backendDependencies).toContain("generationExecutionControlReadiness");
    expect(orchestratorSource).toContain(
      "FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY",
    );
  });

  test("execution control readiness remains fail-closed unless explicitly test-ready", () => {
    expect(parseGenerationExecutionControlReadiness({})).toEqual(
      getGenerationExecutionControlReadiness(),
    );
    expect(
      parseGenerationExecutionControlReadiness({
        FREE_AI_MIXER_GENERATION_PREFLIGHT_CONTROLS_READY: "1",
      }),
    ).toEqual({
      kind: "generation_execution_controls_readiness",
      costControlsReady: true,
      idempotencyReady: true,
      rateLimitReady: true,
      singleFlightReady: true,
    });
  });

  test("default disabled mode calls no repository membership vault adapter or storage dependency", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({
      controls: controlsReady(),
      mode: "disabled",
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl, {
        ...validJobRequest(),
        rawApiKey: rawKey,
        deliveryOptions: { publicUrl: providerUrl },
      });

      expect(status).toBe(503);
      expect(body.status).toBe("generation_runtime_disabled");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual([]);
      expect(calls).toEqual(createCalls());
      expectNoLeak(JSON.stringify(body));
    } finally {
      await stopServer(server);
    }
  });

  test("preconditions-only reaches membership and blocks member viewer before active key lookup", async () => {
    for (const role of ["member", "viewer"] as const) {
      const { baseUrl, calls, server } = await startGenerationApp({
        controls: controlsReady(),
        role,
      });

      try {
        const { body, status } = await postGenerationJob(baseUrl);

        expect(status).toBe(403);
        expect(body.status).toBe("workspace_owner_or_admin_required");
        expect(calls).toEqual({
          keyLookup: 0,
          membership: 1,
          vault: 0,
        });
      } finally {
        await stopServer(server);
      }
    }
  });

  test("default control readiness blocks before active validated key lookup", async () => {
    const { baseUrl, calls, server } = await startGenerationApp();

    try {
      const { body, status } = await postGenerationJob(baseUrl);

      expect(status).toBe(503);
      expect(body.status).toBe("rate_limit_not_configured");
      expect(calls).toEqual({
        keyLookup: 0,
        membership: 1,
        vault: 0,
      });
    } finally {
      await stopServer(server);
    }
  });

  test("test-ready controls allow active validated key lookup and block unsafe key states", async () => {
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

    for (const keyRecord of unsafeRecords) {
      const { baseUrl, calls, server } = await startGenerationApp({
        controls: controlsReady(),
        keyRecord,
      });

      try {
        const { body, status } = await postGenerationJob(baseUrl);

        expect(status).toBe(403);
        expect(body.status).toBe("provider_key_not_configured");
        expect(calls).toEqual({
          keyLookup: 1,
          membership: 1,
          vault: 0,
        });
        expectNoLeak(JSON.stringify(body));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("active validated key returns execution blocked with no decrypt adapter storage provider or artifact state", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({
      controls: controlsReady(),
      keyRecord: createActiveValidatedKey(),
      role: "admin",
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl);
      const serialized = JSON.stringify(body);

      expect(status).toBe(503);
      expect(body.status).toBe("generation_execution_blocked");
      expect(body.runtime.vendorCallsEnabled).toBe(false);
      expect(body.attemptedProviderIds).toEqual([]);
      expect(calls).toEqual({
        keyLookup: 1,
        membership: 1,
        vault: 0,
      });
      expectNoLeak(serialized);
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries keep frontend provider execution credits billing export and artifact delivery untouched", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const appSource = readSource("backend/app.ts");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");
    const generationRouterOptions = getGenerationRouterOptionsSource();

    expect(routeSource).not.toContain(".decryptProviderKey(");
    expect(routeSource).not.toContain("generateImageFromStoredProviderKey(");
    expect(routeSource).not.toContain(".store(");
    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(generationRouterOptions).not.toContain("providerSecretVault");
    expect(generationRouterOptions).not.toContain("generationProviderAdapter");
    expect(generationRouterOptions).not.toContain("generatedArtifactStorage");
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
