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
import { getGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const rawKey = "FAKE_PHASE106_RAW_KEY_DO_NOT_RETURN";
const providerUrl = "https://example.invalid/phase106-provider-output.png";
const base64Image = Buffer.from("phase106-image").toString("base64");

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase106-subject",
  kind: "authenticated",
  userId: "phase106-user",
  workspaceId: "phase106-workspace",
};

interface DependencyCalls {
  adapterExecution: number;
  adapterReadiness: number;
  membership: number;
  repository: number;
  storageReadiness: number;
  vault: number;
}

const createCalls = (): DependencyCalls => ({
  adapterExecution: 0,
  adapterReadiness: 0,
  membership: 0,
  repository: 0,
  storageReadiness: 0,
  vault: 0,
});

const createTripwireDependencies = (calls: DependencyCalls) => {
  const providerKeyRepository: BackendProviderKeyRepository = {
    getByProviderKeyId: async (): Promise<BackendProviderKeyRecord | undefined> => {
      calls.repository += 1;
      throw new Error("Provider key repository must not be called while generation route is disabled.");
    },
    getActiveValidatedProviderKeyForWorkspaceProvider: async (): Promise<BackendProviderKeyRecord | undefined> => {
      calls.repository += 1;
      throw new Error("Active validated key lookup must not be called while generation route is disabled.");
    },
    listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
      calls.repository += 1;
      throw new Error("Provider key list must not be called while generation route is disabled.");
    },
    createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
      calls.repository += 1;
      throw new Error("Provider key create must not be called while generation route is disabled.");
    },
    replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
      calls.repository += 1;
      throw new Error("Provider key replace must not be called while generation route is disabled.");
    },
    revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
      calls.repository += 1;
      throw new Error("Provider key revoke must not be called while generation route is disabled.");
    },
  };

  const providerSecretVault: ProviderSecretVault = {
    getVaultReadiness: () => {
      calls.vault += 1;
      throw new Error("Vault readiness must not be called while generation route is disabled.");
    },
    encryptProviderKey: async () => {
      calls.vault += 1;
      throw new Error("Vault encrypt must not be called while generation route is disabled.");
    },
    decryptProviderKey: async () => {
      calls.vault += 1;
      throw new Error("Vault decrypt must not be called while generation route is disabled.");
    },
    storeProviderKey: async () => {
      calls.vault += 1;
      throw new Error("Vault store must not be called while generation route is disabled.");
    },
    revokeProviderKey: async () => {
      calls.vault += 1;
      throw new Error("Vault revoke must not be called while generation route is disabled.");
    },
    rotateProviderKey: async () => {
      calls.vault += 1;
      throw new Error("Vault rotate must not be called while generation route is disabled.");
    },
  };

  const workspaceMembershipRepository: WorkspaceMembershipRepository = {
    getMembership: async () => {
      calls.membership += 1;
      throw new Error("Workspace membership must not be called while generation route is disabled.");
    },
  };

  const generationProviderAdapter: Pick<
    BackendGenerationProviderAdapter,
    "getReadiness" | "providerId"
  > = {
    providerId: "openai",
    getReadiness: () => {
      calls.adapterReadiness += 1;
      throw new Error("Adapter readiness must not be called while generation route is disabled.");
    },
  };

  const generatedArtifactStorageReadiness = {
    getReadiness: (): "ready" => {
      calls.storageReadiness += 1;
      throw new Error("Generated image storage readiness must not be called while generation route is disabled.");
    },
  };

  return {
    generatedArtifactStorageReadiness,
    generationProviderAdapter,
    providerKeyRepository,
    providerSecretVault,
    workspaceMembershipRepository,
  };
};

const startGenerationApp = async (options?: {
  calls?: DependencyCalls;
  injectAllDependencies?: boolean;
}): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
  const calls = options?.calls ?? createCalls();
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
  const dependencies = createTripwireDependencies(calls);

  app.use(
    createGenerationRouter({
      runtimeConfig: {
        kind: "auth_provider_configured",
        provider: "phase106-session",
      },
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      generationExecutionControlReadiness:
        getGenerationExecutionControlReadiness(),
      ...(options?.injectAllDependencies ? dependencies : {}),
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

const postGenerationJob = async (baseUrl: string) => {
  const response = await fetch(`${baseUrl}/generation/jobs`, {
    body: JSON.stringify({
      providerId: "openai",
      generationKind: "image",
      prompt: "A safe prompt that should never reach an adapter",
      requestId: "phase106_request",
      rawApiKey: rawKey,
      deliveryOptions: {
        publicUrl: providerUrl,
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  return {
    body: await response.json(),
    status: response.status,
  };
};

const expectDisabledResponse = (body: any, status: number): void => {
  const serialized = JSON.stringify(body);

  expect(status).toBe(503);
  expect(body.kind).toBe("generation_job_rejected");
  expect(body.status).toBe("generation_runtime_disabled");
  expect(body.attemptedProviderIds).toEqual([]);
  expect(body.runtime.vendorCallsEnabled).toBe(false);
  expect(serialized).not.toContain(rawKey);
  expect(serialized).not.toContain(providerUrl);
  expect(serialized).not.toContain(base64Image);
  expect(serialized).not.toMatch(
    /submitted|running|generated|fake_success|fake_progress|fake_artifact|publicUrl|signedUrl|downloadUrl|internalRef|filePath|rootPath|bytes|b64_json/i,
  );
};

test.describe("phase106 generation route fail-closed dependency injection", () => {
  test("missing optional dependencies keep generation jobs disabled", async () => {
    const { baseUrl, calls, server } = await startGenerationApp();

    try {
      const { body, status } = await postGenerationJob(baseUrl);

      expectDisabledResponse(body, status);
      expect(calls).toEqual(createCalls());
    } finally {
      await stopServer(server);
    }
  });

  test("all optional dependencies can be injected but are not called", async () => {
    const { baseUrl, calls, server } = await startGenerationApp({
      injectAllDependencies: true,
    });

    try {
      const { body, status } = await postGenerationJob(baseUrl);

      expectDisabledResponse(body, status);
      expect(calls).toEqual(createCalls());
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries keep route disabled before adapter repository vault membership or storage calls", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const appSource = readSource("backend/app.ts");
    const backendDependencies = readSource("backend/composition/backendDependencies.ts");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const packageJson = readSource("package.json");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const unrelatedSource = [creditsPage, billingService, exportRoute].join("\n");

    expect(routeSource).toContain("generationProviderAdapter");
    expect(routeSource).toContain("generatedArtifactStorageReadiness");
    expect(routeSource).toContain("providerKeyRepository");
    expect(routeSource).toContain("providerSecretVault");
    expect(routeSource).toContain("workspaceMembershipRepository");
    expect(routeSource).not.toContain("generateImageFromStoredProviderKey(");
    expect(routeSource).not.toContain(".store(");
    expect(routeSource).not.toContain(".decryptProviderKey(");
    expect(routeSource).not.toContain(".getActiveValidatedProviderKeyForWorkspaceProvider(");
    expect(routeSource).not.toContain(".getMembership(");
    expect(appSource).toContain("createGenerationRouter({ runtimeConfig");
    expect(appSource).not.toContain("generationRuntimeReadiness");
    expect(backendDependencies).toContain("generationRuntimeConfig");
    expect(backendDependencies).toContain("generationRuntimeReadiness");
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
    ]) {
      expect(packageJson).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      expect(unrelatedSource).not.toContain(forbidden);
    }
  });
});
