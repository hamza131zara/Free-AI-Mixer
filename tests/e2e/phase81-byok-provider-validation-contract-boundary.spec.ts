import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type { ProviderValidationResult } from "../../backend/providers/providerValidationAdapter";
import {
  mapProviderValidationResultToStateInput,
} from "../../backend/providers/providerValidationAdapter";
import { createNotConfiguredProviderValidationAdapter } from "../../backend/providers/notConfiguredProviderValidationAdapter";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";
import { createNotConfiguredProviderSecretVault } from "../../backend/providers/notConfiguredProviderSecretVault";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
  BackendProviderKeyValidationStateInput,
  BackendProviderKeyValidationStateResult,
} from "../../backend/repositories/repositoryContracts";

const rawProviderKey = "FAKE_PHASE81_PROVIDER_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE81_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE81_SECRET_REF_DO_NOT_RETURN";
const providerRawError = "FAKE_PHASE81_PROVIDER_RAW_ERROR_DO_NOT_RETURN";
const providerAccountMetadata = "FAKE_PHASE81_PROVIDER_ACCOUNT_METADATA_DO_NOT_RETURN";
const serviceRoleLike = "supabase_service_role_PHASE81_DO_NOT_STORE";
const tokenLike = "phase81.header.payload";

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

const expectNoSecretLeak = (
  serialized: string,
  options: { allowRedactedFieldNames?: boolean } = {},
): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    providerRawError,
    providerAccountMetadata,
    serviceRoleLike,
    tokenLike,
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerRawError",
    "provider_raw_error",
    "providerAccount",
    "provider_account",
    "service_role",
    "test_passed",
    "verified_success",
    "connected_success",
    "fake_success",
  ]) {
    if (
      options.allowRedactedFieldNames &&
      [
        "encryptedPayload",
        "secretRef",
        "providerCredential",
        "providerRawError",
        "provider_raw_error",
        "providerAccount",
        "provider_account",
      ].includes(forbidden)
    ) {
      continue;
    }

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

class ValidationStateRepository implements BackendProviderKeyRepository {
  readonly validationUpdates: BackendProviderKeyValidationStateInput[] = [];

  async getByProviderKeyId(): Promise<BackendProviderKeyRecord | undefined> {
    return undefined;
  }

  async listForWorkspace(): Promise<BackendProviderKeyRecord[]> {
    return [];
  }

  async createProviderKey() {
    return {
      kind: "unavailable" as const,
      status: "unavailable" as const,
      code: "repository_unavailable" as const,
      message: "Not used in validation contract test.",
    };
  }

  async replaceProviderKey() {
    return {
      kind: "unavailable" as const,
      status: "unavailable" as const,
      code: "repository_unavailable" as const,
      message: "Not used in validation contract test.",
    };
  }

  async revokeProviderKey() {
    return {
      kind: "unavailable" as const,
      status: "unavailable" as const,
      code: "repository_unavailable" as const,
      message: "Not used in validation contract test.",
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
        verificationStatus:
          input.verificationStatus === "validated" ? "validated" : "validation_failed",
        lastValidationStatus:
          input.verificationStatus === "validated" ? "validated" : "validation_failed",
        needsReverification: input.needsReverification,
        canManage: true,
      },
    };
  }
}

const startProviderSettingsApp = async (options: {
  role?: "owner" | "admin" | "member" | "viewer";
  requester?: "authenticated" | "unauthenticated";
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
        authSubject: "phase81-subject",
        kind: "authenticated",
        userId: "phase81-owner",
        workspaceId: "phase81-workspace",
      };
    next();
  });

  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository: createMembershipRepository(options.role ?? "owner"),
      providerKeyRepository: new ValidationStateRepository(),
      providerKeysRuntimeEnabled: true,
      providerSecretVault: createNotConfiguredProviderSecretVault(),
      providerValidationAdapter: createNotConfiguredProviderValidationAdapter(),
    }),
  );

  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
};

const sendTestConnection = async (
  baseUrl: string,
): Promise<{ status: number; text: string }> => {
  const response = await fetch(`${baseUrl}/provider-settings/connections/openai/test`, {
    body: JSON.stringify({
      apiKey: rawProviderKey,
      encryptedPayload,
      plaintextKey: rawProviderKey,
      providerAccountMetadata,
      providerCredential: { accountId: providerAccountMetadata },
      providerRawError,
      secretRef,
      serviceRoleKey: serviceRoleLike,
      token: tokenLike,
    }),
    headers: {
      authorization: `Bearer ${tokenLike}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  return { status: response.status, text: await response.text() };
};

test.describe("phase81 BYOK provider validation contract boundary", () => {
  test("not-configured validation adapter fails closed without provider calls or key decrypt", async () => {
    const adapter = createNotConfiguredProviderValidationAdapter();
    const readiness = adapter.getReadiness();
    const result = await adapter.validateStoredProviderKey({
      providerId: "openai",
      providerKeyId: "phase81-provider-key",
      requesterUserId: "phase81-owner",
      workspaceId: "phase81-workspace",
    });
    const serialized = JSON.stringify({ readiness, result });

    expect(readiness).toMatchObject({
      kind: "validation_unavailable",
      status: "not_configured",
    });
    expect(result).toMatchObject({
      kind: "validation_unavailable",
      status: "not_configured",
      errorCode: "validation_unavailable",
    });
    expect(serialized).toContain("No provider API call was made");
    expectNoSecretLeak(serialized, { allowRedactedFieldNames: true });
  });

  test("test connection route remains unavailable and keeps auth boundary intact", async () => {
    const cases = [
      { requester: "unauthenticated" as const, role: "owner" as const, status: 401, text: "provider_settings_sign_in_required" },
      { requester: "authenticated" as const, role: "member" as const, status: 403, text: "workspace_owner_or_admin_required" },
      { requester: "authenticated" as const, role: "viewer" as const, status: 403, text: "workspace_owner_or_admin_required" },
      { requester: "authenticated" as const, role: "owner" as const, status: 503, text: "secure_provider_key_storage_not_enabled" },
      { requester: "authenticated" as const, role: "admin" as const, status: 503, text: "secure_provider_key_storage_not_enabled" },
    ];

    for (const testCase of cases) {
      const { baseUrl, server } = await startProviderSettingsApp(testCase);

      try {
        const result = await sendTestConnection(baseUrl);

        expect(result.status).toBe(testCase.status);
        expect(result.text).toContain(testCase.text);
        expectNoSecretLeak(result.text);
      } finally {
        await stopServer(server);
      }
    }
  });

  test("validation contracts use stored key references and map safe repository updates", async () => {
    const success: ProviderValidationResult = {
      kind: "validated",
      status: "validated",
      verifiedAt: "2026-06-02T00:00:00.000Z",
      message: "Provider key validated by backend.",
    };
    const failure: ProviderValidationResult = {
      kind: "validation_failed",
      status: "validation_failed",
      errorCode: "invalid_credentials",
      message: "Provider validation failed.",
    };
    const vaultFailure: ProviderValidationResult = {
      kind: "vault_decrypt_failed",
      status: "vault_decrypt_failed",
      errorCode: "vault_decrypt_failed",
      message: "Provider key could not be decrypted safely.",
    };
    const repository = new ValidationStateRepository();
    const baseInput = {
      providerKeyId: "phase81-provider-key",
      requesterUserId: "phase81-owner",
      workspaceId: "phase81-workspace",
    };

    await repository.updateProviderKeyValidationState?.(
      mapProviderValidationResultToStateInput(success, baseInput),
    );
    await repository.updateProviderKeyValidationState?.(
      mapProviderValidationResultToStateInput(failure, baseInput),
    );
    await repository.updateProviderKeyValidationState?.(
      mapProviderValidationResultToStateInput(vaultFailure, baseInput),
    );

    expect(repository.validationUpdates).toEqual([
      {
        ...baseInput,
        verificationStatus: "validated",
        lastVerifiedAt: "2026-06-02T00:00:00.000Z",
        lastVerificationErrorCode: undefined,
        needsReverification: false,
      },
      {
        ...baseInput,
        verificationStatus: "validation_failed",
        lastVerificationErrorCode: "invalid_credentials",
        needsReverification: true,
      },
      {
        ...baseInput,
        verificationStatus: "needs_reverification",
        lastVerificationErrorCode: "vault_decrypt_failed",
        needsReverification: true,
      },
    ]);
    expectNoSecretLeak(JSON.stringify(repository.validationUpdates));
  });

  test("raw provider error bodies are redacted before event metadata can be kept", () => {
    const result = sanitizeSafeEventMetadata({
      apiKey: rawProviderKey,
      encryptedPayload,
      provider_raw_error: providerRawError,
      providerAccountMetadata,
      providerCredential: { accountId: providerAccountMetadata },
      providerRawError,
      secretRef,
      serviceRoleKey: serviceRoleLike,
      token: tokenLike,
    });
    const serialized = JSON.stringify(result);

    expect(result.rejected).toBe(true);
    expect(result.redactedFields).toEqual(
      expect.arrayContaining([
        "apiKey",
        "encryptedPayload",
        "provider_raw_error",
        "providerAccountMetadata",
        "providerCredential",
        "providerRawError",
        "secretRef",
        "serviceRoleKey",
        "token",
      ]),
    );
    expectNoSecretLeak(serialized, { allowRedactedFieldNames: true });
  });

  test("source boundaries add contracts without provider SDK calls or frontend activation", async () => {
    const adapterSource = await readSource("backend/providers/providerValidationAdapter.ts");
    const notConfiguredSource = await readSource("backend/providers/notConfiguredProviderValidationAdapter.ts");
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const repositoryContracts = await readSource("backend/repositories/repositoryContracts.ts");
    const supabaseRepository = await readSource("backend/repositories/supabaseProviderKeyRepository.ts");
    const packageJson = await readSource("package.json");
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const validationBoundary = [
      adapterSource,
      notConfiguredSource,
      routeSource,
      repositoryContracts,
      supabaseRepository,
    ].join("\n");
    const frontendBoundary = `${providerSettingsPage}\n${providerSettingsService}`;

    expect(adapterSource).toContain("validateStoredProviderKey");
    expect(adapterSource).toContain("providerKeyId");
    expect(adapterSource).toContain("workspaceId");
    expect(adapterSource).not.toContain("apiKey");
    expect(adapterSource).not.toContain("plaintextKey");
    expect(notConfiguredSource).toContain("No provider API call was made");
    expect(repositoryContracts).toContain("BackendProviderKeyValidationStateInput");
    expect(repositoryContracts).toContain("updateProviderKeyValidationState");
    expect(supabaseRepository).toContain("last_verification_error_code");
    expect(supabaseRepository).toContain("last_verified_at");
    expect(routeSource).toContain('"test_provider_connection"');
    expect(routeSource).toContain('"/provider-settings/connections/:providerId/test"');
    expect(routeSource).not.toContain("validateStoredProviderKey(");
    expect(routeSource).not.toContain("mapProviderValidationResultToStateInput(");
    expect(frontendBoundary).toContain("Test connection unavailable");

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
      "verification_success",
      "test_passed",
      "fake_success",
    ]) {
      expect(validationBoundary).not.toContain(forbidden);
      expect(frontendBoundary).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }
  });
});
