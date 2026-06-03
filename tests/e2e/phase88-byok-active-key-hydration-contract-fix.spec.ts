import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendRedactedProviderConnectionSummary,
  BackendSupportedProviderId,
} from "../../backend/contracts/providerSettingsHttpTypes";
import { createMockProviderValidationAdapter } from "../../backend/providers/mockProviderValidationAdapter";
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
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const rawProviderKey = "FAKE_PHASE88_FIX2_PROVIDER_KEY_DO_NOT_STORE";
const replacementProviderKey =
  "FAKE_PHASE88_FIX2_REPLACEMENT_KEY_DO_NOT_STORE";
const encryptedPayload =
  "FAKE_PHASE88_FIX2_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE88_FIX2_SECRET_REF_DO_NOT_RETURN";
const decryptedKey = "FAKE_PHASE88_FIX2_DECRYPTED_KEY_DO_NOT_RETURN";
const providerAccountMetadata =
  "FAKE_PHASE88_FIX2_PROVIDER_ACCOUNT_METADATA_DO_NOT_RETURN";
const providerRawError =
  "FAKE_PHASE88_FIX2_PROVIDER_RAW_ERROR_DO_NOT_RETURN";
const serviceRoleLike = "supabase_service_role_PHASE88_FIX2_DO_NOT_RETURN";
const jwtLike = "phase88fix2.header.payload";
const encryptionKeyLike =
  "FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1=PHASE88_FIX2_DO_NOT_RETURN";

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
    secretRef,
    decryptedKey,
    providerAccountMetadata,
    providerRawError,
    serviceRoleLike,
    jwtLike,
    encryptionKeyLike,
    "encryptedPayload",
    "secretRef",
    "decryptedKey",
    "providerCredential",
    "providerAccountMetadata",
    "provider_account_metadata",
    "providerRawError",
    "provider_raw_error",
    "service_role",
    "jwt",
    "encryptionKey",
    "connected_success",
    "verified_success",
    "test_passed",
    "fake_success",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const createMembershipRepository = (
  role: "owner" | "admin" | "member" | "viewer" = "owner",
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
  getVaultReadiness: (): ProviderSecretVaultReadiness => ({ kind: "vault_ready" }),
  encryptProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by hydration tests.",
  }),
  decryptProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_decrypt_failed",
    status: "decrypt_failed",
    message: "Not used by hydration tests.",
  }),
  storeProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_provider_key_stored",
    status: "stored",
    secretHandle: {
      algorithm: "aes-256-gcm",
      encryptedPayload,
      keyVersion: "v1",
      kind: "encrypted_secret",
    },
    keyFingerprintSuffix: "f2st",
    maskedFingerprint: "provider-key:f2st",
  }),
  rotateProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_provider_key_rotated",
    status: "replaced",
    secretHandle: {
      algorithm: "aes-256-gcm",
      encryptedPayload,
      keyVersion: "v1",
      kind: "encrypted_secret",
    },
    keyFingerprintSuffix: "f2rp",
    maskedFingerprint: "provider-key:f2rp",
  }),
  revokeProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_provider_key_revoked",
    status: "revoked",
  }),
};

const toConnection = (
  providerId: BackendSupportedProviderId,
  suffix: string,
  verificationStatus:
    | "not_validated"
    | "validated"
    | "validation_failed" = "validated",
): BackendRedactedProviderConnectionSummary => ({
  providerId,
  status: "not_connected",
  maskedKeySummary: `Provider key metadata is stored server-side only; record ending ${suffix}.`,
  maskedFingerprint: `provider-key:${suffix}`,
  keyFingerprintSuffix: suffix,
  createdAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z",
  lastVerifiedAt:
    verificationStatus === "validated" ? "2026-06-03T00:00:00.000Z" : undefined,
  lastValidationStatus: verificationStatus,
  verificationStatus,
  needsReverification: verificationStatus !== "validated",
  canManage: true,
});

class HydrationRepository implements BackendProviderKeyRepository {
  readonly calls: string[] = [];
  private active = true;
  private suffix = "f2ac";
  private verificationStatus: "not_validated" | "validated" = "validated";

  async getByProviderKeyId(): Promise<BackendProviderKeyRecord | undefined> {
    return undefined;
  }

  async listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]> {
    this.calls.push("listForWorkspace");

    if (!this.active) {
      return [];
    }

    return [
      {
        createdByUserId: "phase88-fix2-user",
        ownerId: "phase88-fix2-user",
        providerKeyId: "phase88-fix2-provider-key",
        providerName: "openai",
        status: "active",
        workspaceId,
        verificationStatus: this.verificationStatus,
        needsReverification: this.verificationStatus !== "validated",
      },
    ];
  }

  async listRedactedConnectionSummariesForWorkspace(
    workspaceId: string,
  ): Promise<BackendRedactedProviderConnectionSummary[]> {
    this.calls.push(`listRedactedConnectionSummariesForWorkspace:${workspaceId}`);

    return this.active
      ? [toConnection("openai", this.suffix, this.verificationStatus)]
      : [];
  }

  async createProviderKey(
    input: BackendProviderKeyCreateInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("createProviderKey");

    if (this.active) {
      return {
        kind: "conflict",
        status: "conflict",
        code: "active_provider_key_exists",
        message: "An active provider key already exists for this workspace/provider.",
      };
    }

    this.active = true;
    this.suffix = input.keyFingerprintSuffix ?? "f2st";
    this.verificationStatus = "not_validated";

    return {
      kind: "stored",
      status: "stored",
      connection: toConnection(input.providerId, this.suffix, "not_validated"),
    };
  }

  async replaceProviderKey(
    input: BackendProviderKeyReplaceInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("replaceProviderKey");
    this.active = true;
    this.suffix = input.keyFingerprintSuffix ?? "f2rp";
    this.verificationStatus = "not_validated";

    return {
      kind: "replaced",
      status: "replaced",
      connection: toConnection(input.providerId, this.suffix, "not_validated"),
    };
  }

  async revokeProviderKey(
    input: BackendProviderKeyRevokeInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.calls.push("revokeProviderKey");
    this.active = false;

    return {
      kind: "revoked",
      status: "revoked",
      connection: {
        providerId: "openai",
        status: "not_connected",
        maskedKeySummary: "Provider key was revoked server-side.",
        lastValidationStatus: "not_validated",
        verificationStatus: "not_validated",
        needsReverification: true,
        canManage: true,
      },
    };
  }

  async updateProviderKeyValidationState(
    input: BackendProviderKeyValidationStateInput,
  ): Promise<BackendProviderKeyValidationStateResult> {
    this.calls.push("updateProviderKeyValidationState");
    this.verificationStatus =
      input.verificationStatus === "validated" ? "validated" : "not_validated";

    return {
      kind: "validation_state_updated",
      status: "updated",
      connection: toConnection("openai", this.suffix, "validated"),
    };
  }
}

const startProviderSettingsApp = async (options: {
  providerKeyRepository?: BackendProviderKeyRepository;
  providerKeysRuntimeEnabled?: boolean;
  role?: "owner" | "admin" | "member" | "viewer";
}): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();
  app.use(express.json());
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      providerKeyRepository: options.providerKeyRepository,
      providerKeysRuntimeEnabled: options.providerKeysRuntimeEnabled,
      providerSecretVault: readyVault,
      providerValidationAdapter: createMockProviderValidationAdapter(),
      providerValidationRuntimeEnabled: true,
      routeAccessResolver: {
        resolve: async () => ({
          appUserId: "phase88-fix2-user",
          authProvider: "session",
          authSubject: "phase88-fix2-subject",
          kind: "authenticated",
          userId: "phase88-fix2-user",
          workspaceAuthority: "verified",
          workspaceId: "phase88-fix2-workspace",
          workspaceRole: "workspace_owner",
        }),
      },
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

const readJson = async (
  baseUrl: string,
  pathName: "/provider-settings/status" | "/provider-settings/connections",
): Promise<{ status: number; text: string; json: Record<string, unknown> }> => {
  const response = await fetch(`${baseUrl}${pathName}`);
  const text = await response.text();

  return {
    status: response.status,
    text,
    json: JSON.parse(text) as Record<string, unknown>,
  };
};

const getOpenAiConnection = (
  json: Record<string, unknown>,
): Record<string, unknown> => {
  const connections = json.connections;

  expect(Array.isArray(connections)).toBe(true);

  const connection = (connections as Array<Record<string, unknown>>).find(
    (summary) => summary.providerId === "openai",
  );

  expect(connection).toBeDefined();

  return connection as Record<string, unknown>;
};

test.describe("phase88 BYOK active provider key hydration contract fix", () => {
  test("read endpoints hydrate active redacted summaries instead of generic no-key state", async () => {
    const repository = new HydrationRepository();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerKeysRuntimeEnabled: true,
    });

    try {
      for (const pathName of [
        "/provider-settings/status",
        "/provider-settings/connections",
      ] as const) {
        const result = await readJson(baseUrl, pathName);
        const openAiConnection = getOpenAiConnection(result.json);

        expect(result.status).toBe(200);
        expect(openAiConnection.maskedFingerprint).toBe("provider-key:f2ac");
        expect(openAiConnection.canManage).toBe(true);
        expect(openAiConnection.verificationStatus).toBe("validated");
        expect(openAiConnection.maskedKeySummary).not.toBe(
          "Secure provider key storage is not enabled yet.",
        );
        expectNoSecretLeak(result.text);
      }

      expect(repository.calls).toEqual(
        expect.arrayContaining([
          "listRedactedConnectionSummariesForWorkspace:phase88-fix2-workspace",
        ]),
      );
      expect(repository.calls).not.toContain("createProviderKey");
    } finally {
      await stopServer(server);
    }
  });

  test("member/viewer or missing live dependencies fail closed to generic summaries", async () => {
    for (const testCase of [
      { role: "member" as const, runtimeEnabled: true },
      { role: "viewer" as const, runtimeEnabled: true },
      { role: "owner" as const, runtimeEnabled: false },
    ]) {
      const repository = new HydrationRepository();
      const { baseUrl, server } = await startProviderSettingsApp({
        providerKeyRepository: repository,
        providerKeysRuntimeEnabled: testCase.runtimeEnabled,
        role: testCase.role,
      });

      try {
        const result = await readJson(baseUrl, "/provider-settings/connections");

        expect(result.status).toBe(200);
        expect(result.text).toContain("Secure provider key storage is not enabled yet.");
        expect(result.text).not.toContain("provider-key:f2ac");
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("revoke after hydration removes active summary from subsequent refresh", async () => {
    const repository = new HydrationRepository();
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: repository,
      providerKeysRuntimeEnabled: true,
    });

    try {
      const beforeRevoke = await readJson(baseUrl, "/provider-settings/connections");

      expect(beforeRevoke.text).toContain("provider-key:f2ac");

      const revokeResponse = await fetch(
        `${baseUrl}/provider-settings/connections/openai`,
        {
          method: "DELETE",
        },
      );
      const revokeText = await revokeResponse.text();

      expect(revokeResponse.status).toBe(200);
      expect(revokeText).toContain("provider_settings_connection_revoked");
      expectNoSecretLeak(revokeText);

      const afterRevoke = await readJson(baseUrl, "/provider-settings/connections");

      expect(afterRevoke.text).toContain("Secure provider key storage is not enabled yet.");
      expect(afterRevoke.text).not.toContain("provider-key:f2ac");
      expectNoSecretLeak(afterRevoke.text);
      expect(repository.calls).toEqual(
        expect.arrayContaining(["listForWorkspace", "revokeProviderKey"]),
      );
    } finally {
      await stopServer(server);
    }
  });

  test("source boundaries keep hydration redacted and avoid provider calls or fake success", async () => {
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const repositoryContracts = await readSource(
      "backend/repositories/repositoryContracts.ts",
    );
    const supabaseRepositorySource = await readSource(
      "backend/repositories/supabaseProviderKeyRepository.ts",
    );
    const frontendStore = await readSource("src/store/providerSettingsStore.ts");
    const frontendPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const packageJson = await readSource("package.json");
    const combined = [
      routeSource,
      repositoryContracts,
      supabaseRepositorySource,
      frontendStore,
      frontendPage,
    ].join("\n");

    expect(routeSource).toContain("getRedactedConnectionSummariesForRequester");
    expect(repositoryContracts).toContain(
      "listRedactedConnectionSummariesForWorkspace",
    );
    expect(supabaseRepositorySource).toContain(
      "providerKeyRedactedSummarySelectColumns",
    );
    const redactedSelectMatch = supabaseRepositorySource.match(
      /const providerKeyRedactedSummarySelectColumns = \[([\s\S]*?)\]\.join/,
    );

    expect(redactedSelectMatch?.[1]).toBeDefined();
    expect(redactedSelectMatch?.[1]).not.toContain("encrypted_payload");
    expect(redactedSelectMatch?.[1]).not.toContain("secret_ref");

    for (const forbidden of [
      "api.openai.com",
      "replicate.com",
      "api.runway",
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
      "Test passed",
      "Verified provider",
      "Live provider ready",
      "Generation enabled",
    ]) {
      expect(combined).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }
  });
});
