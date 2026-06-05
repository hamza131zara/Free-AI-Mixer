import { expect, test } from "@playwright/test";
import express from "express";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import { createNotConfiguredProviderValidationAdapter } from "../../backend/providers/notConfiguredProviderValidationAdapter";
import { createOpenAiProviderValidationAdapter } from "../../backend/providers/openAiProviderValidationAdapter";
import type { ProviderValidationAdapter } from "../../backend/providers/providerValidationAdapter";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const rawProviderKey = "FAKE_PHASE129_OPENAI_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE129_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE129_SECRET_REF_DO_NOT_RETURN";
const jwtLike = "phase129.header.payload";
const serviceRoleLike = "supabase_service_role_PHASE129_DO_NOT_STORE";
const providerBody = "FAKE_PHASE129_PROVIDER_BODY_DO_NOT_RETURN";
const providerHeader = "x-request-id";
const providerRequestId = "req_phase129_do_not_return";
const providerAccountMetadata = "org_phase129_do_not_return";
const providerModelMetadata = "gpt-phase129-do-not-return";
const encryptionKeyLike = Buffer.alloc(32).toString("base64");

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const readSource = (relativePath: string): string =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

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

const expectNoSecretLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    jwtLike,
    serviceRoleLike,
    providerBody,
    providerHeader,
    providerRequestId,
    providerAccountMetadata,
    providerModelMetadata,
    encryptionKeyLike,
    "Authorization",
    "Bearer ",
    "account",
    "organization",
    "encrypted_payload",
    "secret_ref",
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerRawError",
    "provider_raw_error",
    "service_role",
    "test_passed",
    "verified_success",
    "connected_success",
    "fake_success",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const createMembershipRepository = (): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => ({
    kind: "member",
    membership: {
      role: "owner",
      source: "workspace_memberships",
      status: "active",
      userId,
      workspaceId,
    },
  }),
});

class Phase129ProviderKeyRepository implements BackendProviderKeyRepository {
  readonly validationUpdates: BackendProviderKeyValidationStateInput[] = [];
  getByProviderKeyIdCalls = 0;
  listForWorkspaceCalls = 0;

  constructor(private readonly options: { hasActiveKey?: boolean } = {}) {}

  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    this.getByProviderKeyIdCalls += 1;

    return {
      providerKeyId,
      providerName: "openai",
      workspaceId: "phase129-workspace",
      ownerId: "phase129-owner",
      createdByUserId: "phase129-owner",
      encryptedSecret: {
        algorithm: "AES-256-GCM",
        encryptedPayload,
        keyVersion: "v1",
      },
      status: "active",
      verificationStatus: "not_validated",
      needsReverification: true,
    };
  }

  async listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]> {
    this.listForWorkspaceCalls += 1;

    if (this.options.hasActiveKey === false) {
      return [];
    }

    return [
      {
        providerKeyId: "phase129-provider-key",
        providerName: "openai",
        workspaceId,
        ownerId: "phase129-owner",
        createdByUserId: "phase129-owner",
        encryptedSecret: {
          algorithm: "AES-256-GCM",
          encryptedPayload,
          keyVersion: "v1",
        },
        status: "active",
        verificationStatus: "not_validated",
        needsReverification: true,
      },
    ];
  }

  async createProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 129 tests.",
    };
  }

  async replaceProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 129 tests.",
    };
  }

  async revokeProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 129 tests.",
    };
  }

  async updateProviderKeyValidationState(
    input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    this.validationUpdates.push(input);

    return {
      kind: "validation_state_updated",
      status: "updated",
      connection: {
        providerId: "openai",
        status: "stored",
        maskedKeySummary: "Stored server-side, not validated yet.",
        maskedFingerprint: "provider-key:y129",
        keyFingerprintSuffix: "y129",
        verificationStatus:
          input.verificationStatus === "validated"
            ? "validated"
            : "validation_failed",
        lastValidationStatus:
          input.verificationStatus === "validated"
            ? "validated"
            : "validation_failed",
        needsReverification: input.needsReverification,
        canManage: true,
      },
    };
  }
}

const createReadyVault = (options: { decryptFails?: boolean } = {}) => {
  const calls = {
    decrypt: 0,
  };
  const vault: ProviderSecretVault = {
    getVaultReadiness: () => ({ kind: "vault_ready" }),
    encryptProviderKey: async () => ({
      kind: "vault_operation_unavailable",
      status: "not_configured",
      message: "Not used by Phase 129 tests.",
    }),
    decryptProviderKey: async () => {
      calls.decrypt += 1;

      if (options.decryptFails) {
        return {
          kind: "vault_decrypt_failed",
          status: "decrypt_failed",
          message: "Stored key could not be decrypted safely.",
        };
      }

      return {
        kind: "vault_provider_key_decrypted",
        status: "decrypted",
        plaintextKey: rawProviderKey,
      };
    },
    storeProviderKey: async () => ({
      kind: "vault_operation_unavailable",
      status: "not_configured",
      message: "Not used by Phase 129 tests.",
    }),
    revokeProviderKey: async () => ({
      kind: "vault_operation_unavailable",
      status: "not_configured",
      message: "Not used by Phase 129 tests.",
    }),
    rotateProviderKey: async () => ({
      kind: "vault_operation_unavailable",
      status: "not_configured",
      message: "Not used by Phase 129 tests.",
    }),
  };

  return { calls, vault };
};

const createFetchForStatus = (status: number, calls: { fetch: number }) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.fetch += 1;
    expect(input.toString()).toBe("https://api.openai.com/v1/models");
    expect(init?.method).toBe("GET");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${rawProviderKey}`,
    );

    return {
      headers: new Headers({
        [providerHeader]: providerRequestId,
      }),
      json: async () => ({
        data: [{ id: providerModelMetadata }],
        organization: providerAccountMetadata,
      }),
      status,
      text: async () => providerBody,
    } as Response;
  }) as typeof fetch;

const createNetworkFailureFetch = (calls: { fetch: number }) =>
  (async () => {
    calls.fetch += 1;
    throw new Error("network failure with unsafe provider details");
  }) as typeof fetch;

const createTimedOutFetch = (calls: { fetch: number }) =>
  ((_input: RequestInfo | URL, init?: RequestInit) => {
    calls.fetch += 1;

    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("provider request aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  }) as typeof fetch;

const startProviderSettingsApp = async (options: {
  providerKeyRepository?: Phase129ProviderKeyRepository;
  providerSecretVault?: ProviderSecretVault;
  providerValidationAdapter: ProviderValidationAdapter;
  providerValidationRuntimeEnabled?: boolean;
}): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      authProvider: "session",
      authSubject: "phase129-subject",
      kind: "authenticated",
      userId: "phase129-owner",
      workspaceId: "phase129-workspace",
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository: createMembershipRepository(),
      providerKeyRepository:
        options.providerKeyRepository ?? new Phase129ProviderKeyRepository(),
      providerKeysRuntimeEnabled: true,
      providerSecretVault: options.providerSecretVault ?? createReadyVault().vault,
      providerValidationAdapter: options.providerValidationAdapter,
      providerValidationRuntimeEnabled:
        options.providerValidationRuntimeEnabled ?? true,
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
};

const sendValidationRequest = async (
  baseUrl: string,
): Promise<{ body: unknown; status: number; text: string }> => {
  const response = await fetch(
    `${baseUrl}/provider-settings/connections/openai/test`,
    {
      body: JSON.stringify({
        apiKey: rawProviderKey,
        encryptedPayload,
        providerCredential: providerAccountMetadata,
        providerRawError: providerBody,
        secretRef,
        serviceRoleKey: serviceRoleLike,
        token: jwtLike,
      }),
      headers: {
        authorization: `Bearer ${jwtLike}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );
  const text = await response.text();

  return {
    body: JSON.parse(text),
    status: response.status,
    text,
  };
};

const createOpenAiAdapterForFetch = (
  fetchImpl: typeof fetch,
  repository: Phase129ProviderKeyRepository,
  vault: ProviderSecretVault,
) =>
  createOpenAiProviderValidationAdapter({
    fetchImpl,
    providerKeyRepository: repository,
    providerSecretVault: vault,
    timeoutMs: 1,
  });

test.describe("phase129 BYOK OpenAI validation safe diagnostics", () => {
  test("mocked timeout returns HTTP 504 with safe enum diagnostics", async () => {
    const repository = new Phase129ProviderKeyRepository();
    const { calls, vault } = createReadyVault();
    const fetchCalls = { fetch: 0 };
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerSecretVault: vault,
      providerValidationAdapter: createOpenAiAdapterForFetch(
        createTimedOutFetch(fetchCalls),
        repository,
        vault,
      ),
    });

    try {
      const result = await sendValidationRequest(baseUrl);

      expect(result.status).toBe(504);
      expect(result.body).toMatchObject({
        diagnosticCode: "validation_timeout",
        failureCategory: "provider_timeout",
        kind: "provider_settings_connection_validation_result",
        status: "timeout",
      });
      expect(calls.decrypt).toBe(1);
      expect(fetchCalls.fetch).toBe(1);
      expect(repository.validationUpdates).toHaveLength(0);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("mocked provider failures map to sanitized validation diagnostics", async () => {
    const cases = [
      {
        diagnosticCode: "validation_provider_fetch_failed",
        expectedHttpStatus: 503,
        expectedStatus: "provider_unavailable",
        failureCategory: "provider_network",
        fetchFactory: createNetworkFailureFetch,
      },
      {
        diagnosticCode: "validation_provider_5xx",
        expectedHttpStatus: 503,
        expectedStatus: "provider_unavailable",
        failureCategory: "provider_response",
        fetchFactory: (calls: { fetch: number }) => createFetchForStatus(500, calls),
      },
      {
        diagnosticCode: "validation_provider_rate_limited",
        expectedHttpStatus: 429,
        expectedStatus: "rate_limited",
        failureCategory: "provider_response",
        fetchFactory: (calls: { fetch: number }) => createFetchForStatus(429, calls),
      },
      {
        diagnosticCode: "validation_invalid_credentials",
        expectedHttpStatus: 200,
        expectedStatus: "validation_failed",
        failureCategory: "provider_response",
        fetchFactory: (calls: { fetch: number }) => createFetchForStatus(401, calls),
      },
      {
        diagnosticCode: "validation_provider_unexpected_status",
        expectedHttpStatus: 200,
        expectedStatus: "validation_failed",
        failureCategory: "provider_response",
        fetchFactory: (calls: { fetch: number }) => createFetchForStatus(418, calls),
      },
    ];

    for (const testCase of cases) {
      const repository = new Phase129ProviderKeyRepository();
      const { calls, vault } = createReadyVault();
      const fetchCalls = { fetch: 0 };
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerSecretVault: vault,
        providerValidationAdapter: createOpenAiAdapterForFetch(
          testCase.fetchFactory(fetchCalls),
          repository,
          vault,
        ),
      });

      try {
        const result = await sendValidationRequest(baseUrl);

        expect(result.status).toBe(testCase.expectedHttpStatus);
        expect(result.body).toMatchObject({
          diagnosticCode: testCase.diagnosticCode,
          failureCategory: testCase.failureCategory,
          kind: "provider_settings_connection_validation_result",
          status: testCase.expectedStatus,
        });
        expect(calls.decrypt).toBe(1);
        expect(fetchCalls.fetch).toBe(1);
        expectNoSecretLeak(result.text);
        expectNoSecretLeak(JSON.stringify(repository.validationUpdates));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("missing stored key and disabled adapter fail before decrypt or fetch", async () => {
    const missingKeyRepository = new Phase129ProviderKeyRepository({
      hasActiveKey: false,
    });
    const missingKeyVault = createReadyVault();
    const missingKeyFetchCalls = { fetch: 0 };
    const missingKeyServer = await startProviderSettingsApp({
      providerKeyRepository: missingKeyRepository,
      providerSecretVault: missingKeyVault.vault,
      providerValidationAdapter: createOpenAiAdapterForFetch(
        createFetchForStatus(200, missingKeyFetchCalls),
        missingKeyRepository,
        missingKeyVault.vault,
      ),
    });

    try {
      const result = await sendValidationRequest(missingKeyServer.baseUrl);

      expect(result.status).toBe(404);
      expect(result.body).toMatchObject({
        diagnosticCode: "validation_key_not_found",
        failureCategory: "stored_key",
        kind: "provider_settings_connection_not_found",
        status: "not_found",
      });
      expect(missingKeyVault.calls.decrypt).toBe(0);
      expect(missingKeyFetchCalls.fetch).toBe(0);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(missingKeyServer.server);
    }

    const disabledRepository = new Phase129ProviderKeyRepository();
    const disabledVault = createReadyVault();
    const disabledServer = await startProviderSettingsApp({
      providerKeyRepository: disabledRepository,
      providerSecretVault: disabledVault.vault,
      providerValidationAdapter: createNotConfiguredProviderValidationAdapter(),
    });

    try {
      const result = await sendValidationRequest(disabledServer.baseUrl);

      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        diagnosticCode: "validation_adapter_not_ready",
        failureCategory: "runtime_gate",
        kind: "provider_settings_connection_validation_result",
        status: "validation_unavailable",
      });
      expect(disabledRepository.getByProviderKeyIdCalls).toBe(0);
      expect(disabledVault.calls.decrypt).toBe(0);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(disabledServer.server);
    }
  });

  test("vault decrypt failure maps safely and does not fetch provider", async () => {
    const repository = new Phase129ProviderKeyRepository();
    const { calls, vault } = createReadyVault({ decryptFails: true });
    const fetchCalls = { fetch: 0 };
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerSecretVault: vault,
      providerValidationAdapter: createOpenAiAdapterForFetch(
        createFetchForStatus(200, fetchCalls),
        repository,
        vault,
      ),
    });

    try {
      const result = await sendValidationRequest(baseUrl);

      expect(result.status).toBe(503);
      expect(result.body).toMatchObject({
        diagnosticCode: "validation_vault_decrypt_failed",
        failureCategory: "vault",
        kind: "provider_settings_connection_validation_result",
        status: "vault_decrypt_failed",
      });
      expect(calls.decrypt).toBe(1);
      expect(fetchCalls.fetch).toBe(0);
      expect(repository.validationUpdates).toHaveLength(0);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries avoid real calls SDKs frontend generation export and credits changes", () => {
    const adapterSource = readSource(
      "backend/providers/openAiProviderValidationAdapter.ts",
    );
    const validationContractSource = readSource(
      "backend/providers/providerValidationAdapter.ts",
    );
    const routeSource = readSource("backend/routes/providerSettings.ts");
    const generationRouteSource = readSource("backend/routes/generation.ts");
    const packageJson = readSource("package.json");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const exportRouteSource = readSource("backend/routes/exports.ts");
    const backendBoundary = [
      adapterSource,
      validationContractSource,
      routeSource,
    ].join("\n");

    expect(validationContractSource).toContain("ProviderValidationSafeDiagnosticCode");
    expect(routeSource).toContain("diagnosticCode");
    expect(adapterSource).toContain("validation_timeout");
    expect(adapterSource).toContain("fetchImpl");
    expect(adapterSource).not.toContain(providerBody);
    expect(generationRouteSource).toContain("generation");
    expect(providerSettingsPage).toContain("Validate stored key");

    for (const forbidden of [
      "openai.chat",
      "chat/completions",
      "/v1/chat",
      "/v1/responses",
      "/v1/images",
      "/v1/files",
      "/v1/audio",
      "/v1/videos",
      "/v1/uploads",
      "@openai/",
      "from \"openai\"",
      "from 'openai'",
      "new OpenAI",
      "connected_success",
      "verified_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(backendBoundary).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
      expect(providerSettingsPage).not.toContain(forbidden);
    }

    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(exportRouteSource).not.toContain("provider_settings_connection");
  });
});
