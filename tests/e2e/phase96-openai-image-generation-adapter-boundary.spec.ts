import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { BackendRequesterContext } from "../../backend/auth/requesterContext";
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import { createGenerationRouter } from "../../backend/routes/generation";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE96_OPENAI_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE96_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE96_SECRET_REF_DO_NOT_RETURN";
const jwtLike = "phase96.header.payload";
const serviceRoleLike = "supabase_service_role_PHASE96_DO_NOT_RETURN";
const encryptionKeyLike = Buffer.alloc(32).toString("base64");
const providerResponseBody = "FAKE_PHASE96_PROVIDER_BODY_DO_NOT_RETURN";
const providerRequestId = "req_phase96_do_not_return";
const providerAccountMetadata = "org_phase96_do_not_return";
const base64Image = Buffer.from("FAKE_PHASE96_IMAGE_BYTES_DO_NOT_RETURN").toString(
  "base64",
);
const providerImageUrl = "https://example.invalid/phase96-provider-image.png";
const localPath = "C:\\phase96\\provider-image.png";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const expectNoSecretLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    jwtLike,
    serviceRoleLike,
    encryptionKeyLike,
    providerResponseBody,
    providerRequestId,
    providerAccountMetadata,
    base64Image,
    providerImageUrl,
    localPath,
    "encrypted_payload",
    "secret_ref",
    "Authorization",
    "request_id",
    "organization",
    "b64_json",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class Phase96ProviderKeyRepository implements BackendProviderKeyRepository {
  constructor(
    private readonly options: {
      providerName?: BackendProviderKeyRecord["providerName"];
      status?: BackendProviderKeyRecord["status"];
      workspaceId?: string;
      withSecretHandle?: boolean;
    } = {},
  ) {}

  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    return {
      providerKeyId,
      providerName: this.options.providerName ?? "openai",
      workspaceId: this.options.workspaceId ?? "phase96-workspace",
      ownerId: "phase96-owner",
      createdByUserId: "phase96-owner",
      encryptedSecret:
        this.options.withSecretHandle === false
          ? undefined
          : {
              algorithm: "AES-256-GCM",
              encryptedPayload,
              keyVersion: "v1",
            },
      status: this.options.status ?? "active",
      verificationStatus: "validated",
      needsReverification: false,
    };
  }

  async listForWorkspace(): Promise<BackendProviderKeyRecord[]> {
    return [];
  }

  async createProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 96 tests.",
    };
  }

  async replaceProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 96 tests.",
    };
  }

  async revokeProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 96 tests.",
    };
  }

  async updateProviderKeyValidationState(
    _input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    return {
      kind: "validation_state_unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 96 tests.",
    };
  }
}

const createReadyVault = (): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 96 tests.",
  }),
  decryptProviderKey: async () => ({
    kind: "vault_provider_key_decrypted",
    status: "decrypted",
    plaintextKey: rawProviderKey,
  }),
  storeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 96 tests.",
  }),
  revokeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 96 tests.",
  }),
  rotateProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 96 tests.",
  }),
});

const createFetchForStatus = (
  status: number,
  onRequest?: (input: RequestInfo | URL, init?: RequestInit) => void,
): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    onRequest?.(input, init);

    return {
      headers: new Headers({
        "x-request-id": providerRequestId,
      }),
      json: async () => ({
        data: [
          {
            b64_json: base64Image,
            revised_prompt: providerResponseBody,
            url: providerImageUrl,
          },
        ],
        organization: providerAccountMetadata,
      }),
      status,
      text: async () => providerResponseBody,
    } as Response;
  }) as typeof fetch;

const createTimedOutFetch = (): typeof fetch =>
  ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      });
    })) as typeof fetch;

const validateRequestShape = (
  input: RequestInfo | URL,
  init?: RequestInit,
): void => {
  expect(input.toString()).toBe("https://api.openai.com/v1/images/generations");
  expect(init?.method).toBe("POST");
  expect((init?.headers as Record<string, string>).Authorization).toBe(
    `Bearer ${rawProviderKey}`,
  );
  expect((init?.headers as Record<string, string>)["Content-Type"]).toBe(
    "application/json",
  );

  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  expect(body).toEqual({
    model: "gpt-image-2",
    n: 1,
    prompt: "A safe single-image prompt",
    quality: "low",
    size: "1024x1024",
  });
  expect(body).not.toHaveProperty("stream");
  expect(body).not.toHaveProperty("mask");
  expect(body).not.toHaveProperty("image");
  expect(body).not.toHaveProperty("images");
  expect(body).not.toHaveProperty("response_format");
};

const generateWithStatus = async (status: number) =>
  createOpenAiImageGenerationAdapter({
    fetchImpl: createFetchForStatus(status),
    providerKeyRepository: new Phase96ProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: "A safe single-image prompt",
    providerId: "openai",
    providerKeyId: "phase96-provider-key",
    requestId: "phase96-request",
    workspaceId: "phase96-workspace",
  });

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

test.describe("phase96 OpenAI image generation adapter boundary", () => {
  test("adapter boundary exists backend-only and uses single-image Images API request shape", async () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    let requestWasObserved = false;
    const result = await createOpenAiImageGenerationAdapter({
      fetchImpl: createFetchForStatus(200, (input, init) => {
        requestWasObserved = true;
        validateRequestShape(input, init);
      }),
      providerKeyRepository: new Phase96ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
      timeoutMs: 10,
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    expect(requestWasObserved).toBe(true);
    expect(result).toEqual({
      kind: "artifact_storage_unavailable",
      status: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
      message:
        "OpenAI image generation returned a provider result, but generated artifact storage is not configured.",
    });
    expect(adapterSource).toContain(
      "https://api.openai.com/v1/images/generations",
    );
    expect(adapterSource).toContain("gpt-image-2");
    expect(adapterSource).toContain("n: 1");
    expect(adapterSource).toContain("1024x1024");
    expect(adapterSource).not.toContain("from \"openai\"");
    expect(adapterSource).not.toContain("new OpenAI");
    expectNoSecretLeak(JSON.stringify(result));
  });

  test("adapter maps provider statuses to safe generation results without leaking provider payloads", async () => {
    const successWithoutStorage = await generateWithStatus(200);
    const badPrompt = await generateWithStatus(400);
    const unauthorized = await generateWithStatus(401);
    const forbidden = await generateWithStatus(403);
    const rateLimited = await generateWithStatus(429);
    const unavailable = await generateWithStatus(500);
    const unknownFailure = await generateWithStatus(418);

    expect(successWithoutStorage).toMatchObject({
      kind: "artifact_storage_unavailable",
      errorCode: "artifact_storage_unavailable",
    });
    expect(badPrompt).toMatchObject({
      kind: "invalid_prompt",
      errorCode: "invalid_prompt",
    });
    expect(unauthorized).toMatchObject({
      kind: "generation_failed",
      errorCode: "invalid_credentials",
    });
    expect(forbidden).toMatchObject({
      kind: "generation_failed",
      errorCode: "invalid_credentials",
    });
    expect(rateLimited).toMatchObject({
      kind: "rate_limited",
      errorCode: "rate_limited",
    });
    expect(unavailable).toMatchObject({
      kind: "provider_unavailable",
      errorCode: "provider_unavailable",
    });
    expect(unknownFailure).toMatchObject({
      kind: "generation_failed",
      errorCode: "generation_failed",
    });

    for (const result of [
      successWithoutStorage,
      badPrompt,
      unauthorized,
      forbidden,
      rateLimited,
      unavailable,
      unknownFailure,
    ]) {
      expectNoSecretLeak(JSON.stringify(result));
    }
  });

  test("adapter maps timeout network unsupported provider missing key and vault failures safely", async () => {
    const timeout = await createOpenAiImageGenerationAdapter({
      fetchImpl: createTimedOutFetch(),
      providerKeyRepository: new Phase96ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
      timeoutMs: 1,
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    const network = await createOpenAiImageGenerationAdapter({
      fetchImpl: (async () => {
        throw new Error("network unavailable");
      }) as typeof fetch,
      providerKeyRepository: new Phase96ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    const unsupported = await createOpenAiImageGenerationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase96ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "replicate",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    const missingKey = await createOpenAiImageGenerationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase96ProviderKeyRepository({
        workspaceId: "other-workspace",
      }),
      providerSecretVault: createReadyVault(),
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    const noHandle = await createOpenAiImageGenerationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase96ProviderKeyRepository({
        withSecretHandle: false,
      }),
      providerSecretVault: createReadyVault(),
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    const decryptFailedVault: ProviderSecretVault = {
      ...createReadyVault(),
      decryptProviderKey: async () => ({
        kind: "vault_decrypt_failed",
        status: "decrypt_failed",
        message: "Do not leak crypto details.",
      }),
    };
    const decryptFailed = await createOpenAiImageGenerationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase96ProviderKeyRepository(),
      providerSecretVault: decryptFailedVault,
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: "A safe single-image prompt",
      providerId: "openai",
      providerKeyId: "phase96-provider-key",
      requestId: "phase96-request",
      workspaceId: "phase96-workspace",
    });

    expect(timeout).toMatchObject({ kind: "timeout", errorCode: "timeout" });
    expect(network).toMatchObject({
      kind: "provider_unavailable",
      errorCode: "provider_unavailable",
    });
    expect(unsupported).toMatchObject({
      kind: "invalid_provider",
      errorCode: "invalid_provider",
    });
    expect(missingKey).toMatchObject({
      kind: "key_not_found",
      errorCode: "key_not_found",
    });
    expect(noHandle).toMatchObject({
      kind: "vault_decrypt_failed",
      errorCode: "vault_decrypt_failed",
    });
    expect(decryptFailed).toMatchObject({
      kind: "vault_decrypt_failed",
      errorCode: "vault_decrypt_failed",
    });

    for (const result of [
      timeout,
      network,
      unsupported,
      missingKey,
      noHandle,
      decryptFailed,
    ]) {
      expectNoSecretLeak(JSON.stringify(result));
    }
  });

  test("generation jobs route remains disabled and cannot reach the adapter", async () => {
    const { baseUrl, server } = await startGenerationApp({
      authProvider: "session",
      authSubject: "phase96-subject",
      kind: "authenticated",
      userId: "phase96-user",
      workspaceId: "phase96-workspace",
    });

    try {
      const statusResponse = await fetch(`${baseUrl}/generation/runtime-status`);
      const statusBody = await statusResponse.json();
      const jobResponse = await fetch(`${baseUrl}/generation/jobs`, {
        body: JSON.stringify({
          prompt: "A safe single-image prompt",
          providerId: "openai",
          rawApiKey: rawProviderKey,
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
      expect(jobResponse.status).toBe(503);
      expect(jobBody.status).toBe("generation_runtime_disabled");
      expect(jobBody.attemptedProviderIds).toEqual([]);
      expect(jobBody.runtime.vendorCallsEnabled).toBe(false);
      expectNoSecretLeak(JSON.stringify(statusBody));
      expectNoSecretLeak(JSON.stringify(jobBody));
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries avoid SDKs disallowed endpoints frontend activation and unrelated runtime expansion", () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const routeSource = readSource("backend/routes/generation.ts");
    const packageJson = readSource("package.json");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const sceneService = readSource("src/services/sceneGenerationService.ts");
    const sceneStore = readSource("src/store/sceneStore.ts");
    const sceneAgent = readSource("src/agents/sceneGenerationAgent.ts");
    const mixerPage = readSource("src/pages/MixerPage.tsx");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRoute = readSource("backend/routes/exports.ts");
    const frontendSource = [
      providerSettingsPage,
      sceneService,
      sceneStore,
      sceneAgent,
      mixerPage,
    ].join("\n");

    expect(adapterSource).toContain("/v1/images/generations");
    expect(adapterSource).toContain("fetchImpl");
    expect(routeSource).not.toContain("createOpenAiImageGenerationAdapter");

    for (const forbidden of [
      "/v1/responses",
      "/v1/chat",
      "/v1/files",
      "/v1/uploads",
      "/v1/images/edits",
      "/v1/images/variations",
      "stream: true",
      "mask:",
      "image:",
      "images:",
      "n: 2",
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "generation_enabled",
    ]) {
      expect(adapterSource).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
    }

    expect(frontendSource).not.toContain(
      "FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS",
    );
    expect(frontendSource).not.toContain("/v1/images/generations");
    expect(sceneService).not.toContain("/generation/jobs");
    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(exportRoute).toContain("route_execution_disabled");
  });
});
