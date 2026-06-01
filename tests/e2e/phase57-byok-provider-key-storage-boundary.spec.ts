import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendProviderConnectionMutationResponse,
  BackendRedactedProviderConnectionSummary,
} from "../../backend/contracts/providerSettingsHttpTypes";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";
import { createNotConfiguredProviderSecretVault } from "../../backend/providers/notConfiguredProviderSecretVault";
import type {
  BackendProviderKeyStorageResult,
} from "../../backend/repositories/repositoryContracts";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";

const rawProviderKey = "FAKE_PHASE57_PROVIDER_KEY_DO_NOT_STORE";
const replacementProviderKey = "FAKE_PHASE57_REPLACEMENT_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE57_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE57_SECRET_REF_DO_NOT_RETURN";
const serviceRoleLikeValue = "supabase_service_role_PHASE57_DO_NOT_STORE";
const providerRawError = "provider_raw_error_PHASE57_DO_NOT_RETURN";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const mutationRequests = [
  {
    label: "add provider connection",
    method: "POST",
    path: "/provider-settings/connections",
  },
  {
    label: "replace provider connection",
    method: "PUT",
    path: "/provider-settings/connections/openai",
  },
  {
    label: "test provider connection",
    method: "POST",
    path: "/provider-settings/connections/openai/test",
  },
  {
    label: "revoke provider connection",
    method: "DELETE",
    path: "/provider-settings/connections/openai",
  },
] as const;

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const startServer = async (
  app: express.Express,
): Promise<{ baseUrl: string; server: Server }> => {
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
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

const createProviderSettingsApp = (
  requester:
    | { kind: "auth_not_configured" }
    | { kind: "unauthenticated" }
    | { kind: "authenticated"; role: "owner" | "admin" | "member" | "viewer" },
): express.Express => {
  const app = express();
  const workspaceMembershipRepository: WorkspaceMembershipRepository = {
    getMembership: async ({ userId, workspaceId }) => {
      if (requester.kind !== "authenticated") {
        return { kind: "not_configured" };
      }

      return {
        kind: "member",
        membership: {
          role: requester.role,
          source: "workspace_memberships",
          status: "active",
          userId,
          workspaceId,
        },
      };
    },
  };

  app.use(express.json());

  if (requester.kind === "authenticated") {
    app.use((request, _response, next) => {
      (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
        authProvider: "session",
        authSubject: `phase57-subject-${requester.role}`,
        kind: "authenticated",
        userId: `phase57-user-${requester.role}`,
        workspaceId: "phase57-workspace",
      };
      next();
    });
  }

  if (requester.kind === "unauthenticated") {
    app.use((request, _response, next) => {
      (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
        kind: "unauthenticated",
        reason: "missing_credentials",
      };
      next();
    });
  }

  app.use(
    createProviderSettingsRouter({
      runtimeConfig:
        requester.kind === "auth_not_configured"
          ? { kind: "auth_provider_not_configured" as const }
          : authConfiguredRuntime,
      workspaceMembershipRepository,
    }),
  );

  return app;
};

const sendMutation = async (
  baseUrl: string,
  request: (typeof mutationRequests)[number],
): Promise<{ body: string; status: number }> => {
  const response = await fetch(`${baseUrl}${request.path}`, {
    body: JSON.stringify({
      apiKey: rawProviderKey,
      encryptedPayload,
      plaintextKey: rawProviderKey,
      providerCredential: {
        accountEmail: "provider-account@example.invalid",
        accountId: "phase57-provider-account",
      },
      providerKey: rawProviderKey,
      providerRawError,
      replacementPlaintextKey: replacementProviderKey,
      secretRef,
      serviceRoleKey: serviceRoleLikeValue,
    }),
    headers: {
      authorization: "Bearer FAKE_PHASE57_BEARER_DO_NOT_STORE",
      "content-type": "application/json",
    },
    method: request.method,
  });

  return {
    body: await response.text(),
    status: response.status,
  };
};

const expectNoSecretLeakage = (
  serialized: string,
  options: { allowRedactedFieldNames?: boolean } = {},
): void => {
  const forbiddenValues = [
    rawProviderKey,
    replacementProviderKey,
    encryptedPayload,
    secretRef,
    serviceRoleLikeValue,
    providerRawError,
  ];
  const forbiddenFieldNames = [
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerRawError",
    "provider-account",
    "connected_success",
    "verified_success",
    "verification_success",
    "test_passed",
    "fake_success",
  ];

  for (const forbidden of forbiddenValues) {
    expect(serialized).not.toContain(forbidden);
  }

  if (options.allowRedactedFieldNames) {
    return;
  }

  for (const forbidden of forbiddenFieldNames) {
    expect(serialized).not.toContain(forbidden);
  }
};

const redactedConnection: BackendRedactedProviderConnectionSummary = {
  providerId: "openai",
  status: "not_connected",
  maskedKeySummary: "Key stored; ending in 1234.",
  maskedFingerprint: "fp_phase57_redacted",
  keyFingerprintSuffix: "1234",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  managedByWorkspaceRole: "workspace_owner",
  canManage: true,
};

test.describe("phase57 BYOK provider key storage boundary", () => {
  test("HTTP mutation contract success shapes remain redacted and browser safe", () => {
    const responses: BackendProviderConnectionMutationResponse[] = [
      {
        kind: "provider_settings_connection_stored",
        status: "stored",
        message: "Provider connection was stored.",
        connection: redactedConnection,
      },
      {
        kind: "provider_settings_connection_replaced",
        status: "replaced",
        message: "Provider connection was replaced.",
        connection: redactedConnection,
      },
      {
        kind: "provider_settings_connection_revoked",
        status: "revoked",
        message: "Provider connection was revoked.",
        connection: {
          ...redactedConnection,
          status: "not_connected",
          maskedKeySummary: "Provider connection is not connected.",
          maskedFingerprint: undefined,
          keyFingerprintSuffix: undefined,
          verificationStatus: "not_enabled_yet",
        },
      },
    ];

    const serialized = JSON.stringify(responses);

    expect(serialized).toContain("provider_settings_connection_stored");
    expect(serialized).toContain("provider_settings_connection_replaced");
    expect(serialized).toContain("provider_settings_connection_revoked");
    expect(serialized).toContain("maskedFingerprint");
    expect(serialized).toContain("keyFingerprintSuffix");
    expectNoSecretLeakage(serialized, { allowRedactedFieldNames: true });
  });

  test("repository storage result union models future outcomes with redacted public summaries only", () => {
    const results: BackendProviderKeyStorageResult[] = [
      { kind: "stored", status: "stored", connection: redactedConnection },
      { kind: "replaced", status: "replaced", connection: redactedConnection },
      { kind: "revoked", status: "revoked", connection: redactedConnection },
      {
        kind: "unavailable",
        status: "unavailable",
        code: "storage_not_configured",
        message: "Provider key repository is not configured.",
      },
      {
        kind: "unauthorized",
        status: "unauthorized",
        code: "workspace_owner_or_admin_required",
        message: "Workspace owner or admin is required.",
      },
      {
        kind: "conflict",
        status: "conflict",
        code: "active_provider_key_exists",
        message: "A provider key already exists for this workspace/provider.",
      },
      {
        kind: "invalid_provider",
        status: "invalid_provider",
        message: "Unsupported provider.",
      },
      {
        kind: "vault_unavailable",
        status: "vault_unavailable",
        message: "Secure provider key storage is not enabled yet.",
      },
    ];

    const serialized = JSON.stringify(results);

    for (const kind of [
      "stored",
      "replaced",
      "revoked",
      "unavailable",
      "unauthorized",
      "conflict",
      "invalid_provider",
      "vault_unavailable",
    ]) {
      expect(serialized).toContain(kind);
    }
    expectNoSecretLeakage(serialized, { allowRedactedFieldNames: true });
  });

  test("not-configured vault remains fail closed by default", async () => {
    const vault = createNotConfiguredProviderSecretVault();
    const results = [
      vault.getVaultReadiness(),
      await vault.storeProviderKey({
        providerId: "openai",
        workspaceId: "phase57-workspace",
        requesterUserId: "phase57-user",
        plaintextKey: rawProviderKey,
      }),
      await vault.rotateProviderKey({
        providerId: "openai",
        providerKeyId: "phase57-provider-key",
        workspaceId: "phase57-workspace",
        requesterUserId: "phase57-user",
        replacementPlaintextKey: replacementProviderKey,
      }),
      await vault.revokeProviderKey({
        providerKeyId: "phase57-provider-key",
        workspaceId: "phase57-workspace",
        requesterUserId: "phase57-user",
      }),
    ];

    expect(results[0]).toMatchObject({
      kind: "vault_unavailable",
      status: "not_configured",
    });
    for (const result of results.slice(1)) {
      expect(result).toMatchObject({
        kind: "vault_operation_unavailable",
        status: "not_configured",
      });
    }
    expectNoSecretLeakage(JSON.stringify(results));
  });

  test("provider settings mutation routes stay fail closed and never echo key-like request bodies", async () => {
    const cases = [
      {
        requester: { kind: "auth_not_configured" as const },
        expectedStatus: 503,
        expectedText: "auth_not_configured",
      },
      {
        requester: { kind: "unauthenticated" as const },
        expectedStatus: 401,
        expectedText: "provider_settings_sign_in_required",
      },
      {
        requester: { kind: "authenticated" as const, role: "owner" as const },
        expectedStatus: 503,
        expectedText: "secure_provider_key_storage_not_enabled",
      },
      {
        requester: { kind: "authenticated" as const, role: "admin" as const },
        expectedStatus: 503,
        expectedText: "secure_provider_key_storage_not_enabled",
      },
      {
        requester: { kind: "authenticated" as const, role: "member" as const },
        expectedStatus: 403,
        expectedText: "workspace_owner_or_admin_required",
      },
      {
        requester: { kind: "authenticated" as const, role: "viewer" as const },
        expectedStatus: 403,
        expectedText: "workspace_owner_or_admin_required",
      },
    ] as const;

    for (const testCase of cases) {
      const { baseUrl, server } = await startServer(
        createProviderSettingsApp(testCase.requester),
      );

      try {
        for (const request of mutationRequests) {
          const result = await sendMutation(baseUrl, request);

          expect(result.status, `${testCase.requester.kind} ${request.label}`).toBe(
            testCase.expectedStatus,
          );
          expect(result.body).toContain(testCase.expectedText);
          expectNoSecretLeakage(result.body);
        }
      } finally {
        await stopServer(server);
      }
    }
  });

  test("safe event sanitizer redacts BYOK headers raw errors and secret-like values", () => {
    const result = sanitizeSafeEventMetadata({
      Authorization: `Bearer ${replacementProviderKey}`,
      Cookie: "session=FAKE_PHASE57_COOKIE",
      apiKey: rawProviderKey,
      encryptedPayload,
      nested: {
        provider_raw_error: providerRawError,
        rawProviderError: "raw provider account body",
        serviceRoleKey: serviceRoleLikeValue,
      },
      plaintextKey: rawProviderKey,
      providerKey: rawProviderKey,
      replacementPlaintextKey: replacementProviderKey,
      secretRef,
      token: "header.payload.signature",
    });

    const serialized = JSON.stringify(result);

    expect(result.rejected).toBe(true);
    expect(result.redactedFields).toEqual(
      expect.arrayContaining([
        "Authorization",
        "Cookie",
        "apiKey",
        "encryptedPayload",
        "nested.provider_raw_error",
        "nested.rawProviderError",
        "nested.serviceRoleKey",
        "plaintextKey",
        "providerKey",
        "replacementPlaintextKey",
        "secretRef",
        "token",
      ]),
    );
    expectNoSecretLeakage(serialized, { allowRedactedFieldNames: true });
    expect(serialized).not.toContain("header.payload.signature");
    expect(serialized).not.toContain("raw provider account body");
  });

  test("source boundaries prevent frontend key storage provider calls fake state and runtime expansion", async () => {
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsStore = await readSource("src/store/providerSettingsStore.ts");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const authenticatedFetch = await readSource("src/services/auth/authenticatedFetch.ts");
    const providerSettingsRoute = await readSource("backend/routes/providerSettings.ts");
    const providerSettingsContracts = await readSource("backend/contracts/providerSettingsHttpTypes.ts");
    const repositoryContracts = await readSource("backend/repositories/repositoryContracts.ts");
    const packageJson = await readSource("package.json");
    const combinedFrontend = [
      providerSettingsPage,
      providerSettingsStore,
      providerSettingsService,
      authenticatedFetch,
    ].join("\n");

    expect(providerSettingsContracts).toContain("BackendProviderConnectionCreateRequest");
    expect(providerSettingsContracts).toContain("BackendProviderConnectionReplaceRequest");
    expect(providerSettingsContracts).not.toContain("encryptedPayload");
    expect(providerSettingsContracts).not.toContain("secretRef");
    expect(providerSettingsContracts).not.toContain("providerRawError");
    expect(providerSettingsContracts).not.toContain("serviceRole");
    expect(repositoryContracts).toContain("BackendProviderKeyStorageResult");
    expect(repositoryContracts).toContain("createProviderKey");
    expect(repositoryContracts).toContain("replaceProviderKey");
    expect(repositoryContracts).toContain("revokeProviderKey");
    expect(providerSettingsRoute).toContain('"/provider-settings/connections/:providerId"');
    expect(providerSettingsRoute).toContain('"replace_provider_key"');
    expect(providerSettingsRoute).toContain("secure_provider_key_storage_not_enabled");

    for (const forbidden of [
      'type="password"',
      'name="apiKey"',
      'name="providerKey"',
      "setApiKey",
      "setProviderKey",
      "localStorage.setItem",
      "localStorage.getItem",
      "localStorage.removeItem",
      "sessionStorage.setItem",
      "sessionStorage.getItem",
      "sessionStorage.removeItem",
      "document.cookie",
      "persist(",
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
      expect(combinedFrontend).not.toContain(forbidden);
    }

    expect(authenticatedFetch).toContain('"/provider-settings/status"');
    expect(authenticatedFetch).not.toContain('"/provider-settings/connections"');
    expect(authenticatedFetch).not.toContain('"/provider-settings/connections/');
    expect(authenticatedFetch).not.toContain('"/provider-settings/routing-policy"');
    expect(providerSettingsRoute).not.toContain("createClient(");
    expect(providerSettingsRoute).not.toContain("@supabase/");
    expect(providerSettingsRoute).not.toContain("fetch(");
    expect(packageJson).not.toContain("@openai/");
    expect(packageJson).not.toContain("@replicate/");
    expect(packageJson).not.toContain("@runway");
    expect(packageJson).not.toContain("@luma");
    expect(packageJson).not.toContain("stripe");
  });

  test("phase57 docs record backend-only boundary and no-go items", async () => {
    const byokDoc = await readSource("docs/byok-provider-key-storage-strategy.md");
    const roadmap = await readSource("docs/roadmap.md");
    const phases = await readSource("docs/phases.md");
    const combinedDocs = [byokDoc, roadmap, phases].join("\n");

    expect(byokDoc).toContain("Phase 57 Backend-Only Contract Boundary");
    expect(byokDoc).toContain("backend-only provider key storage boundary contracts");
    expect(byokDoc).toContain("No frontend API key input");
    expect(byokDoc).toContain("No provider SDK/API verification");
    expect(byokDoc).toContain("No fake connected, verified, or test-passed state");
    expect(roadmap).toContain("Phase 57 status");
    expect(phases).toContain("Phase 57 - Backend BYOK Provider Key Contract");
    expect(combinedDocs).not.toContain(rawProviderKey);
    expect(combinedDocs).not.toContain(replacementProviderKey);
    expect(combinedDocs).not.toContain(serviceRoleLikeValue);
  });
});
