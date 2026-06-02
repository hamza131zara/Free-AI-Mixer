import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AsyncBackendRequesterContextResolver } from "../../backend/auth/requesterContextResolver";
import { createUnauthenticatedRequesterContext } from "../../backend/auth/requesterContext";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendRedactedProviderConnectionSummary,
  BackendSupportedProviderId,
} from "../../backend/contracts/providerSettingsHttpTypes";
import type {
  ProviderSecretVault,
  ProviderSecretVaultOperationResult,
  ProviderSecretVaultReadiness,
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

const fakeRawProviderKey = "FAKE_PHASE73_PROVIDER_KEY_DO_NOT_STORE";
const fakeEncryptedPayload = "FAKE_PHASE73_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const fakeSecretRef = "FAKE_PHASE73_SECRET_REF_DO_NOT_RETURN";
const fakeProviderCredential = "FAKE_PHASE73_PROVIDER_CREDENTIAL_DO_NOT_RETURN";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
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

const expectNoSecretLeak = (serialized: string): void => {
  for (const forbidden of [
    fakeRawProviderKey,
    fakeEncryptedPayload,
    fakeSecretRef,
    fakeProviderCredential,
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
    "connected_success",
    "verified_success",
    "test_passed",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const toConnection = (
  providerId: BackendSupportedProviderId,
): BackendRedactedProviderConnectionSummary => ({
  canManage: true,
  keyFingerprintSuffix: "h73",
  lastValidationStatus: "not_validated",
  maskedFingerprint: "provider-key:h73",
  maskedKeySummary: "Provider key metadata is stored server-side only.",
  needsReverification: true,
  providerId,
  status: "not_connected",
  verificationStatus: "not_validated",
});

const createRecord = (
  overrides: Partial<BackendProviderKeyRecord> = {},
): BackendProviderKeyRecord => ({
  createdByUserId: "phase73-app-user",
  ownerId: "phase73-app-user",
  providerKeyId: "phase73-key",
  providerName: "openai",
  status: "active",
  workspaceId: "phase73-workspace",
  ...overrides,
});

class Phase73ProviderKeyRepository implements BackendProviderKeyRepository {
  readonly calls: string[] = [];
  readonly rows: BackendProviderKeyRecord[] = [];

  async getByProviderKeyId(
    providerKeyId: string,
  ): Promise<BackendProviderKeyRecord | undefined> {
    this.calls.push("getByProviderKeyId");
    return this.rows.find((row) => row.providerKeyId === providerKeyId);
  }

  async listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]> {
    this.calls.push("listForWorkspace");
    return this.rows.filter((row) => row.workspaceId === workspaceId);
  }

  async createProviderKey(
    input: BackendProviderKeyCreateInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push(`createProviderKey:${input.ownerId}:${input.workspaceId}`);
    this.rows.push(
      createRecord({
        ownerId: input.ownerId,
        providerName: input.providerId,
        workspaceId: input.workspaceId,
      }),
    );

    return {
      connection: toConnection(input.providerId),
      kind: "stored",
      status: "stored",
    };
  }

  async replaceProviderKey(
    input: BackendProviderKeyReplaceInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("replaceProviderKey");
    return {
      connection: toConnection(input.providerId),
      kind: "replaced",
      status: "replaced",
    };
  }

  async revokeProviderKey(
    _input: BackendProviderKeyRevokeInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("revokeProviderKey");
    return {
      connection: {
        ...toConnection("openai"),
        keyFingerprintSuffix: undefined,
        maskedFingerprint: undefined,
        maskedKeySummary: "Provider key was revoked server-side.",
      },
      kind: "revoked",
      status: "revoked",
    };
  }
}

class Phase73ReadyVault implements ProviderSecretVault {
  readonly calls: string[] = [];

  getVaultReadiness(): ProviderSecretVaultReadiness {
    return { kind: "vault_ready" };
  }

  async encryptProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return this.storedResult("encrypted");
  }

  async decryptProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    return {
      kind: "vault_decrypt_failed",
      message: "Provider key could not be decrypted safely.",
      status: "decrypt_failed",
    };
  }

  async storeProviderKey(input: {
    plaintextKey: string;
    providerId: BackendSupportedProviderId;
  }): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push(`store:${input.providerId}:${input.plaintextKey}`);
    return this.storedResult("stored");
  }

  async rotateProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push("rotateProviderKey");
    return this.storedResult("replaced");
  }

  async revokeProviderKey(): Promise<ProviderSecretVaultOperationResult> {
    this.calls.push("revokeProviderKey");
    return {
      kind: "vault_provider_key_revoked",
      status: "revoked",
    };
  }

  private storedResult(
    status: "encrypted" | "stored" | "replaced",
  ): ProviderSecretVaultOperationResult {
    return {
      keyFingerprintSuffix: "h73",
      kind:
        status === "encrypted"
          ? "vault_provider_key_encrypted"
          : status === "stored"
            ? "vault_provider_key_stored"
            : "vault_provider_key_rotated",
      maskedFingerprint: "provider-key:h73",
      secretHandle: {
        algorithm: "aes-256-gcm",
        encryptedPayload: fakeEncryptedPayload,
        keyVersion: "v1",
        kind: "encrypted_secret",
      },
      status,
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

const createRuntimeResolver = (
  mode: "verified_workspace" | "missing_workspace" | "unauthenticated",
): AsyncBackendRequesterContextResolver => ({
  resolve: async (input) => {
    const authorization = input?.headers?.authorization;

    if (
      mode === "unauthenticated" ||
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")
    ) {
      return createUnauthenticatedRequesterContext("invalid_credentials");
    }

    if (mode === "missing_workspace") {
      return {
        appUserId: "phase73-app-user",
        authProvider: "supabase",
        authSubject: "phase73-auth-subject",
        kind: "authenticated",
        supabaseUserId: "phase73-supabase-user",
        userId: "phase73-app-user",
        workspaceAuthority: "not_available",
        workspaceAuthorityReason: "no_active_workspace_membership",
      };
    }

    return {
      appUserId: "phase73-app-user",
      authProvider: "supabase",
      authSubject: "phase73-auth-subject",
      kind: "authenticated",
      supabaseUserId: "phase73-supabase-user",
      userId: "phase73-app-user",
      workspaceAuthority: "verified",
      workspaceId: "phase73-workspace",
      workspaceRole: "workspace_owner",
    };
  },
});

const startProviderSettingsApp = async (options: {
  providerKeyRepository: BackendProviderKeyRepository;
  providerSecretVault: ProviderSecretVault;
  resolverMode: "verified_workspace" | "missing_workspace" | "unauthenticated";
  role?: "owner" | "admin" | "member" | "viewer";
}): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use(
    createProviderSettingsRouter({
      providerKeyRepository: options.providerKeyRepository,
      providerKeysRuntimeEnabled: true,
      providerSecretVault: options.providerSecretVault,
      routeAccessResolver: createRuntimeResolver(options.resolverMode),
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository: createMembershipRepository(
        options.role ?? "owner",
      ),
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
};

const postProviderKey = async (
  baseUrl: string,
  includeAuthorization = true,
): Promise<{ status: number; text: string }> => {
  const response = await fetch(`${baseUrl}/provider-settings/connections`, {
    body: JSON.stringify({
      apiKey: fakeRawProviderKey,
      encryptedPayload: fakeEncryptedPayload,
      providerCredential: fakeProviderCredential,
      providerId: "openai",
      secretRef: fakeSecretRef,
    }),
    headers: {
      ...(includeAuthorization
        ? { authorization: "Bearer phase73-placeholder-token" }
        : {}),
      "content-type": "application/json",
    },
    method: "POST",
  });

  return { status: response.status, text: await response.text() };
};

test.describe("phase73 BYOK provider settings runtime requester context bridge", () => {
  test("runtime-resolved requester workspace context can reach owner mutation authorization", async () => {
    const repository = new Phase73ProviderKeyRepository();
    const vault = new Phase73ReadyVault();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerSecretVault: vault,
      resolverMode: "verified_workspace",
    });

    try {
      const result = await postProviderKey(baseUrl);

      expect(result.status).toBe(201);
      expect(result.text).toContain("provider_settings_connection_stored");
      expect(repository.calls).toContain(
        "createProviderKey:phase73-app-user:phase73-workspace",
      );
      expect(vault.calls).toContain(`store:openai:${fakeRawProviderKey}`);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("mutation does not run without verified workspace context", async () => {
    const repository = new Phase73ProviderKeyRepository();
    const vault = new Phase73ReadyVault();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerSecretVault: vault,
      resolverMode: "missing_workspace",
    });

    try {
      const result = await postProviderKey(baseUrl);

      expect(result.status).toBe(503);
      expect(result.text).toContain("workspace_permission_not_verified");
      expect(repository.calls).toEqual([]);
      expect(vault.calls).toEqual([]);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("mutation preserves unauthenticated 401 and does not touch vault or repository", async () => {
    const repository = new Phase73ProviderKeyRepository();
    const vault = new Phase73ReadyVault();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerSecretVault: vault,
      resolverMode: "verified_workspace",
    });

    try {
      const result = await postProviderKey(baseUrl, false);

      expect(result.status).toBe(401);
      expect(result.text).toContain("provider_settings_sign_in_required");
      expect(repository.calls).toEqual([]);
      expect(vault.calls).toEqual([]);
      expectNoSecretLeak(result.text);
    } finally {
      await stopServer(server);
    }
  });

  test("mutation does not run for non-owner/admin workspace roles", async () => {
    for (const role of ["member", "viewer"] as const) {
      const repository = new Phase73ProviderKeyRepository();
      const vault = new Phase73ReadyVault();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerSecretVault: vault,
        resolverMode: "verified_workspace",
        role,
      });

      try {
        const result = await postProviderKey(baseUrl);

        expect(result.status).toBe(403);
        expect(result.text).toContain("workspace_owner_or_admin_required");
        expect(repository.calls).toEqual([]);
        expect(vault.calls).toEqual([]);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });
});
