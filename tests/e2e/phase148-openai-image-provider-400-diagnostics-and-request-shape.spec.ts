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
import { createOpenAiImageGenerationAdapter } from "../../backend/generation/openAiImageGenerationAdapter";
import type { GeneratedImageArtifactStorage } from "../../backend/generation/generatedImageArtifactStorage";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const originalFetch = globalThis.fetch;
const rawProviderKey = "FAKE_PHASE148_OPENAI_KEY_DO_NOT_RETURN";
const encryptedPayload = "PHASE148_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "PHASE148_SECRET_REF_DO_NOT_RETURN";
const promptText = "A phase 148 prompt that must stay out of responses";
const providerEndpoint = "https://api.openai.com/v1/images/generations";
const rawProviderMessage = "PHASE148_RAW_PROVIDER_MESSAGE_DO_NOT_RETURN";
const rawProviderBody = "PHASE148_RAW_PROVIDER_BODY_DO_NOT_RETURN";
const providerRequestId = "req_phase148_do_not_return";
const orgMetadata = "org_phase148_do_not_return";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase148-subject",
  kind: "authenticated",
  userId: "phase148-user",
  workspaceId: "phase148-workspace",
};

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  providerFetch: number;
  storage: number;
}

const createCalls = (): DependencyCalls => ({
  decrypt: 0,
  keyLookup: 0,
  membership: 0,
  providerFetch: 0,
  storage: 0,
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
  providerKeyId: "phase148-provider-key",
  providerName: "openai",
  workspaceId: "phase148-workspace",
  ownerId: "phase148-owner",
  createdByUserId: "phase148-owner",
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
  getByProviderKeyId: async (providerKeyId) => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase148-provider-key");
    return createActiveValidatedKey();
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ) => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase148-workspace");
    expect(providerId).toBe("openai");
    return createActiveValidatedKey();
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in Phase 148.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in Phase 148.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in Phase 148.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in Phase 148.");
  },
  updateProviderKeyValidationState: async (
    _input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> => ({
    kind: "validation_state_unavailable",
    status: "unavailable",
    code: "repository_unavailable",
    message: "Not used by Phase 148 tests.",
  }),
});

const createReadyVault = (calls = createCalls()): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in Phase 148.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase148-provider-key");
    expect(input.workspaceId).toBe("phase148-workspace");
    return {
      kind: "vault_provider_key_decrypted",
      plaintextKey: rawProviderKey,
      status: "decrypted",
    };
  },
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in Phase 148.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in Phase 148.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in Phase 148.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase148-user");
    expect(workspaceId).toBe("phase148-workspace");
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

const createStorageTripwire = (calls: DependencyCalls): GeneratedImageArtifactStorage => ({
  cleanup: async () => ({ kind: "cleaned" }),
  store: async () => {
    calls.storage += 1;
    throw new Error("Storage must not run for provider 400 diagnostics.");
  },
});

const createProvider400Fetch = ({
  calls,
  errorCode,
  errorType,
  onRequest,
}: {
  calls?: DependencyCalls;
  errorCode?: string;
  errorType?: string;
  onRequest?: (body: Record<string, unknown>) => void;
}): typeof fetch =>
  (async (input, init) => {
    calls && (calls.providerFetch += 1);
    expect(String(input)).toBe(providerEndpoint);
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawProviderKey}`);

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(JSON.stringify(body)).toContain(promptText);
    expect(JSON.stringify(body)).not.toContain(rawProviderKey);
    onRequest?.(body);

    return new Response(
      JSON.stringify({
        error: {
          code: errorCode,
          message: rawProviderMessage,
          type: errorType,
        },
        organization: orgMetadata,
        rawProviderBody,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": providerRequestId,
        },
        status: 400,
      },
    );
  }) as typeof fetch;

const generateWithProvider400 = async ({
  errorCode,
  errorType,
  onRequest,
}: {
  errorCode?: string;
  errorType?: string;
  onRequest?: (body: Record<string, unknown>) => void;
}) =>
  createOpenAiImageGenerationAdapter({
    fetchImpl: createProvider400Fetch({ errorCode, errorType, onRequest }),
    providerKeyRepository: createProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: promptText,
    providerId: "openai",
    providerKeyId: "phase148-provider-key",
    requestId: "phase148_request",
    workspaceId: "phase148-workspace",
  });

const startGenerationApp = async ({
  onRequest,
}: {
  onRequest?: (body: Record<string, unknown>) => void;
}): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
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
        provider: "phase148-session",
      },
      generatedImageArtifactStorage: createStorageTripwire(calls),
      generationExecutionControlReadiness: controlsReady(),
      generationOpenAiImageRealLocalSmokeEnabled: true,
      generationRouteExecutionMode: "real_provider_local_only",
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createProvider400Fetch({
        calls,
        errorCode: "invalid_request_error",
        errorType: "invalid_request_error",
        onRequest,
      }),
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
  const response = await originalFetch(`${baseUrl}/generation/jobs`, {
    body: JSON.stringify({
      generationKind: "image",
      prompt: promptText,
      providerId: "openai",
      requestId: "phase148_request",
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
    rawProviderMessage,
    rawProviderBody,
    providerRequestId,
    orgMetadata,
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
    "organization",
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

test.describe("phase148 OpenAI image provider 400 diagnostics and request shape", () => {
  test("provider 400 maps to safe enum diagnostics without raw provider body leaks", async () => {
    const cases = [
      {
        errorCode: "invalid_prompt",
        expectedDiagnosticCode: "provider_invalid_prompt",
        expectedFailureCategory: "provider_status",
        expectedKind: "invalid_prompt",
      },
      {
        errorCode: "unsupported_model",
        expectedDiagnosticCode: "provider_model_unsupported",
        expectedFailureCategory: "provider_status",
        expectedKind: "generation_failed",
      },
      {
        errorType: "invalid_request_error",
        expectedDiagnosticCode: "provider_request_shape_invalid",
        expectedFailureCategory: "provider_status",
        expectedKind: "generation_failed",
      },
      {
        errorCode: "organization_verification_required",
        expectedDiagnosticCode: "provider_org_verification_required",
        expectedFailureCategory: "provider_status",
        expectedKind: "generation_failed",
      },
      {
        errorCode: "content_policy_violation",
        expectedDiagnosticCode: "provider_moderation_blocked",
        expectedFailureCategory: "provider_status",
        expectedKind: "invalid_prompt",
      },
      {
        errorCode: "unsupported_response_format",
        expectedDiagnosticCode: "provider_response_format_unsupported",
        expectedFailureCategory: "provider_status",
        expectedKind: "generation_failed",
      },
      {
        errorCode: "phase148_unknown_provider_code",
        expectedDiagnosticCode: "provider_unexpected_400",
        expectedFailureCategory: "provider_status",
        expectedKind: "generation_failed",
      },
    ];

    for (const entry of cases) {
      const result = await generateWithProvider400(entry);

      expect(result).toMatchObject({
        diagnosticCode: entry.expectedDiagnosticCode,
        failureCategory: entry.expectedFailureCategory,
        kind: entry.expectedKind,
      });
      expectNoLeak(JSON.stringify(result));
    }
  });

  test("real-provider local route sends minimal model and prompt request shape", async () => {
    let observedRequestBody: Record<string, unknown> | undefined;
    const app = await startGenerationApp({
      onRequest: (body) => {
        observedRequestBody = body;
      },
    });

    try {
      const result = await postGenerationJob(app.baseUrl);

      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        attemptedProviderIds: ["openai"],
        diagnosticCode: "provider_request_shape_invalid",
        failureCategory: "provider_status",
        kind: "generation_job_rejected",
        status: "generation_failed",
      });
      expect(
        (result.body.runtime as { vendorCallsEnabled?: unknown }).vendorCallsEnabled,
      ).toBe(true);
      expect(observedRequestBody).toEqual({
        model: "gpt-image-2",
        prompt: promptText,
      });
      expect(observedRequestBody).not.toHaveProperty("n");
      expect(observedRequestBody).not.toHaveProperty("quality");
      expect(observedRequestBody).not.toHaveProperty("size");
      expect(observedRequestBody).not.toHaveProperty("response_format");
      expect(observedRequestBody).not.toHaveProperty("output_format");
      expect(app.calls).toMatchObject({
        decrypt: 1,
        keyLookup: 2,
        membership: 1,
        providerFetch: 1,
        storage: 0,
      });
      expectNoLeak(result.text);
    } finally {
      await stopServer(app.server);
    }
  });

  test("explicit adapter compatibility shape remains available for mocked boundary tests", async () => {
    let observedRequestBody: Record<string, unknown> | undefined;
    const result = await createOpenAiImageGenerationAdapter({
      fetchImpl: createProvider400Fetch({
        errorCode: "invalid_request_error",
        onRequest: (body) => {
          observedRequestBody = body;
        },
      }),
      providerKeyRepository: createProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
      requestShape: "single_image_low",
      timeoutMs: 10,
    }).generateImageFromStoredProviderKey?.({
      generationKind: "image",
      prompt: promptText,
      providerId: "openai",
      providerKeyId: "phase148-provider-key",
      requestId: "phase148_request",
      workspaceId: "phase148-workspace",
    });

    expect(observedRequestBody).toEqual({
      model: "gpt-image-2",
      n: 1,
      prompt: promptText,
      quality: "low",
      size: "1024x1024",
    });
    expect(result).toMatchObject({
      diagnosticCode: "provider_request_shape_invalid",
      failureCategory: "provider_status",
      kind: "generation_failed",
    });
    expectNoLeak(JSON.stringify(result));
  });

  test("source and runbook boundaries document safe provider 400 diagnostics", () => {
    const adapterSource = readSource(
      "backend/generation/openAiImageGenerationAdapter.ts",
    );
    const routeSource = readSource("backend/routes/generation.ts");
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

    expect(adapterSource).toContain("provider_request_shape_invalid");
    expect(adapterSource).toContain("provider_model_unsupported");
    expect(adapterSource).toContain("provider_org_verification_required");
    expect(adapterSource).toContain("provider_unexpected_400");
    expect(routeSource).toContain('requestShape: "minimal"');
    expect(runbookSource).toContain("provider_request_shape_invalid");
    expect(runbookSource).toContain("Do not retry real generation");

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
