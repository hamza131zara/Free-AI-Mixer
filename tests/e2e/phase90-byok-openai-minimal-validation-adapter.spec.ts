import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";
import { createOpenAiProviderValidationAdapter } from "../../backend/providers/openAiProviderValidationAdapter";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import {
  parseByokProviderValidationAdapterSelection,
  parseByokProviderValidationRuntimeGate,
} from "../../backend/providers/providerSecretVaultConfig";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const projectRoot = process.cwd();
const rawProviderKey = "FAKE_PHASE90_OPENAI_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE90_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE90_SECRET_REF_DO_NOT_RETURN";
const jwtLike = "phase90.header.payload";
const serviceRoleLike = "supabase_service_role_PHASE90_DO_NOT_STORE";
const encryptionKeyLike = Buffer.alloc(32).toString("base64");
const providerResponseBody = "FAKE_PHASE90_PROVIDER_BODY_DO_NOT_RETURN";
const providerRequestId = "req_phase90_do_not_return";
const providerAccountMetadata = "org_phase90_do_not_return";
const modelName = "gpt-phase90-do-not-return";

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const withEnv = <Result>(
  values: Record<string, string | undefined>,
  callback: () => Result,
): Result => {
  const previousValues = new Map<string, string | undefined>();

  for (const key of Object.keys(values)) {
    previousValues.set(key, process.env[key]);
    const value = values[key];

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }

      process.env[key] = value;
    }
  }
};

const validationEnvKeys = {
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: undefined,
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ALLOW_REAL_PROVIDER_CALLS: undefined,
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: undefined,
};

const validOpenAiCompositionEnv = {
  FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1: encryptionKeyLike,
  FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_VERSION: "v1",
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: "openai_minimal",
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ALLOW_REAL_PROVIDER_CALLS: "1",
  FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
  FREE_AI_MIXER_BYOK_VAULT_ENABLED: "1",
  FREE_AI_MIXER_BYOK_VAULT_PROVIDER: "local_encrypted_payload",
  FREE_AI_MIXER_DB_PROVIDER: "supabase",
  FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
  FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "phase90_backend_only_service_role_placeholder",
  FREE_AI_MIXER_SUPABASE_URL: "https://phase90.supabase.co",
};

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
    modelName,
    "encrypted_payload",
    "secret_ref",
    "Authorization",
    "x-request-id",
    "organization",
    "account",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

class Phase90ProviderKeyRepository implements BackendProviderKeyRepository {
  constructor(
    private readonly options: {
      providerName?: BackendProviderKeyRecord["providerName"];
      status?: BackendProviderKeyRecord["status"];
      workspaceId?: string;
    } = {},
  ) {}

  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    return {
      providerKeyId,
      providerName: this.options.providerName ?? "openai",
      workspaceId: this.options.workspaceId ?? "phase90-workspace",
      ownerId: "phase90-owner",
      createdByUserId: "phase90-owner",
      encryptedSecret: {
        algorithm: "AES-256-GCM",
        encryptedPayload,
        keyVersion: "v1",
      },
      status: this.options.status ?? "active",
      verificationStatus: "not_validated",
      needsReverification: true,
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
      message: "Not used by Phase 90 tests.",
    };
  }

  async replaceProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 90 tests.",
    };
  }

  async revokeProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 90 tests.",
    };
  }

  async updateProviderKeyValidationState(
    _input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    return {
      kind: "validation_state_unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by Phase 90 tests.",
    };
  }
}

const createReadyVault = (): ProviderSecretVault => ({
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 90 tests.",
  }),
  decryptProviderKey: async () => ({
    kind: "vault_provider_key_decrypted",
    status: "decrypted",
    plaintextKey: rawProviderKey,
  }),
  storeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 90 tests.",
  }),
  revokeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 90 tests.",
  }),
  rotateProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by Phase 90 tests.",
  }),
});

const createFetchForStatus = (
  status: number,
): typeof fetch =>
  (async (_input: RequestInfo | URL, init?: RequestInit) => {
    expect(_input.toString()).toBe("https://api.openai.com/v1/models");
    expect(init?.method).toBe("GET");
    expect(JSON.stringify(init?.body ?? "")).not.toContain(rawProviderKey);
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${rawProviderKey}`,
    );

    return {
      headers: new Headers({
        "x-request-id": providerRequestId,
      }),
      json: async () => ({
        data: [{ id: modelName }],
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

const validateWithStatus = async (status: number) =>
  createOpenAiProviderValidationAdapter({
    fetchImpl: createFetchForStatus(status),
    now: () => "2026-06-03T00:00:00.000Z",
    providerKeyRepository: new Phase90ProviderKeyRepository(),
    providerSecretVault: createReadyVault(),
    timeoutMs: 10,
  }).validateStoredProviderKey({
    providerId: "openai",
    providerKeyId: "phase90-provider-key",
    requesterUserId: "phase90-user",
    workspaceId: "phase90-workspace",
  });

test.describe("phase90 BYOK OpenAI minimal validation adapter", () => {
  test("composition remains fail-closed unless all OpenAI real-call gates are present", async () => {
    withEnv(validationEnvKeys, () => {
      const dependencies = createBackendDependencies();

      expect(dependencies.byokProviderValidationRuntimeGate.enabled).toBe(false);
      expect(dependencies.byokProviderValidationAdapterSelection).toEqual({
        kind: "byok_provider_validation_adapter_selection",
        adapter: "not_configured",
        allowRealProviderCalls: false,
      });
      expect(dependencies.providerValidationAdapter.getReadiness().kind).toBe(
        "validation_unavailable",
      );
    });

    withEnv(
      {
        ...validationEnvKeys,
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
      },
      () => {
        expect(createBackendDependencies().providerValidationAdapter.getReadiness().kind).toBe(
          "validation_unavailable",
        );
      },
    );

    withEnv(
      {
        ...validationEnvKeys,
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: "openai_minimal",
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
      },
      () => {
        const selection = parseByokProviderValidationAdapterSelection(process.env);

        expect(selection).toEqual({
          kind: "byok_provider_validation_adapter_selection",
          adapter: "not_configured",
          allowRealProviderCalls: false,
        });
        expect(createBackendDependencies().providerValidationAdapter.getReadiness().kind).toBe(
          "validation_unavailable",
        );
      },
    );

    await withEnv(validOpenAiCompositionEnv, async () => {
      expect(
        parseByokProviderValidationRuntimeGate(process.env),
      ).toEqual({
        kind: "byok_provider_validation_runtime_gate",
        enabled: true,
      });
      expect(
        parseByokProviderValidationAdapterSelection(process.env),
      ).toEqual({
        kind: "byok_provider_validation_adapter_selection",
        adapter: "openai_minimal",
        allowRealProviderCalls: true,
      });
      expect(createBackendDependencies().providerValidationAdapter.getReadiness()).toEqual({
        kind: "validation_ready",
      });
    });
  });

  test("mock local composition remains unchanged", async () => {
    await withEnv(
      {
        ...validationEnvKeys,
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER: "mock_local",
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ALLOW_REAL_PROVIDER_CALLS: undefined,
        FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED: "1",
      },
      async () => {
        const dependencies = createBackendDependencies();
        const result =
          await dependencies.providerValidationAdapter.validateStoredProviderKey({
            providerId: "openai",
            providerKeyId: "phase90-provider-key",
            requesterUserId: "phase90-user",
            workspaceId: "phase90-workspace",
          });

        expect(dependencies.byokProviderValidationAdapterSelection).toEqual({
          kind: "byok_provider_validation_adapter_selection",
          adapter: "mock_local",
          allowRealProviderCalls: false,
        });
        expect(result.kind).toBe("validated");
        expect(result.message).toBe(
          "Provider key validation completed by local mock adapter.",
        );
      },
    );
  });

  test("OpenAI adapter maps mocked provider statuses to safe validation results", async () => {
    const success = await validateWithStatus(200);
    const unauthorized = await validateWithStatus(401);
    const forbidden = await validateWithStatus(403);
    const rateLimited = await validateWithStatus(429);
    const serverFailure = await validateWithStatus(500);
    const unknownFailure = await validateWithStatus(418);

    expect(success).toEqual({
      kind: "validated",
      status: "validated",
      verifiedAt: "2026-06-03T00:00:00.000Z",
      message: "OpenAI provider key was validated by backend.",
    });
    expect(unauthorized).toMatchObject({
      kind: "validation_failed",
      status: "validation_failed",
      errorCode: "invalid_credentials",
    });
    expect(forbidden).toMatchObject({
      kind: "validation_failed",
      status: "validation_failed",
      errorCode: "invalid_credentials",
    });
    expect(rateLimited).toMatchObject({
      kind: "rate_limited",
      status: "rate_limited",
      errorCode: "rate_limited",
    });
    expect(serverFailure).toMatchObject({
      kind: "provider_unavailable",
      status: "provider_unavailable",
      errorCode: "provider_unavailable",
    });
    expect(unknownFailure).toMatchObject({
      kind: "validation_failed",
      status: "validation_failed",
      errorCode: "validation_failed",
    });

    for (const result of [
      success,
      unauthorized,
      forbidden,
      rateLimited,
      serverFailure,
      unknownFailure,
    ]) {
      expectNoSecretLeak(JSON.stringify(result));
    }
  });

  test("OpenAI adapter maps timeout, network, unsupported provider, key lookup, and decrypt failures safely", async () => {
    const timeout = await createOpenAiProviderValidationAdapter({
      fetchImpl: createTimedOutFetch(),
      providerKeyRepository: new Phase90ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
      timeoutMs: 1,
    }).validateStoredProviderKey({
      providerId: "openai",
      providerKeyId: "phase90-provider-key",
      requesterUserId: "phase90-user",
      workspaceId: "phase90-workspace",
    });

    const network = await createOpenAiProviderValidationAdapter({
      fetchImpl: (async () => {
        throw new Error("network unavailable");
      }) as typeof fetch,
      providerKeyRepository: new Phase90ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
    }).validateStoredProviderKey({
      providerId: "openai",
      providerKeyId: "phase90-provider-key",
      requesterUserId: "phase90-user",
      workspaceId: "phase90-workspace",
    });

    const unsupported = await createOpenAiProviderValidationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase90ProviderKeyRepository(),
      providerSecretVault: createReadyVault(),
    }).validateStoredProviderKey({
      providerId: "replicate",
      providerKeyId: "phase90-provider-key",
      requesterUserId: "phase90-user",
      workspaceId: "phase90-workspace",
    });

    const keyNotFound = await createOpenAiProviderValidationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase90ProviderKeyRepository({
        workspaceId: "other-workspace",
      }),
      providerSecretVault: createReadyVault(),
    }).validateStoredProviderKey({
      providerId: "openai",
      providerKeyId: "phase90-provider-key",
      requesterUserId: "phase90-user",
      workspaceId: "phase90-workspace",
    });

    const decryptFailedVault: ProviderSecretVault = {
      ...createReadyVault(),
      decryptProviderKey: async () => ({
        kind: "vault_decrypt_failed",
        status: "decrypt_failed",
        message: "Do not return raw crypto details.",
      }),
    };
    const decryptFailed = await createOpenAiProviderValidationAdapter({
      fetchImpl: createFetchForStatus(200),
      providerKeyRepository: new Phase90ProviderKeyRepository(),
      providerSecretVault: decryptFailedVault,
    }).validateStoredProviderKey({
      providerId: "openai",
      providerKeyId: "phase90-provider-key",
      requesterUserId: "phase90-user",
      workspaceId: "phase90-workspace",
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
    expect(keyNotFound).toMatchObject({
      kind: "key_not_found",
      errorCode: "key_not_found",
    });
    expect(decryptFailed).toMatchObject({
      kind: "vault_decrypt_failed",
      errorCode: "vault_decrypt_failed",
    });

    for (const result of [
      timeout,
      network,
      unsupported,
      keyNotFound,
      decryptFailed,
    ]) {
      expectNoSecretLeak(JSON.stringify(result));
    }
  });

  test("source boundaries avoid SDKs generation endpoints frontend changes and unrelated runtime expansion", () => {
    const adapterSource = readSource(
      "backend/providers/openAiProviderValidationAdapter.ts",
    );
    const dependencySource = readSource("backend/composition/backendDependencies.ts");
    const configSource = readSource("backend/providers/providerSecretVaultConfig.ts");
    const routeSource = readSource("backend/routes/providerSettings.ts");
    const packageJson = readSource("package.json");
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsService = readSource("src/services/providerSettingsService.ts");
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const billingService = readSource("src/services/billingService.ts");
    const generationService = readSource("src/services/sceneGenerationService.ts");
    const backendBoundary = [
      adapterSource,
      dependencySource,
      configSource,
      routeSource,
    ].join("\n");

    expect(adapterSource).toContain("https://api.openai.com/v1/models");
    expect(adapterSource).toContain("fetchImpl");
    expect(adapterSource).toContain("AbortController");
    expect(configSource).toContain(
      "FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ALLOW_REAL_PROVIDER_CALLS",
    );
    expect(dependencySource).toContain("createOpenAiProviderValidationAdapter");
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
      "/v1/threads",
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
      expect(providerSettingsService).not.toContain(forbidden);
    }

    expect(`${creditsPage}\n${billingService}`).not.toMatch(
      /getFreeCredits|requestFreeCredits|get-free-credits|checkoutEnabled|recordLedger|mutateLedger/i,
    );
    expect(generationService).not.toContain("/provider-settings/connections");
  });
});

