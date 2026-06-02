import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendSupportedProviderId,
  BackendRedactedProviderConnectionSummary,
} from "../../backend/contracts/providerSettingsHttpTypes";
import { createNotConfiguredProviderSecretVault } from "../../backend/providers/notConfiguredProviderSecretVault";
import type {
  ProviderSecretVault,
  ProviderSecretVaultOperationResult,
  ProviderSecretVaultReadiness,
  StoreProviderKeyInput,
  RotateProviderKeyInput,
  RevokeProviderKeyInput,
} from "../../backend/providers/providerSecretVault";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type {
  BackendProviderKeyCreateInput,
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyReplaceInput,
  BackendProviderKeyRevokeInput,
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";

const rawProviderKey = "FAKE_PHASE65_PROVIDER_KEY_DO_NOT_STORE";
const replacementProviderKey = "FAKE_PHASE65_REPLACEMENT_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE65_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const replacementEncryptedPayload =
  "FAKE_PHASE65_REPLACEMENT_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE65_SECRET_REF_DO_NOT_RETURN";
const providerRawError = "FAKE_PHASE65_PROVIDER_RAW_ERROR_DO_NOT_RETURN";
const serviceRoleLike = "supabase_service_role_PHASE65_DO_NOT_STORE";

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
    replacementProviderKey,
    encryptedPayload,
    replacementEncryptedPayload,
    secretRef,
    providerRawError,
    serviceRoleLike,
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerRawError",
    "provider_raw_error",
    "service_role",
    '"iv"',
    '"tag"',
    "ciphertext",
    "fake_success",
    "test_passed",
    "verified_success",
    "connected_success",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const toConnection = (
  providerId: BackendSupportedProviderId,
  suffix: string,
): BackendRedactedProviderConnectionSummary => ({
  providerId,
  status: "not_connected",
  maskedKeySummary: `Provider key metadata is stored server-side only; record ending ${suffix}.`,
  maskedFingerprint: `provider-key:${suffix}`,
  keyFingerprintSuffix: suffix,
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: true,
});

const createRecord = (
  overrides: Partial<BackendProviderKeyRecord> = {},
): BackendProviderKeyRecord => ({
  createdByUserId: "phase65-owner",
  ownerId: "phase65-owner",
  providerKeyId: "phase65-key-0001",
  providerName: "openai",
  status: "active",
  workspaceId: "phase65-workspace",
  ...overrides,
});

class InMemoryProviderKeyRepository implements BackendProviderKeyRepository {
  readonly calls: string[] = [];

  constructor(
    private readonly rows: BackendProviderKeyRecord[] = [],
    private readonly options: { conflictOnCreate?: boolean } = {},
  ) {}

  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    return this.rows.find((row) => row.providerKeyId === providerKeyId);
  }

  async listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]> {
    this.calls.push("listForWorkspace");
    return this.rows.filter((row) => row.workspaceId === workspaceId);
  }

  async createProviderKey(
    input: BackendProviderKeyCreateInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("createProviderKey");
    if (this.options.conflictOnCreate) {
      return {
        kind: "conflict",
        status: "conflict",
        code: "active_provider_key_exists",
        message: "An active provider key already exists for this workspace/provider.",
      };
    }

    const record = createRecord({
      providerKeyId: "phase65-key-created",
      providerName: input.providerId,
      workspaceId: input.workspaceId,
    });
    this.rows.push(record);

    return {
      kind: "stored",
      status: "stored",
      connection: toConnection(input.providerId, "ated"),
    };
  }

  async replaceProviderKey(
    input: BackendProviderKeyReplaceInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("replaceProviderKey");
    const existing = this.rows.find(
      (row) =>
        row.providerKeyId === input.providerKeyId &&
        row.workspaceId === input.workspaceId &&
        row.status === "active",
    );

    if (!existing) {
      return {
        kind: "unauthorized",
        status: "unauthorized",
        code: "workspace_permission_not_verified",
        message: "Active provider key record was not found for this workspace.",
      };
    }

    existing.status = "rotated";
    existing.rotatedAt = new Date().toISOString();
    this.rows.push(
      createRecord({
        providerKeyId: "phase65-key-replaced",
        providerName: input.providerId,
        workspaceId: input.workspaceId,
      }),
    );

    return {
      kind: "replaced",
      status: "replaced",
      connection: toConnection(input.providerId, "aced"),
    };
  }

  async revokeProviderKey(
    input: BackendProviderKeyRevokeInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("revokeProviderKey");
    const existing = this.rows.find(
      (row) =>
        row.providerKeyId === input.providerKeyId &&
        row.workspaceId === input.workspaceId &&
        row.status === "active",
    );

    if (!existing) {
      return {
        kind: "unauthorized",
        status: "unauthorized",
        code: "workspace_permission_not_verified",
        message: "Active provider key record was not found for this workspace.",
      };
    }

    existing.status = "disabled";
    existing.revokedAt = new Date().toISOString();

    return {
      kind: "revoked",
      status: "revoked",
      connection: {
        ...toConnection(existing.providerName as BackendSupportedProviderId, "oked"),
        maskedFingerprint: undefined,
        keyFingerprintSuffix: undefined,
        maskedKeySummary: "Provider key was revoked server-side.",
      },
    };
  }
}

class ReadyFakeVault implements ProviderSecretVault {
  readonly calls: string[] = [];

  getVaultReadiness(): ProviderSecretVaultReadiness {
    return { kind: "vault_ready" };
  }

  async encryptProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return this.storeResult("encrypted");
  }

  async decryptProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return {
      kind: "vault_decrypt_failed",
      status: "decrypt_failed",
      message: "Provider key could not be decrypted safely.",
    };
  }

  async storeProviderKey(
    input: StoreProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push(`store:${input.providerId}:${input.plaintextKey}`);
    return this.storeResult("stored");
  }

  async revokeProviderKey(
    input: RevokeProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push(`revoke:${input.providerKeyId}`);
    return {
      kind: "vault_provider_key_revoked",
      status: "revoked",
    };
  }

  async rotateProviderKey(
    input: RotateProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push(`rotate:${input.providerKeyId}:${input.replacementPlaintextKey}`);
    return {
      kind: "vault_provider_key_rotated",
      status: "replaced",
      secretHandle: {
        algorithm: "aes-256-gcm",
        encryptedPayload: replacementEncryptedPayload,
        keyVersion: "v1",
        kind: "encrypted_secret",
      },
      keyFingerprintSuffix: "aced",
      maskedFingerprint: "sha256:phase65replacement",
    };
  }

  private storeResult(
    status: "encrypted" | "stored",
  ): ProviderSecretVaultOperationResult {
    return {
      kind:
        status === "stored"
          ? "vault_provider_key_stored"
          : "vault_provider_key_encrypted",
      status,
      secretHandle: {
        algorithm: "aes-256-gcm",
        encryptedPayload,
        keyVersion: "v1",
        kind: "encrypted_secret",
      },
      keyFingerprintSuffix: "ated",
      maskedFingerprint: "sha256:phase65",
    };
  }
}

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

const startProviderSettingsApp = async (options: {
  providerKeyRepository?: BackendProviderKeyRepository;
  providerKeysRuntimeEnabled?: boolean;
  providerSecretVault?: ProviderSecretVault;
  role?: "owner" | "admin" | "member" | "viewer";
}): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      authProvider: "session",
      authSubject: "phase65-subject",
      kind: "authenticated",
      userId: "phase65-owner",
      workspaceId: "phase65-workspace",
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository: createMembershipRepository(options.role ?? "owner"),
      ...options,
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
};

const sendJson = async (
  baseUrl: string,
  method: "POST" | "PUT" | "DELETE",
  pathname: string,
  body: unknown = {},
): Promise<{ status: number; text: string }> => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    body: JSON.stringify({
      encryptedPayload,
      providerCredential: { accountId: "phase65-account" },
      providerRawError,
      secretRef,
      serviceRoleKey: serviceRoleLike,
      ...body,
    }),
    headers: { "content-type": "application/json" },
    method,
  });

  return { status: response.status, text: await response.text() };
};

test.describe("phase65 BYOK provider key route wiring", () => {
  test("gate off and missing dependencies keep mutations unavailable without reading key material", async () => {
    const cases = [
      {
        expected: "secure_provider_key_storage_not_enabled",
        options: {
          providerKeyRepository: new InMemoryProviderKeyRepository(),
          providerKeysRuntimeEnabled: false,
          providerSecretVault: new ReadyFakeVault(),
        },
      },
      {
        expected: "provider_key_repository_unavailable",
        options: {
          providerKeysRuntimeEnabled: true,
          providerSecretVault: new ReadyFakeVault(),
        },
      },
      {
        expected: "secure_provider_key_storage_not_enabled",
        options: {
          providerKeyRepository: new InMemoryProviderKeyRepository(),
          providerKeysRuntimeEnabled: true,
          providerSecretVault: createNotConfiguredProviderSecretVault(),
        },
      },
    ];

    for (const testCase of cases) {
      const { baseUrl, server } = await startProviderSettingsApp(testCase.options);
      try {
        const result = await sendJson(baseUrl, "POST", "/provider-settings/connections", {
          apiKey: rawProviderKey,
          providerId: "openai",
        });

        expect(result.status).toBe(503);
        expect(result.text).toContain(testCase.expected);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("owner and admin can create when gate vault and repository are available", async () => {
    for (const role of ["owner", "admin"] as const) {
      const vault = new ReadyFakeVault();
      const repository = new InMemoryProviderKeyRepository();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerKeysRuntimeEnabled: true,
        providerSecretVault: vault,
        role,
      });

      try {
        const result = await sendJson(baseUrl, "POST", "/provider-settings/connections", {
          apiKey: rawProviderKey,
          providerId: "openai",
        });

        expect(result.status).toBe(201);
        expect(result.text).toContain("provider_settings_connection_stored");
        expect(result.text).toContain("stored");
        expect(repository.calls).toContain("createProviderKey");
        expect(vault.calls).toContain(`store:openai:${rawProviderKey}`);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("member and viewer are blocked before vault or repository mutation", async () => {
    for (const role of ["member", "viewer"] as const) {
      const vault = new ReadyFakeVault();
      const repository = new InMemoryProviderKeyRepository();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerKeysRuntimeEnabled: true,
        providerSecretVault: vault,
        role,
      });

      try {
        const result = await sendJson(baseUrl, "POST", "/provider-settings/connections", {
          apiKey: rawProviderKey,
          providerId: "openai",
        });

        expect(result.status).toBe(403);
        expect(result.text).toContain("workspace_owner_or_admin_required");
        expect(vault.calls).toEqual([]);
        expect(repository.calls).toEqual([]);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("create conflict maps to 409 without leaking request or storage material", async () => {
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: new InMemoryProviderKeyRepository([], {
        conflictOnCreate: true,
      }),
      providerKeysRuntimeEnabled: true,
      providerSecretVault: new ReadyFakeVault(),
    });

    try {
      const result = await sendJson(baseUrl, "POST", "/provider-settings/connections", {
        apiKey: rawProviderKey,
        providerId: "openai",
      });

      expect(result.status).toBe(409);
      expect(result.text).toContain("provider_settings_mutation_conflict");
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("replace rotates active key and returns a redacted summary only", async () => {
    const repository = new InMemoryProviderKeyRepository([createRecord()]);
    const vault = new ReadyFakeVault();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerKeysRuntimeEnabled: true,
      providerSecretVault: vault,
    });

    try {
      const result = await sendJson(
        baseUrl,
        "PUT",
        "/provider-settings/connections/openai",
        { apiKey: replacementProviderKey },
      );

      expect(result.status).toBe(200);
      expect(result.text).toContain("provider_settings_connection_replaced");
      expect(repository.calls).toEqual(
        expect.arrayContaining(["listForWorkspace", "replaceProviderKey"]),
      );
      expect(vault.calls).toContain(
        `rotate:phase65-key-0001:${replacementProviderKey}`,
      );
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("revoke disables active key and returns a redacted summary only", async () => {
    const repository = new InMemoryProviderKeyRepository([createRecord()]);
    const vault = new ReadyFakeVault();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerKeysRuntimeEnabled: true,
      providerSecretVault: vault,
    });

    try {
      const result = await sendJson(
        baseUrl,
        "DELETE",
        "/provider-settings/connections/openai",
      );

      expect(result.status).toBe(200);
      expect(result.text).toContain("provider_settings_connection_revoked");
      expect(repository.calls).toEqual(
        expect.arrayContaining(["listForWorkspace", "revokeProviderKey"]),
      );
      expect(vault.calls).toContain("revoke:phase65-key-0001");
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("test connection remains unavailable and does not call provider APIs", async () => {
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: new InMemoryProviderKeyRepository([createRecord()]),
      providerKeysRuntimeEnabled: true,
      providerSecretVault: new ReadyFakeVault(),
    });

    try {
      const result = await sendJson(
        baseUrl,
        "POST",
        "/provider-settings/connections/openai/test",
        { apiKey: rawProviderKey },
      );

      expect(result.status).toBe(503);
      expect(result.text).toContain("secure_provider_key_storage_not_enabled");
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries keep frontend provider keys and provider APIs out of runtime", async () => {
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsStore = await readSource("src/store/providerSettingsStore.ts");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const authenticatedFetch = await readSource("src/services/auth/authenticatedFetch.ts");
    const packageJson = await readSource("package.json");
    const combinedFrontend = [
      providerSettingsPage,
      providerSettingsStore,
      providerSettingsService,
      authenticatedFetch,
    ].join("\n");

    expect(routeSource).toContain(".storeProviderKey(");
    expect(routeSource).toContain(".replaceProviderKey(");
    expect(routeSource).toContain(".revokeProviderKey(");
    expect(routeSource).not.toContain(".decryptProviderKey(");
    expect(routeSource).not.toContain("fetch(");
    expect(routeSource).not.toContain("@supabase/");

    for (const forbidden of [
      'type="password"',
      'name="apiKey"',
      'name="providerKey"',
      "setApiKey",
      "setProviderKey",
      "localStorage.setItem",
      "localStorage.getItem",
      "sessionStorage.setItem",
      "sessionStorage.getItem",
      "document.cookie",
      "persist(",
      "api.openai.com",
      "replicate.com",
      "runwayml",
      "api.runway",
      "lumalabs.ai",
      "api.luma",
      "generativelanguage.googleapis.com",
      'fetch("https://',
      "fetch(`https://",
      "connected_success",
      "verified_success",
      "verification_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(combinedFrontend).not.toContain(forbidden);
    }

    expect(authenticatedFetch).not.toContain('"/provider-settings/connections"');
    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(packageJson).not.toContain("stripe");
  });
});
