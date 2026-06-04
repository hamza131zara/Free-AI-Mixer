import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import {
  getGenerationRuntimeCompositionReadiness,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import { generationRuntimeEnvNames } from "../../backend/generation/generationProviderAdapter";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const withGenerationEnv = async <T>(
  env: Record<string, string | undefined>,
  callback: () => Promise<T> | T,
): Promise<T> => {
  const keys = Object.values(generationRuntimeEnvNames);
  const previous = new Map(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) {
      if (env[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    }

    return await callback();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase102-subject",
  kind: "authenticated",
  userId: "phase102-user",
  workspaceId: "phase102-workspace",
};

const startGenerationApp = async (
  requesterContext: BackendRequesterContext = authenticatedRequester,
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
        provider: "phase102-session",
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

test.describe("phase102 generation runtime composition readiness", () => {
  test("default generation runtime config is disabled and fail-closed", () => {
    const config = parseGenerationRuntimeConfig({});
    const readiness = getGenerationRuntimeCompositionReadiness(config);

    expect(config).toEqual({
      kind: "generation_runtime_config",
      runtimeEnabled: false,
      providerAdapter: "not_configured",
      allowRealProviderCalls: false,
    });
    expect(readiness).toMatchObject({
      kind: "generation_runtime_composition_readiness",
      routeExecutionEnabled: false,
      vendorCallsEnabled: false,
      generatedImageDeliveryEnabled: false,
      generatedImageStorageReadiness: "not_configured",
      adapterSelectableForReadinessOnly: false,
    });
  });

  test("single generation gates do not enable provider calls", () => {
    for (const env of [
      { [generationRuntimeEnvNames.runtimeEnabled]: "1" },
      { [generationRuntimeEnvNames.providerAdapter]: "openai_image_minimal" },
      { [generationRuntimeEnvNames.allowRealProviderCalls]: "1" },
    ]) {
      const readiness = getGenerationRuntimeCompositionReadiness(
        parseGenerationRuntimeConfig(env),
      );

      expect(readiness.routeExecutionEnabled).toBe(false);
      expect(readiness.vendorCallsEnabled).toBe(false);
      expect(readiness.adapterSelectableForReadinessOnly).toBe(false);
      expect(readiness.generatedImageDeliveryEnabled).toBe(false);
    }
  });

  test("all generation gates are metadata-only and still do not activate routes", () => {
    const env = {
      [generationRuntimeEnvNames.runtimeEnabled]: "1",
      [generationRuntimeEnvNames.providerAdapter]: "openai_image_minimal",
      [generationRuntimeEnvNames.allowRealProviderCalls]: "1",
    };
    const readiness = getGenerationRuntimeCompositionReadiness(
      parseGenerationRuntimeConfig(env),
    );

    expect(readiness.adapterSelectableForReadinessOnly).toBe(true);
    expect(readiness.routeExecutionEnabled).toBe(false);
    expect(readiness.vendorCallsEnabled).toBe(false);
    expect(readiness.generatedImageDeliveryEnabled).toBe(false);
    expect(readiness.message).toContain("readiness metadata only");
  });

  test("backend dependencies expose fail-closed generation readiness without route execution", async () => {
    const dependencies = await withGenerationEnv(
      {
        [generationRuntimeEnvNames.runtimeEnabled]: "1",
        [generationRuntimeEnvNames.providerAdapter]: "openai_image_minimal",
        [generationRuntimeEnvNames.allowRealProviderCalls]: "1",
      },
      () => createBackendDependencies(),
    );

    expect(dependencies.generationRuntimeConfig).toMatchObject({
      runtimeEnabled: true,
      providerAdapter: "openai_image_minimal",
      allowRealProviderCalls: true,
    });
    expect(dependencies.generationRuntimeReadiness).toMatchObject({
      adapterSelectableForReadinessOnly: true,
      routeExecutionEnabled: false,
      vendorCallsEnabled: false,
      generatedImageStorageReadiness: "not_configured",
      generatedImageDeliveryEnabled: false,
    });
  });

  test("generation jobs route remains disabled even when all gates are present", async () => {
    await withGenerationEnv(
      {
        [generationRuntimeEnvNames.runtimeEnabled]: "1",
        [generationRuntimeEnvNames.providerAdapter]: "openai_image_minimal",
        [generationRuntimeEnvNames.allowRealProviderCalls]: "1",
      },
      async () => {
        const { baseUrl, server } = await startGenerationApp();

        try {
          const runtimeResponse = await fetch(`${baseUrl}/generation/runtime-status`);
          const runtimeBody = await runtimeResponse.json();
          const jobResponse = await fetch(`${baseUrl}/generation/jobs`, {
            body: JSON.stringify({
              providerId: "openai",
              prompt: "A safe readiness-only prompt",
              rawApiKey: "FAKE_PHASE102_RAW_KEY_DO_NOT_RETURN",
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
          const jobBody = await jobResponse.json();
          const serialized = JSON.stringify({ runtimeBody, jobBody });

          expect(runtimeResponse.status).toBe(200);
          expect(runtimeBody.runtime.executionState).toBe("disabled_by_default");
          expect(runtimeBody.runtime.vendorCallsEnabled).toBe(false);
          expect(jobResponse.status).toBe(503);
          expect(jobBody.status).toBe("generation_runtime_disabled");
          expect(jobBody.attemptedProviderIds).toEqual([]);
          expect(jobBody.runtime.vendorCallsEnabled).toBe(false);
          expect(serialized).not.toContain("FAKE_PHASE102_RAW_KEY_DO_NOT_RETURN");
          expect(serialized).not.toContain("submitted");
          expect(serialized).not.toContain("generated");
        } finally {
          await stopServer(server);
        }
      },
    );
  });

  test("route source cannot call OpenAI adapter or generated image storage", () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const appSource = readSource("backend/app.ts");

    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");
    expect(routeSource).not.toContain("GeneratedImageArtifactStorage");
    expect(routeSource).not.toContain("generatedImageArtifactStorage");
    expect(routeSource).not.toContain("generateImageFromStoredProviderKey");
    expect(routeSource).not.toContain("createLocalGeneratedImageArtifactStorage");
    expect(appSource).toContain("createGenerationRouter({ runtimeConfig");
    expect(appSource).not.toContain("generationRuntimeReadiness");
  });

  test("source boundaries avoid frontend changes SDKs fake artifacts and unrelated runtime expansion", () => {
    const backendDependencies = readSource("backend/composition/backendDependencies.ts");
    const runtimeConfig = readSource("backend/generation/generationRuntimeConfig.ts");
    const openAiAdapter = readSource("backend/generation/openAiImageGenerationAdapter.ts");
    const packageJson = readSource("package.json");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const frontendSource = [sceneService, sceneStore, sceneAgent].join("\n");
    const creditsBillingSource = [creditsPage, billingService].join("\n");

    expect(runtimeConfig).toContain("routeExecutionEnabled: false");
    expect(runtimeConfig).toContain("vendorCallsEnabled: false");
    expect(runtimeConfig).toContain("generatedImageDeliveryEnabled: false");
    expect(backendDependencies).not.toContain("createOpenAiImageGenerationAdapter");
    expect(backendDependencies).not.toContain("createLocalGeneratedImageArtifactStorage");
    expect(sceneService).not.toContain("/generation/jobs");

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
      expect(creditsBillingSource).not.toContain(forbidden);
      expect(runtimeConfig).not.toContain(forbidden);
    }

    expect(exportRoute).toContain("route_execution_disabled");
    expect(runtimeConfig).not.toContain("publicUrl");
    expect(runtimeConfig).not.toContain("signedUrl");
    expect(runtimeConfig).not.toContain("downloadUrl");
    expect(runtimeConfig).not.toContain("internalRef");
    expect(runtimeConfig).not.toContain("filePath");
    expect(runtimeConfig).not.toContain("rootPath");
    expect(openAiAdapter).toContain("fetchImpl");
    expect(openAiAdapter).toContain("/v1/images/generations");
  });
});
