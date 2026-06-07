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
  parseGenerationOpenAiImageModelConfig,
  parseGenerationRuntimeConfig,
} from "../../backend/generation/generationRuntimeConfig";
import type { BackendGenerationExecutionControlReadiness } from "../../backend/generation/generationRuntimeOrchestrator";
import {
  createLocalGeneratedImageArtifactStorage,
  type GeneratedImageArtifactStorage,
} from "../../backend/generation/generatedImageArtifactStorage";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const originalFetch = globalThis.fetch;
const rawProviderKey = "FAKE_PHASE154_OPENAI_KEY_DO_NOT_RETURN";
const encryptedPayload = "PHASE154_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "PHASE154_SECRET_REF_DO_NOT_RETURN";
const promptText = "A phase 154 prompt that must stay out of responses";
const providerEndpoint = "https://api.openai.com/v1/images/generations";
const providerRequestId = "req_phase154_do_not_return";
const rawProviderBody = "PHASE154_PROVIDER_BODY_DO_NOT_RETURN";
const providerImageUrl = "https://example.invalid/phase154-provider-image.png";
const validPngBase64 = "iVBORw0KGgo=";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase154-subject",
  kind: "authenticated",
  userId: "phase154-user",
  workspaceId: "phase154-workspace",
};

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  providerFetch: number;
}

const createCalls = (): DependencyCalls => ({
  decrypt: 0,
  keyLookup: 0,
  membership: 0,
  providerFetch: 0,
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

const createActiveValidatedKey = (): BackendProviderKeyRecord => ({
  providerKeyId: "phase154-provider-key",
  providerName: "openai",
  workspaceId: "phase154-workspace",
  ownerId: "phase154-owner",
  createdByUserId: "phase154-owner",
  encryptedSecret: {
    algorithm: "AES-256-GCM",
    encryptedPayload,
    keyVersion: "v1",
  },
  secretRef,
  status: "active",
  verificationStatus: "validated",
  needsReverification: false,
});

const createProviderKeyRepository = (
  calls = createCalls(),
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async () => {
    calls.keyLookup += 1;
    return createActiveValidatedKey();
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ) => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase154-workspace");
    expect(providerId).toBe("openai");
    return createActiveValidatedKey();
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in Phase 154.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in Phase 154.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in Phase 154.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in Phase 154.");
  },
});

const createReadyVault = (calls = createCalls()): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in Phase 154.");
  },
  decryptProviderKey: async () => {
    calls.decrypt += 1;
    return {
      kind: "vault_provider_key_decrypted",
      plaintextKey: rawProviderKey,
      status: "decrypted",
    };
  },
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in Phase 154.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in Phase 154.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in Phase 154.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase154-user");
    expect(workspaceId).toBe("phase154-workspace");
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

const createFetchForPayload = ({
  calls,
  body = { data: [{ b64_json: validPngBase64 }] },
  onRequest,
}: {
  calls?: DependencyCalls;
  body?: unknown;
  onRequest?: (body: Record<string, unknown>) => void;
} = {}): typeof fetch =>
  (async (input, init) => {
    calls && (calls.providerFetch += 1);
    expect(String(input)).toBe(providerEndpoint);
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawProviderKey}`);

    const requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(JSON.stringify(requestBody)).toContain(promptText);
    expect(JSON.stringify(requestBody)).not.toContain(rawProviderKey);
    onRequest?.(requestBody);

    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": providerRequestId,
      },
      status: 200,
    });
  }) as typeof fetch;

const generate = async ({
  fetchImpl,
  generatedImageArtifactStorage,
  model,
}: {
  fetchImpl: typeof fetch;
  generatedImageArtifactStorage?: GeneratedImageArtifactStorage;
  model: "gpt-image-2" | "dall-e-3";
}) =>
  createOpenAiImageGenerationAdapter({
    fetchImpl,
    generatedImageArtifactStorage,
    model,
    providerKeyRepository: createProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    requestShape: "minimal",
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: promptText,
    providerId: "openai",
    providerKeyId: "phase154-provider-key",
    requestId: "phase154_request",
    workspaceId: "phase154-workspace",
  });

const makeStorageRoot = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "phase154-generated-images-"));

const removeStorageRoot = async (rootPath: string): Promise<void> => {
  await fs.rm(rootPath, { force: true, recursive: true });
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

const startGenerationApp = async (): Promise<{
  baseUrl: string;
  calls: DependencyCalls;
  server: Server;
}> => {
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
        provider: "phase154-session",
      },
      generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
        rootPath: path.join(os.tmpdir(), "phase154-unused-storage"),
      }),
      generationExecutionControlReadiness: controlsReady(),
      generationOpenAiImageModelConfig: parseGenerationOpenAiImageModelConfig({
        FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_MODEL: "not-a-real-model",
      }),
      generationOpenAiImageRealLocalSmokeEnabled: true,
      generationRouteExecutionMode: "real_provider_local_only",
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createFetchForPayload({ calls }),
      providerKeyRepository: createProviderKeyRepository(calls),
      providerSecretVault: createReadyVault(calls),
      workspaceMembershipRepository: createMembershipRepository(calls),
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, calls, server };
};

const postGenerationJob = async (baseUrl: string) => {
  const response = await originalFetch(`${baseUrl}/generation/jobs`, {
    body: JSON.stringify({
      generationKind: "image",
      prompt: promptText,
      providerId: "openai",
      requestId: "phase154_request",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const text = await response.text();

  return {
    body: JSON.parse(text) as Record<string, unknown>,
    status: response.status,
    text,
  };
};

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    promptText,
    providerEndpoint,
    rawProviderBody,
    providerRequestId,
    validPngBase64,
    providerImageUrl,
    "Authorization",
    "Bearer ",
    "workspaceId",
    "ownerId",
    "providerKeyId",
    "encrypted_payload",
    "secret_ref",
    "service_role",
    "JWT",
    "request_id",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "\"b64_json\":",
    "\"base64\":",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase154 OpenAI image model strategy DALL-E-3 fallback", () => {
  test("GPT image strategy sends model and prompt only", async () => {
    let observedRequestBody: Record<string, unknown> | undefined;
    const result = await generate({
      fetchImpl: createFetchForPayload({
        onRequest: (body) => {
          observedRequestBody = body;
        },
      }),
      model: "gpt-image-2",
    });

    expect(observedRequestBody).toEqual({
      model: "gpt-image-2",
      prompt: promptText,
    });
    expect(observedRequestBody).not.toHaveProperty("n");
    expect(observedRequestBody).not.toHaveProperty("size");
    expect(observedRequestBody).not.toHaveProperty("response_format");
    expect(result).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expectNoLeak(JSON.stringify(result));
  });

  test("DALL-E-3 strategy requests one image without explicit URL or b64 output", async () => {
    let observedRequestBody: Record<string, unknown> | undefined;
    const result = await generate({
      fetchImpl: createFetchForPayload({
        onRequest: (body) => {
          observedRequestBody = body;
        },
      }),
      model: "dall-e-3",
    });

    expect(observedRequestBody).toEqual({
      model: "dall-e-3",
      n: 1,
      prompt: promptText,
      size: "1024x1024",
    });
    expect(observedRequestBody).not.toHaveProperty("url");
    expect(observedRequestBody).not.toHaveProperty("response_format");
    expect(observedRequestBody).not.toHaveProperty("output_format");
    expect(result).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expectNoLeak(JSON.stringify(result));
  });

  test("DALL-E-3 b64_json response verifies and stores safe metadata only", async () => {
    const rootPath = await makeStorageRoot();

    try {
      const result = await generate({
        fetchImpl: createFetchForPayload(),
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          now: () => "2026-06-06T00:00:00.000Z",
          rootPath,
        }),
        model: "dall-e-3",
      });

      expect(result).toMatchObject({
        kind: "generated",
        status: "generated",
        artifact: {
          artifactId: "phase154_request_openai_image",
          contentType: "image/png",
          createdAt: "2026-06-06T00:00:00.000Z",
          generationKind: "image",
          providerId: "openai",
          sizeBytes: 8,
          status: "metadata_only",
          storageState: "metadata_only",
        },
      });

      if (result?.kind === "generated") {
        expect(result.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      }

      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("missing DALL-E-3 b64_json maps to safe provider response diagnostic", async () => {
    const rootPath = await makeStorageRoot();

    try {
      const result = await generate({
        fetchImpl: createFetchForPayload({
          body: { data: [{}], rawProviderBody },
        }),
        generatedImageArtifactStorage: createLocalGeneratedImageArtifactStorage({
          rootPath,
        }),
        model: "dall-e-3",
      });

      expect(result).toMatchObject({
        diagnosticCode: "provider_missing_b64_json",
        failureCategory: "provider_response",
        kind: "artifact_storage_unavailable",
      });
      expectNoLeak(JSON.stringify(result));
    } finally {
      await removeStorageRoot(rootPath);
    }
  });

  test("unsupported model env fails closed before provider fetch or decrypt", async () => {
    const app = await startGenerationApp();

    try {
      const result = await postGenerationJob(app.baseUrl);

      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        attemptedProviderIds: [],
        diagnosticCode: "real_provider_gate_missing",
        failureCategory: "runtime_gate",
        kind: "generation_job_rejected",
        status: "generation_execution_blocked",
      });
      expect(
        (result.body.runtime as { vendorCallsEnabled?: unknown }).vendorCallsEnabled,
      ).toBe(false);
      expect(app.calls.providerFetch).toBe(0);
      expect(app.calls.decrypt).toBe(0);
      expectNoLeak(result.text);
    } finally {
      await stopServer(app.server);
    }
  });

  test("source and runbook document DALL-E-3 model strategy without SDK frontend delivery or billing changes", () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const configSource = readSource("backend/generation/generationRuntimeConfig.ts");
    const appSource = readSource("backend/app.ts");
    const runbookSource = readSource(
      "docs/real-openai-generation-diagnostic-capture-runbook.md",
    );
    const packageJson = readSource("package.json");
    const frontendSource = [
      readSource("src/services/sceneGenerationService.ts"),
      readSource("src/store/sceneStore.ts"),
      readSource("src/agents/sceneGenerationAgent.ts"),
      readSource("src/pages/MixerPage.tsx"),
    ].join("\n");
    const creditsBillingSource = [
      readSource("src/pages/CreditsPage.tsx"),
      readSource("src/services/billingService.ts"),
    ].join("\n");
    const exportRouteSource = readSource("backend/routes/exports.ts");

    expect(adapterSource).toContain("dall-e-3");
    expect(adapterSource).toContain("n: 1");
    expect(configSource).toContain("FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_MODEL");
    expect(appSource).toContain("generationOpenAiImageModelConfig");
    expect(runbookSource).toContain(
      "FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_MODEL=dall-e-3",
    );

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
    ]) {
      expect(adapterSource).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }

    expect(frontendSource).not.toContain("/generation/jobs");
    expect(creditsBillingSource).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(exportRouteSource).toContain("route_execution_disabled");
  });
});
