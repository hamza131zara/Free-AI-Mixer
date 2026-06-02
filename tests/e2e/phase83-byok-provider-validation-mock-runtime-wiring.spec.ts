import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import { createMockProviderValidationAdapter } from "../../backend/providers/mockProviderValidationAdapter";
import { createNotConfiguredProviderValidationAdapter } from "../../backend/providers/notConfiguredProviderValidationAdapter";
import type { ProviderValidationAdapter } from "../../backend/providers/providerValidationAdapter";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyStorageResult,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const rawProviderKey = "FAKE_PHASE83_PROVIDER_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE83_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE83_SECRET_REF_DO_NOT_RETURN";
const providerAccountMetadata =
  "FAKE_PHASE83_PROVIDER_ACCOUNT_METADATA_DO_NOT_RETURN";
const tokenLike = "phase83.header.payload";
const serviceRoleLike = "supabase_service_role_PHASE83_DO_NOT_STORE";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

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
    providerAccountMetadata,
    tokenLike,
    serviceRoleLike,
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerAccountMetadata",
    "provider_account_metadata",
    "service_role",
    "provider_raw_error",
    "connected_success",
    "verified_success",
    "test_passed",
    "fake_success",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const createMembershipRepository = (
  role: "owner" | "admin" | "member" | "viewer",
): WorkspaceMembershipRepository => ({
  getMembership: async ({ userId, workspaceId }) => ({
    kind: "member",
    membership: {
      role,
      source: "workspace_memberships",
      status: "active",
      userId,
      workspaceId,
    },
  }),
});

const readyVault: ProviderSecretVault = {
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by validation tests.",
  }),
  decryptProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by validation tests.",
  }),
  storeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by validation tests.",
  }),
  revokeProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by validation tests.",
  }),
  rotateProviderKey: async () => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by validation tests.",
  }),
};

class ValidationRuntimeRepository implements BackendProviderKeyRepository {
  readonly validationUpdates: BackendProviderKeyValidationStateInput[] = [];

  constructor(private readonly options: { hasActiveKey?: boolean } = {}) {}

  async getByProviderKeyId(): Promise<BackendProviderKeyRecord | undefined> {
    return undefined;
  }

  async listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]> {
    if (this.options.hasActiveKey === false) {
      return [];
    }

    return [
      {
        providerKeyId: "phase83-provider-key",
        providerName: "openai",
        workspaceId,
        ownerId: "phase83-owner",
        createdByUserId: "phase83-owner",
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
      message: "Not used by validation tests.",
    };
  }

  async replaceProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by validation tests.",
    };
  }

  async revokeProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "unavailable",
      status: "unavailable",
      code: "repository_unavailable",
      message: "Not used by validation tests.",
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
        status: "not_connected",
        maskedKeySummary: "Provider key validation state updated server-side.",
        maskedFingerprint: "provider-key:y-key",
        keyFingerprintSuffix: "y-key",
        verificationStatus: input.verificationStatus,
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

const startProviderSettingsApp = async (options: {
  providerKeyRepository?: BackendProviderKeyRepository;
  providerValidationAdapter?: ProviderValidationAdapter;
  providerKeysRuntimeEnabled?: boolean;
  providerValidationRuntimeEnabled?: boolean;
  requester?: "authenticated" | "unauthenticated";
  role?: "owner" | "admin" | "member" | "viewer";
}): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());

  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext =
      options.requester === "unauthenticated"
        ? {
            kind: "unauthenticated",
            reason: "missing_credentials",
          }
        : {
            authProvider: "session",
            authSubject: "phase83-subject",
            kind: "authenticated",
            userId: "phase83-owner",
            workspaceId: "phase83-workspace",
          };
    next();
  });

  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository: createMembershipRepository(
        options.role ?? "owner",
      ),
      providerKeyRepository: options.providerKeyRepository,
      providerKeysRuntimeEnabled: options.providerKeysRuntimeEnabled,
      providerSecretVault: readyVault,
      providerValidationAdapter: options.providerValidationAdapter,
      providerValidationRuntimeEnabled:
        options.providerValidationRuntimeEnabled,
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
): Promise<{ status: number; text: string }> => {
  const response = await fetch(
    `${baseUrl}/provider-settings/connections/openai/test`,
    {
      body: JSON.stringify({
        apiKey: rawProviderKey,
        encryptedPayload,
        providerAccountMetadata,
        providerCredential: providerAccountMetadata,
        secretRef,
        serviceRoleKey: serviceRoleLike,
        token: tokenLike,
      }),
      headers: {
        authorization: `Bearer ${tokenLike}`,
        "content-type": "application/json",
      },
      method: "POST",
    },
  );

  return {
    status: response.status,
    text: await response.text(),
  };
};

test.describe("phase83 BYOK provider validation mock runtime wiring", () => {
  test("test route remains unavailable by default and when validation gate is off", async () => {
    const cases = [
      {
        expected: "secure_provider_key_storage_not_enabled",
        options: {},
      },
      {
        expected: "validation_unavailable",
        options: {
          providerKeyRepository: new ValidationRuntimeRepository(),
          providerKeysRuntimeEnabled: true,
          providerValidationAdapter: createMockProviderValidationAdapter(),
          providerValidationRuntimeEnabled: false,
        },
      },
      {
        expected: "validation_unavailable",
        options: {
          providerKeyRepository: new ValidationRuntimeRepository(),
          providerKeysRuntimeEnabled: true,
          providerValidationAdapter: createNotConfiguredProviderValidationAdapter(),
          providerValidationRuntimeEnabled: true,
        },
      },
    ];

    for (const testCase of cases) {
      const { baseUrl, server } = await startProviderSettingsApp(testCase.options);

      try {
        const result = await sendValidationRequest(baseUrl);

        expect(result.status).toBe(503);
        expect(result.text).toContain(testCase.expected);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("owner and admin can validate through injected mock adapter using stored key reference only", async () => {
    for (const role of ["owner", "admin"] as const) {
      const repository = new ValidationRuntimeRepository();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerKeysRuntimeEnabled: true,
        providerValidationAdapter: createMockProviderValidationAdapter({
          now: () => "2026-06-02T00:00:00.000Z",
        }),
        providerValidationRuntimeEnabled: true,
        role,
      });

      try {
        const result = await sendValidationRequest(baseUrl);

        expect(result.status).toBe(200);
        expect(result.text).toContain(
          "provider_settings_connection_validation_result",
        );
        expect(result.text).toContain('"status":"validated"');
        expect(repository.validationUpdates).toEqual([
          {
            providerKeyId: "phase83-provider-key",
            workspaceId: "phase83-workspace",
            requesterUserId: "phase83-owner",
            verificationStatus: "validated",
            lastVerifiedAt: "2026-06-02T00:00:00.000Z",
            lastVerificationErrorCode: undefined,
            needsReverification: false,
          },
        ]);
        expectNoSecretLeak(result.text);
        expectNoSecretLeak(JSON.stringify(repository.validationUpdates));
      } finally {
        await stopServer(server);
      }
    }
  });

  test("member, viewer, and unauthenticated requesters are blocked before mock validation", async () => {
    const cases = [
      { requester: "authenticated" as const, role: "member" as const, status: 403 },
      { requester: "authenticated" as const, role: "viewer" as const, status: 403 },
      { requester: "unauthenticated" as const, role: "owner" as const, status: 401 },
    ];

    for (const testCase of cases) {
      const repository = new ValidationRuntimeRepository();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerKeysRuntimeEnabled: true,
        providerValidationAdapter: createMockProviderValidationAdapter(),
        providerValidationRuntimeEnabled: true,
        requester: testCase.requester,
        role: testCase.role,
      });

      try {
        const result = await sendValidationRequest(baseUrl);

        expect(result.status).toBe(testCase.status);
        expect(repository.validationUpdates).toHaveLength(0);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("active stored key lookup is required and request raw key is never echoed", async () => {
    const repository = new ValidationRuntimeRepository({ hasActiveKey: false });
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerKeysRuntimeEnabled: true,
      providerValidationAdapter: createMockProviderValidationAdapter(),
      providerValidationRuntimeEnabled: true,
    });

    try {
      const result = await sendValidationRequest(baseUrl);

      expect(result.status).toBe(404);
      expect(result.text).toContain("provider_settings_connection_not_found");
      expect(repository.validationUpdates).toHaveLength(0);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("mock validation failures update only safe sanitized validation state", async () => {
    const repository = new ValidationRuntimeRepository();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerKeysRuntimeEnabled: true,
      providerValidationAdapter: createMockProviderValidationAdapter({
        outcomeByProviderId: {
          openai: "validation_failed",
        },
      }),
      providerValidationRuntimeEnabled: true,
    });

    try {
      const result = await sendValidationRequest(baseUrl);

      expect(result.status).toBe(200);
      expect(result.text).toContain('"status":"validation_failed"');
      expect(repository.validationUpdates).toEqual([
        {
          providerKeyId: "phase83-provider-key",
          workspaceId: "phase83-workspace",
          requesterUserId: "phase83-owner",
          verificationStatus: "validation_failed",
          lastVerificationErrorCode: "invalid_credentials",
          needsReverification: true,
        },
      ]);
      expectNoSecretLeak(result.text);
      expectNoSecretLeak(JSON.stringify(repository.validationUpdates));
    } finally {
      await stopServer(server);
    }
  });

  test("timeout, rate limit, and vault decrypt failures map to redacted safe responses", async () => {
    const cases = [
      { outcome: "timeout" as const, status: 504, text: '"status":"timeout"' },
      {
        outcome: "rate_limited" as const,
        status: 429,
        text: '"status":"rate_limited"',
      },
      {
        outcome: "vault_decrypt_failed" as const,
        status: 503,
        text: '"status":"vault_decrypt_failed"',
      },
    ];

    for (const testCase of cases) {
      const repository = new ValidationRuntimeRepository();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerKeysRuntimeEnabled: true,
        providerValidationAdapter: createMockProviderValidationAdapter({
          outcomeByProviderId: {
            openai: testCase.outcome,
          },
        }),
        providerValidationRuntimeEnabled: true,
      });

      try {
        const result = await sendValidationRequest(baseUrl);

        expect(result.status).toBe(testCase.status);
        expect(result.text).toContain(testCase.text);
        expect(repository.validationUpdates).toHaveLength(0);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("source boundaries contain no provider SDK calls, external fetch, or frontend activation", async () => {
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const adapterSource = await readSource(
      "backend/providers/mockProviderValidationAdapter.ts",
    );
    const appSource = await readSource("backend/app.ts");
    const dependencySource = await readSource(
      "backend/composition/backendDependencies.ts",
    );
    const configSource = await readSource(
      "backend/providers/providerSecretVaultConfig.ts",
    );
    const packageJson = await readSource("package.json");
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const validationBoundary = [
      routeSource,
      adapterSource,
      appSource,
      dependencySource,
      configSource,
    ].join("\n");

    expect(validationBoundary).toContain(
      "FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED",
    );
    expect(routeSource).toContain("validateStoredProviderKey");
    expect(routeSource).toContain("updateProviderKeyValidationState");
    expect(adapterSource).toContain("createMockProviderValidationAdapter");
    expect(providerSettingsPage).toContain("Test connection unavailable");

    for (const forbidden of [
      "api.openai.com",
      "replicate.com",
      "runwayml",
      "api.runway",
      "lumalabs.ai",
      "api.luma",
      "generativelanguage.googleapis.com",
      "@openai/",
      "@replicate/",
      "@runway",
      "@luma",
      'fetch("https://',
      "fetch(`https://",
      "connected_success",
      "verified_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(validationBoundary).not.toContain(forbidden);
      expect(providerSettingsPage).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }
  });
});
