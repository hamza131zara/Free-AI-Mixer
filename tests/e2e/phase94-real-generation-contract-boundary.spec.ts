import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import type { BackendGenerationProviderExecutionResult } from "../../backend/generation/generationProviderAdapter";
import {
  generationRuntimeEnvNames,
  isBackendGenerationSafeErrorCode,
} from "../../backend/generation/generationProviderAdapter";
import { getGenerationFailureMapping } from "../../backend/generation/generationFailureMapping";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();

const forbiddenSecretMarkers = [
  "FAKE_PHASE94_RAW_KEY_DO_NOT_RETURN",
  "FAKE_PHASE94_PROVIDER_BODY_DO_NOT_RETURN",
  "FAKE_PHASE94_ENCRYPTED_PAYLOAD_DO_NOT_RETURN",
  "FAKE_PHASE94_SECRET_REF_DO_NOT_RETURN",
  "phase94.header.payload",
  "supabase_service_role_PHASE94_DO_NOT_RETURN",
  Buffer.alloc(32).toString("base64"),
  "provider_account_phase94_do_not_return",
  "request_id_phase94_do_not_return",
  "localPath",
  "filePath",
  "signedUrl",
  "publicUrl",
  "downloadUrl",
] as const;

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

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

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase94-subject",
  kind: "authenticated",
  userId: "phase94-user",
  workspaceId: "phase94-workspace",
};

const expectNoSecretLeak = (serialized: string): void => {
  for (const marker of forbiddenSecretMarkers) {
    expect(serialized).not.toContain(marker);
  }
};

test.describe("phase94 real provider generation contract boundary", () => {
  test("generation provider adapter contract models stored-key image generation without raw key input", () => {
    const source = readSource("backend/generation/generationProviderAdapter.ts");

    expect(source).toContain("getReadiness");
    expect(source).toContain("generateImageFromStoredProviderKey");
    expect(source).toContain("BackendGenerateImageFromStoredProviderKeyInput");
    expect(source).toContain("providerKeyId");
    expect(source).toContain("workspaceId");
    expect(source).toContain("generationKind: \"image\"");
    expect(source).toContain("prompt: string");
    expect(source).toContain("generationRuntimeEnvNames");
    expect(generationRuntimeEnvNames).toEqual({
      allowRealProviderCalls: "FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS",
      providerAdapter: "FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER",
      runtimeEnabled: "FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED",
    });

    for (const forbidden of [
      "apiKey",
      "rawApiKey",
      "plaintextKey",
      "decryptedKey",
      "providerSecret",
    ]) {
      expect(source).not.toContain(`${forbidden}: string`);
    }
  });

  test("result union and safe failure mapping include generation blockers without raw provider detail", () => {
    const source = readSource("backend/generation/generationProviderAdapter.ts");

    for (const kind of [
      "generation_unavailable",
      "generated",
      "generation_failed",
      "provider_unavailable",
      "rate_limited",
      "timeout",
      "invalid_provider",
      "key_not_found",
      "vault_decrypt_failed",
      "invalid_prompt",
      "artifact_storage_unavailable",
    ]) {
      expect(source).toContain(`kind: "${kind}"`);
    }

    for (const code of [
      "artifact_storage_unavailable",
      "generation_failed",
      "invalid_prompt",
      "provider_unavailable",
      "rate_limited",
      "timeout",
      "vault_decrypt_failed",
    ]) {
      const mapping = getGenerationFailureMapping(code);
      expect(mapping.message).not.toMatch(
        /provider body|request id|headers|account|organization|model list|raw/i,
      );
      expect(isBackendGenerationSafeErrorCode(code)).toBe(true);
    }
  });

  test("safe artifact metadata contract cannot carry urls local paths raw response or secret material", () => {
    const source = readSource("backend/generation/generationProviderAdapter.ts");
    const generated: BackendGenerationProviderExecutionResult = {
      kind: "generated",
      status: "generated",
      message: "Generated artifact metadata is available.",
      artifact: {
        artifactId: "phase94-artifact",
        contentType: "image/png",
        createdAt: "2026-06-03T00:00:00.000Z",
        generationKind: "image",
        providerId: "openai",
        status: "metadata_only",
        storageState: "metadata_only",
      },
    };

    expect(source).toContain("BackendGenerationSafeArtifactMetadata");
    expect(source).toContain("storageState");
    expect(source).toContain("metadata_only");

    for (const forbidden of [
      "providerResponseBody",
      "providerRawResponse",
      "providerAccountMetadata",
      "remoteRequestId",
      "localPath",
      "filePath",
      "signedUrl",
      "publicUrl",
      "downloadUrl",
      "encryptedPayload",
      "secretRef",
    ]) {
      expect(source).not.toContain(`${forbidden}:`);
    }

    expectNoSecretLeak(JSON.stringify(generated));
  });

  test("generation routes remain disabled and do not call provider adapters", async () => {
    const routeSource = readSource("backend/routes/generation.ts");
    const { baseUrl, server } = await startGenerationApp(authenticatedRequester);

    try {
      const statusResponse = await fetch(`${baseUrl}/generation/runtime-status`);
      const statusBody = await statusResponse.json();
      const jobResponse = await fetch(`${baseUrl}/generation/jobs`, {
        body: JSON.stringify({
          apiKey: "FAKE_PHASE94_RAW_KEY_DO_NOT_RETURN",
          prompt: "A safe test prompt that must not execute.",
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const jobBody = await jobResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusBody.runtime.vendorCallsEnabled).toBe(false);
      expect(statusBody.runtime.executionState).toBe("disabled_by_default");
      expect(
        statusBody.runtime.supportedProviders.every(
          (provider: { executionState: string }) =>
            provider.executionState === "runtime_disabled",
        ),
      ).toBe(true);
      expect(jobResponse.status).toBe(503);
      expect(jobBody.status).toBe("generation_runtime_disabled");
      expect(jobBody.attemptedProviderIds).toEqual([]);
      expect(jobBody.runtime.vendorCallsEnabled).toBe(false);
      expect(routeSource).not.toContain("generateImageFromStoredProviderKey");
      expect(routeSource).not.toContain("BackendGenerationProviderAdapter");
      expectNoSecretLeak(JSON.stringify(statusBody));
      expectNoSecretLeak(JSON.stringify(jobBody));
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries avoid provider calls frontend changes fake artifacts and unrelated runtime expansion", () => {
    const generationAdapterSource = readSource(
      "backend/generation/generationProviderAdapter.ts",
    );
    const generationRouteSource = readSource("backend/routes/generation.ts");
    const generationFolderSource = [
      generationAdapterSource,
      readSource("backend/generation/generationAttemptMetadata.ts"),
      readSource("backend/generation/generationFailureMapping.ts"),
      readSource("backend/generation/generationProviderTypes.ts"),
      readSource("backend/generation/generationRouting.ts"),
      generationRouteSource,
    ].join("\n");
    const packageJson = readSource("package.json");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");

    expect(generationRouteSource).toContain("generation_runtime_disabled");
    expect(generationRouteSource).toContain("vendorCallsEnabled: false");

    for (const forbidden of [
      "api.openai.com",
      "replicate.com",
      "generativelanguage.googleapis.com",
      "runwayml",
      "lumalabs.ai",
      "api.stability.ai",
      "@openai/",
      "@replicate/",
      "@runway",
      "@luma",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fetch(\"https://",
      "fetch(`https://",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "test_passed",
      "generation_enabled",
    ]) {
      expect(generationFolderSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
      expect(providerSettingsPage).not.toContain(forbidden);
    }

    expect(sceneService).not.toContain("/generation/jobs");
    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(exportRoute).toContain("route_execution_disabled");
  });
});

