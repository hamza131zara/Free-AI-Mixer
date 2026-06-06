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
import type {
  GeneratedImageArtifactStorage,
  GeneratedImageArtifactStorageResult,
} from "../../backend/generation/generatedImageArtifactStorage";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createGenerationRouter } from "../../backend/routes/generation";

const originalFetch = globalThis.fetch;
const rawKey = "FAKE_PHASE137_DECRYPTED_KEY_DO_NOT_RETURN";
const rawErrorMessage = "PHASE137_RAW_THROW_MESSAGE_NOT_RETURNED";
const promptText = "A phase 137 prompt that must stay out of responses";
const encryptedPayload = "PHASE137_ENCRYPTED_PAYLOAD_NOT_RETURNED";
const secretRef = "PHASE137_SECRET_REF_NOT_RETURNED";
const validPngBase64 = "iVBORw0KGgo=";
const providerUrl = "https://api.openai.com/v1/images/generations";
const providerRawBody = "PHASE137_PROVIDER_RAW_BODY_NOT_RETURNED";
const providerRequestId = "phase137-provider-request-id-not-returned";

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase137-subject",
  kind: "authenticated",
  userId: "phase137-user",
  workspaceId: "phase137-workspace",
};

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  providerFetch: number;
  storage: number;
  vaultReadiness: number;
}

type ThrowScenario =
  | "provider_key_lookup"
  | "storage_store"
  | "unexpected_adapter_execution"
  | "vault_decrypt";

const createCalls = (): DependencyCalls => ({
  decrypt: 0,
  keyLookup: 0,
  membership: 0,
  providerFetch: 0,
  storage: 0,
  vaultReadiness: 0,
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
  providerKeyId: "phase137-provider-key",
  providerName: "openai",
  workspaceId: "phase137-workspace",
  ownerId: "phase137-owner",
  createdByUserId: "phase137-owner",
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

const createUnexpectedThrowRecord = (): BackendProviderKeyRecord =>
  Object.defineProperty(
    {
      providerKeyId: "phase137-provider-key",
      providerName: "openai",
      workspaceId: "phase137-workspace",
      ownerId: "phase137-owner",
      createdByUserId: "phase137-owner",
      secretRef,
      status: "active",
      verificationStatus: "validated",
      needsReverification: false,
    },
    "encryptedSecret",
    {
      get() {
        throw new Error(rawErrorMessage);
      },
    },
  ) as BackendProviderKeyRecord;

const validJobRequest = () => ({
  generationKind: "image",
  prompt: promptText,
  providerId: "openai",
  requestId: "phase137_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
  scenario: ThrowScenario,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (providerKeyId) => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase137-provider-key");

    if (scenario === "provider_key_lookup") {
      throw new Error(rawErrorMessage);
    }

    if (scenario === "unexpected_adapter_execution") {
      return createUnexpectedThrowRecord();
    }

    return createActiveValidatedKey();
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ) => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase137-workspace");
    expect(providerId).toBe("openai");
    return createActiveValidatedKey();
  },
  listForWorkspace: async (): Promise<BackendProviderKeyRecord[]> => {
    throw new Error("Provider key list must not run in generation execution.");
  },
  createProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key create must not run in generation execution.");
  },
  replaceProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key replace must not run in generation execution.");
  },
  revokeProviderKey: async (): Promise<BackendProviderKeyStorageResult> => {
    throw new Error("Provider key revoke must not run in generation execution.");
  },
});

const createVault = (
  calls: DependencyCalls,
  scenario: ThrowScenario,
): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vaultReadiness += 1;
    return { kind: "vault_ready" };
  },
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in generation execution.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase137-provider-key");
    expect(input.workspaceId).toBe("phase137-workspace");

    if (scenario === "vault_decrypt") {
      throw new Error(rawErrorMessage);
    }

    return {
      kind: "vault_provider_key_decrypted",
      plaintextKey: rawKey,
      status: "decrypted",
    };
  },
  storeProviderKey: async () => {
    throw new Error("Vault store must not run in generation execution.");
  },
  revokeProviderKey: async () => {
    throw new Error("Vault revoke must not run in generation execution.");
  },
  rotateProviderKey: async () => {
    throw new Error("Vault rotate must not run in generation execution.");
  },
});

const createMembershipRepository = (
  calls: DependencyCalls,
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => {
    calls.membership += 1;
    expect(userId).toBe("phase137-user");
    expect(workspaceId).toBe("phase137-workspace");
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

const createProviderFetch = (calls: DependencyCalls): typeof fetch =>
  (async (input, init) => {
    calls.providerFetch += 1;
    expect(String(input)).toBe(providerUrl);
    expect(init?.method).toBe("POST");
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(JSON.stringify(init?.body)).not.toContain(rawKey);
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawKey}`);

    return new Response(
      JSON.stringify({
        data: [{ b64_json: validPngBase64 }],
        rawProviderBody: providerRawBody,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": providerRequestId,
        },
        status: 200,
      },
    );
  }) as typeof fetch;

const createThrowingStorage = (
  calls: DependencyCalls,
): GeneratedImageArtifactStorage => ({
  cleanup: async () => ({ kind: "cleaned" }),
  store: async (): Promise<GeneratedImageArtifactStorageResult> => {
    calls.storage += 1;
    throw new Error(rawErrorMessage);
  },
});

const startGenerationApp = async (
  scenario: ThrowScenario,
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
        provider: "phase137-session",
      },
      generatedImageArtifactStorage: createThrowingStorage(calls),
      generationExecutionControlReadiness: controlsReady(),
      generationOpenAiImageRealLocalSmokeEnabled: true,
      generationRouteExecutionMode: "real_provider_local_only",
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createProviderFetch(calls),
      providerKeyRepository: createProviderKeyRepository(calls, scenario),
      providerSecretVault: createVault(calls, scenario),
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
    body: JSON.stringify(validJobRequest()),
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
    rawKey,
    rawErrorMessage,
    promptText,
    encryptedPayload,
    secretRef,
    providerUrl,
    validPngBase64,
    providerRawBody,
    providerRequestId,
    "Authorization",
    "Bearer ",
    "workspaceId",
    "ownerId",
    "providerKeyId",
    "publicUrl",
    "signedUrl",
    "downloadUrl",
    "internalRef",
    "filePath",
    "rootPath",
    "directoryPath",
    "stack",
    "bytes",
    "\"b64_json\":",
    "\"base64\":",
    "rawProviderBody",
    "encrypted_payload",
    "secret_ref",
    "service_role",
    "JWT",
    "fake_success",
    "fake_progress",
    "fake_artifact",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase137 real OpenAI generation non-JSON 503 safe fallback", () => {
  test("thrown real-local execution branches return generation-shaped JSON diagnostics", async () => {
    const cases = [
      {
        expectedDiagnosticCode: "artifact_storage_write_failed",
        expectedFailureCategory: "artifact_storage",
        expectedStatus: "artifact_storage_unavailable",
        scenario: "storage_store" as const,
      },
      {
        expectedDiagnosticCode: "vault_decrypt_failed",
        expectedFailureCategory: "vault",
        expectedStatus: "vault_decrypt_failed",
        scenario: "vault_decrypt" as const,
      },
      {
        expectedDiagnosticCode: "provider_key_lookup_failed",
        expectedFailureCategory: "provider_key_repository",
        expectedStatus: "generation_failed",
        scenario: "provider_key_lookup" as const,
      },
      {
        expectedDiagnosticCode: "generation_execution_unhandled_exception",
        expectedFailureCategory: "generation_runtime",
        expectedStatus: "generation_failed",
        scenario: "unexpected_adapter_execution" as const,
      },
    ];

    for (const testCase of cases) {
      const app = await startGenerationApp(testCase.scenario);

      try {
        const result = await postGenerationJob(app.baseUrl);

        expect(result.status).toBe(503);
        expect(result.body).toMatchObject({
          attemptedProviderIds: ["openai"],
          diagnosticCode: testCase.expectedDiagnosticCode,
          failureCategory: testCase.expectedFailureCategory,
          kind: "generation_job_rejected",
          status: testCase.expectedStatus,
        });
        expect(
          (result.body.runtime as { vendorCallsEnabled?: unknown }).vendorCallsEnabled,
        ).toBe(true);
        expectNoLeak(result.text);
      } finally {
        await stopServer(app.server);
      }
    }
  });

  test("runbook documents ErrorDetails.Message-first diagnostic capture", () => {
    const runbookSource = readFileSync(
      path.join(
        process.cwd(),
        "docs/real-openai-generation-diagnostic-capture-runbook.md",
      ),
      "utf8",
    );

    expect(runbookSource).toContain("$_.ErrorDetails.Message");
    expect(runbookSource.indexOf("$_.ErrorDetails.Message")).toBeLessThan(
      runbookSource.indexOf("GetResponseStream()"),
    );
    expect(runbookSource).toContain("raw body intentionally not printed");
    expect(runbookSource).toContain("Do not retry automatically");
  });
});
