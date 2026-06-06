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
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const projectRoot = process.cwd();
const originalFetch = globalThis.fetch;
const rawProviderKey = "FAKE_PHASE150_OPENAI_KEY_DO_NOT_RETURN";
const encryptedPayload = "PHASE150_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "PHASE150_SECRET_REF_DO_NOT_RETURN";
const promptText = "A phase 150 prompt that must stay out of responses";
const providerEndpoint = "https://api.openai.com/v1/images/generations";
const rawProviderMessage = "PHASE150_RAW_PROVIDER_MESSAGE_DO_NOT_RETURN";
const rawProviderBody = "PHASE150_RAW_PROVIDER_BODY_DO_NOT_RETURN";
const providerRequestId = "req_phase150_do_not_return";
const orgMetadata = "org_phase150_do_not_return";

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  providerFetch: number;
  storage: number;
}

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase150-subject",
  kind: "authenticated",
  userId: "phase150-user",
  workspaceId: "phase150-workspace",
};

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
  providerKeyId: "phase150-provider-key",
  providerName: "openai",
  workspaceId: "phase150-workspace",
  ownerId: "phase150-owner",
  createdByUserId: "phase150-owner",
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
    expect(providerKeyId).toBe("phase150-provider-key");
    return createActiveValidatedKey();
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ) => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase150-workspace");
    expect(providerId).toBe("openai");
    return createActiveValidatedKey();
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in Phase 150.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in Phase 150.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in Phase 150.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in Phase 150.");
  },
});

const createReadyVault = (calls = createCalls()): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in Phase 150.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase150-provider-key");
    expect(input.workspaceId).toBe("phase150-workspace");
    return {
      kind: "vault_provider_key_decrypted",
      plaintextKey: rawProviderKey,
      status: "decrypted",
    };
  },
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in Phase 150.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in Phase 150.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in Phase 150.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase150-user");
    expect(workspaceId).toBe("phase150-workspace");
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
  code,
  message = rawProviderMessage,
  param,
  type,
}: {
  calls?: DependencyCalls;
  code?: string;
  message?: string;
  param?: string;
  type?: string;
}): typeof fetch =>
  (async (input, init) => {
    calls && (calls.providerFetch += 1);
    expect(String(input)).toBe(providerEndpoint);
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawProviderKey}`);
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(JSON.stringify(init?.body)).not.toContain(rawProviderKey);

    return new Response(
      JSON.stringify({
        error: {
          code,
          message,
          param,
          type,
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

const generateWithProvider400 = async (
  providerError: Parameters<typeof createProvider400Fetch>[0],
) =>
  createOpenAiImageGenerationAdapter({
    fetchImpl: createProvider400Fetch(providerError),
    providerKeyRepository: createProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    requestShape: "minimal",
    timeoutMs: 10,
  }).generateImageFromStoredProviderKey?.({
    generationKind: "image",
    prompt: promptText,
    providerId: "openai",
    providerKeyId: "phase150-provider-key",
    requestId: "phase150_request",
    workspaceId: "phase150-workspace",
  });

const startGenerationApp = async (
  providerError: Parameters<typeof createProvider400Fetch>[0],
): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
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
        provider: "phase150-session",
      },
      generatedImageArtifactStorage: createStorageTripwire(calls),
      generationExecutionControlReadiness: controlsReady(),
      generationOpenAiImageRealLocalSmokeEnabled: true,
      generationRouteExecutionMode: "real_provider_local_only",
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createProvider400Fetch({
        ...providerError,
        calls,
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
      requestId: "phase150_request",
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
    "organization must be verified",
    "you do not have access to model gpt-image-2",
    "unknown parameter",
    "generic provider surprise",
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

test.describe("phase150 OpenAI provider 400 safe message param classifier", () => {
  test("message and param tokens classify provider 400 without raw message leaks", async () => {
    const cases = [
      {
        error: { message: "organization must be verified" },
        expectedDiagnosticCode: "provider_org_verification_required",
        expectedKind: "generation_failed",
      },
      {
        error: { message: "you do not have access to model gpt-image-2" },
        expectedDiagnosticCode: "provider_model_unsupported",
        expectedKind: "generation_failed",
      },
      {
        error: { message: "unknown parameter" },
        expectedDiagnosticCode: "provider_request_shape_invalid",
        expectedKind: "generation_failed",
      },
      {
        error: { param: "model" },
        expectedDiagnosticCode: "provider_model_unsupported",
        expectedKind: "generation_failed",
      },
      {
        error: {
          message: "verify your organization before using this image model",
          type: "image_generation_user_error",
        },
        expectedDiagnosticCode: "provider_org_verification_required",
        expectedKind: "generation_failed",
      },
      {
        error: { message: "generic provider surprise" },
        expectedDiagnosticCode: "provider_unexpected_400",
        expectedKind: "generation_failed",
      },
    ];

    for (const entry of cases) {
      const result = await generateWithProvider400(entry.error);

      expect(result).toMatchObject({
        diagnosticCode: entry.expectedDiagnosticCode,
        failureCategory: "provider_status",
        kind: entry.expectedKind,
      });
      expectNoLeak(JSON.stringify(result));
    }
  });

  test("route response carries enum-only diagnostics and no raw provider message", async () => {
    const app = await startGenerationApp({
      message: "organization must be verified",
      type: "image_generation_user_error",
    });

    try {
      const result = await postGenerationJob(app.baseUrl);

      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        attemptedProviderIds: ["openai"],
        diagnosticCode: "provider_org_verification_required",
        failureCategory: "provider_status",
        kind: "generation_job_rejected",
        status: "generation_failed",
      });
      expect(
        (result.body.runtime as { vendorCallsEnabled?: unknown }).vendorCallsEnabled,
      ).toBe(true);
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

  test("source and runbook document safe classifier outcomes without route expansion", () => {
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

    expect(adapterSource).toContain("value.error.message");
    expect(adapterSource).toContain("value.error.param");
    expect(adapterSource).toContain("organization must be verified");
    expect(adapterSource).toContain("do not have access");
    expect(routeSource).toContain('requestShape: "minimal"');
    expect(runbookSource).toContain("provider_org_verification_required");
    expect(runbookSource).toContain("verify OpenAI API organization/project");

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
