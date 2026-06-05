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
const rawKey = "FAKE_PHASE134_DECRYPTED_KEY_DO_NOT_RETURN";
const promptText = "A phase 134 prompt that must stay out of responses";
const encryptedPayload = "PHASE134_ENCRYPTED_PAYLOAD_NOT_RETURNED";
const secretRef = "PHASE134_SECRET_REF_NOT_RETURNED";
const validPngBase64 = "iVBORw0KGgo=";
const invalidPngBase64 = Buffer.from("not-a-png").toString("base64");
const providerUrl = "https://api.openai.com/v1/images/generations";
const providerRawBody = "PHASE134_PROVIDER_RAW_BODY_NOT_RETURNED";
const providerRequestId = "phase134-provider-request-id-not-returned";

const authenticatedRequester: BackendRequesterContext = {
  authProvider: "session",
  authSubject: "phase134-subject",
  kind: "authenticated",
  userId: "phase134-user",
  workspaceId: "phase134-workspace",
};

interface DependencyCalls {
  decrypt: number;
  keyLookup: number;
  membership: number;
  providerFetch: number;
  storage: number;
  vaultReadiness: number;
}

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
  providerKeyId: "phase134-provider-key",
  providerName: "openai",
  workspaceId: "phase134-workspace",
  ownerId: "phase134-owner",
  createdByUserId: "phase134-owner",
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

const validJobRequest = () => ({
  generationKind: "image",
  prompt: promptText,
  providerId: "openai",
  requestId: "phase134_request",
});

const createProviderKeyRepository = (
  calls: DependencyCalls,
): BackendProviderKeyRepository => ({
  getByProviderKeyId: async (providerKeyId) => {
    calls.keyLookup += 1;
    expect(providerKeyId).toBe("phase134-provider-key");
    return createActiveValidatedKey();
  },
  getActiveValidatedProviderKeyForWorkspaceProvider: async (
    workspaceId,
    providerId,
  ) => {
    calls.keyLookup += 1;
    expect(workspaceId).toBe("phase134-workspace");
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

const createVault = (calls: DependencyCalls): ProviderSecretVault => ({
  getVaultReadiness: () => {
    calls.vaultReadiness += 1;
    return { kind: "vault_ready" };
  },
  encryptProviderKey: async () => {
    throw new Error("Vault encrypt must not run in generation execution.");
  },
  decryptProviderKey: async (input) => {
    calls.decrypt += 1;
    expect(input.providerKeyId).toBe("phase134-provider-key");
    expect(input.workspaceId).toBe("phase134-workspace");
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
    expect(userId).toBe("phase134-user");
    expect(workspaceId).toBe("phase134-workspace");
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

const createProviderFetch = (
  calls: DependencyCalls,
  result:
    | { kind: "network" }
    | { body?: unknown; kind: "response"; rawBody?: string; status: number },
): typeof fetch =>
  (async (input, init) => {
    calls.providerFetch += 1;
    expect(String(input)).toBe(providerUrl);
    expect(init?.method).toBe("POST");
    expect(JSON.stringify(init?.body)).toContain(promptText);
    expect(JSON.stringify(init?.body)).not.toContain(rawKey);
    expect(
      (init?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${rawKey}`);

    if (result.kind === "network") {
      throw new Error(`${providerRawBody} network failure`);
    }

    return new Response(
      result.rawBody ?? JSON.stringify(result.body ?? { rawProviderBody: true }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": providerRequestId,
        },
        status: result.status,
      },
    );
  }) as typeof fetch;

const createStorage = (calls: DependencyCalls): GeneratedImageArtifactStorage => ({
  cleanup: async () => ({ kind: "cleaned" }),
  store: async (): Promise<GeneratedImageArtifactStorageResult> => {
    calls.storage += 1;
    return {
      kind: "failed",
      code: "write_failed",
      message: "Generated image artifact write failed.",
    };
  },
});

const startGenerationApp = async (options: {
  fetchResult?:
    | { kind: "network" }
    | { body?: unknown; kind: "response"; rawBody?: string; status: number };
  realSmokeEnabled?: boolean;
  storage?: GeneratedImageArtifactStorage;
} = {}): Promise<{ baseUrl: string; calls: DependencyCalls; server: Server }> => {
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
        provider: "phase134-session",
      },
      ...(options.storage ? { generatedImageArtifactStorage: options.storage } : {}),
      generationExecutionControlReadiness: controlsReady(),
      generationOpenAiImageRealLocalSmokeEnabled:
        options.realSmokeEnabled ?? true,
      generationRouteExecutionMode: "real_provider_local_only",
      generationRuntimeConfig,
      generationRuntimeReadiness:
        getGenerationRuntimeCompositionReadiness(generationRuntimeConfig),
      openAiRealProviderFetch: createProviderFetch(
        calls,
        options.fetchResult ?? {
          body: { data: [{ b64_json: validPngBase64 }] },
          kind: "response",
          status: 200,
        },
      ),
      providerKeyRepository: createProviderKeyRepository(calls),
      providerSecretVault: createVault(calls),
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
    body: JSON.parse(text),
    status: response.status,
    text,
  };
};

const safeManualDiagnosticCapture = (responseText: string) => {
  try {
    const parsed = JSON.parse(responseText) as {
      attemptedProviderIds?: unknown;
      diagnosticCode?: unknown;
      failureCategory?: unknown;
      kind?: unknown;
      message?: unknown;
      runtime?: { vendorCallsEnabled?: unknown };
      status?: unknown;
    };

    return {
      attemptedProviderIds: parsed.attemptedProviderIds,
      diagnosticCode: parsed.diagnosticCode,
      failureCategory: parsed.failureCategory,
      kind: parsed.kind,
      message: parsed.message,
      runtime: {
        vendorCallsEnabled: parsed.runtime?.vendorCallsEnabled,
      },
      status: parsed.status,
    };
  } catch {
    return {
      kind: "generation_diagnostic_capture_unparseable_json",
      message:
        "Response body was not JSON; raw body intentionally not printed.",
    };
  }
};

const expectNoLeak = (serialized: string): void => {
  for (const forbidden of [
    rawKey,
    promptText,
    encryptedPayload,
    secretRef,
    providerUrl,
    validPngBase64,
    invalidPngBase64,
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

test.describe("phase134 real OpenAI generation 503 diagnostic capture", () => {
  test("real-provider-local 503 branches serialize safe diagnostics", async () => {
    const cases = [
      {
        expectedDiagnosticCode: "provider_missing_b64_json",
        expectedFailureCategory: "provider_response",
        expectedStatus: "artifact_storage_unavailable",
        fetchResult: { body: { data: [{}] }, kind: "response" as const, status: 200 },
        storage: createStorage(createCalls()),
      },
      {
        expectedDiagnosticCode: "provider_response_shape_unsupported",
        expectedFailureCategory: "provider_response",
        expectedStatus: "artifact_storage_unavailable",
        fetchResult: {
          body: { data: [{ b64_json: validPngBase64 }, { b64_json: validPngBase64 }] },
          kind: "response" as const,
          status: 200,
        },
        storage: createStorage(createCalls()),
      },
      {
        expectedDiagnosticCode: "real_provider_storage_not_ready",
        expectedFailureCategory: "artifact_storage",
        expectedStatus: "artifact_storage_unavailable",
        expectedVendorCallsEnabled: false,
        fetchResult: { body: { data: [{ b64_json: validPngBase64 }] }, kind: "response" as const, status: 200 },
        storage: undefined,
      },
      {
        expectedDiagnosticCode: "artifact_storage_write_failed",
        expectedFailureCategory: "artifact_storage",
        expectedStatus: "artifact_storage_unavailable",
        fetchResult: { body: { data: [{ b64_json: validPngBase64 }] }, kind: "response" as const, status: 200 },
        storage: undefined as GeneratedImageArtifactStorage | undefined,
        useFailingStorage: true,
      },
      {
        expectedDiagnosticCode: "artifact_verification_failed",
        expectedFailureCategory: "artifact_storage",
        expectedStatus: "generation_failed",
        fetchResult: { body: { data: [{ b64_json: invalidPngBase64 }] }, kind: "response" as const, status: 200 },
        storage: createStorage(createCalls()),
      },
      {
        expectedDiagnosticCode: "provider_fetch_failed",
        expectedFailureCategory: "provider_fetch",
        expectedStatus: "provider_unavailable",
        fetchResult: { kind: "network" as const },
        storage: createStorage(createCalls()),
      },
      {
        expectedDiagnosticCode: "provider_5xx",
        expectedFailureCategory: "provider_fetch",
        expectedStatus: "provider_unavailable",
        fetchResult: { body: { rawProviderBody: providerRawBody }, kind: "response" as const, status: 500 },
        storage: createStorage(createCalls()),
      },
      {
        expectedDiagnosticCode: "real_provider_gate_missing",
        expectedFailureCategory: "runtime_gate",
        expectedStatus: "generation_execution_blocked",
        fetchResult: { body: { data: [{ b64_json: validPngBase64 }] }, kind: "response" as const, status: 200 },
        realSmokeEnabled: false,
        storage: createStorage(createCalls()),
      },
    ];

    for (const testCase of cases) {
      const app = await startGenerationApp({
        fetchResult: testCase.fetchResult,
        realSmokeEnabled: testCase.realSmokeEnabled,
        storage: testCase.useFailingStorage
          ? createStorage(createCalls())
          : testCase.storage,
      });

      try {
        const result = await postGenerationJob(app.baseUrl);

        expect(result.status).toBe(503);
        expect(result.body).toMatchObject({
          attemptedProviderIds:
            testCase.expectedDiagnosticCode === "real_provider_gate_missing"
              ? []
              : ["openai"],
          diagnosticCode: testCase.expectedDiagnosticCode,
          failureCategory: testCase.expectedFailureCategory,
          kind: "generation_job_rejected",
          status: testCase.expectedStatus,
        });
        expect(result.body.runtime.vendorCallsEnabled).toBe(
          testCase.expectedVendorCallsEnabled ??
            (testCase.expectedDiagnosticCode === "real_provider_gate_missing"
              ? false
              : true),
        );
        expectNoLeak(result.text);
      } finally {
        await stopServer(app.server);
      }
    }
  });

  test("manual non-2xx capture keeps sanitized fields and suppresses raw fallback bodies", () => {
    const responseText = JSON.stringify({
      attemptedProviderIds: ["openai"],
      diagnosticCode: "provider_missing_b64_json",
      failureCategory: "provider_response",
      kind: "generation_job_rejected",
      message: "Safe message only.",
      providerRawBody,
      runtime: {
        vendorCallsEnabled: true,
      },
      status: "artifact_storage_unavailable",
    });
    const captured = safeManualDiagnosticCapture(responseText);
    const fallback = safeManualDiagnosticCapture(providerRawBody);

    expect(captured).toEqual({
      attemptedProviderIds: ["openai"],
      diagnosticCode: "provider_missing_b64_json",
      failureCategory: "provider_response",
      kind: "generation_job_rejected",
      message: "Safe message only.",
      runtime: {
        vendorCallsEnabled: true,
      },
      status: "artifact_storage_unavailable",
    });
    expect(JSON.stringify(captured)).not.toContain(providerRawBody);
    expect(fallback).toEqual({
      kind: "generation_diagnostic_capture_unparseable_json",
      message:
        "Response body was not JSON; raw body intentionally not printed.",
    });
  });

  test("source boundaries remain backend-only and document safe diagnostic capture", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "backend/routes/generation.ts"),
      "utf8",
    );
    const adapterSource = readFileSync(
      path.join(process.cwd(), "backend/generation/openAiImageGenerationAdapter.ts"),
      "utf8",
    );
    const runbookSource = readFileSync(
      path.join(
        process.cwd(),
        "docs/real-openai-generation-diagnostic-capture-runbook.md",
      ),
      "utf8",
    );
    const frontendSource = [
      "src/services/sceneGenerationService.ts",
      "src/store/sceneStore.ts",
      "src/agents/sceneGenerationAgent.ts",
    ]
      .map((relativePath) =>
        readFileSync(path.join(process.cwd(), relativePath), "utf8"),
      )
      .join("\n");
    const packageJson = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const exportRoute = readFileSync(
      path.join(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    expect(routeSource).toContain("real_provider_local_only");
    expect(routeSource).toContain("diagnosticCode");
    expect(adapterSource).toContain("provider_missing_b64_json");
    expect(runbookSource).toContain("diagnosticCode");
    expect(runbookSource).toContain("Do not retry automatically");

    for (const forbidden of [
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "/generation/jobs",
      "fake_success",
      "fake_progress",
      "fake_artifact",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
    ]) {
      expect(packageJson).not.toContain(forbidden);
      expect(frontendSource).not.toContain(forbidden);
      if (
        forbidden !== "publicUrl" &&
        forbidden !== "signedUrl" &&
        forbidden !== "downloadUrl"
      ) {
        expect(exportRoute).not.toContain(forbidden);
      }
    }
  });
});
