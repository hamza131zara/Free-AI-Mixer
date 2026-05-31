import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";

const rawProviderKey = "sk-test-placeholder-only";
const replacementProviderKey = "Bearer PHASE34_PLACEHOLDER_ONLY";

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
    label: "test provider connection",
    method: "POST",
    path: "/provider-settings/connections/openai/test",
  },
  {
    label: "replace routing policy",
    method: "PUT",
    path: "/provider-settings/routing-policy",
  },
  {
    label: "remove provider connection",
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
        authSubject: `subject_${requester.role}`,
        kind: "authenticated",
        userId: `user_${requester.role}`,
        workspaceId: "workspace_alpha",
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
      encryptedPayload: "encrypted-payload-placeholder-only",
      plaintextKey: rawProviderKey,
      providerCredential: {
        accountEmail: "provider-account@example.invalid",
        accountId: "provider-account-placeholder",
      },
      providerKey: rawProviderKey,
      replacementPlaintextKey: replacementProviderKey,
      secretRef: "vault/ref/placeholder-only",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: request.method,
  });

  return {
    body: await response.text(),
    status: response.status,
  };
};

const expectNoProviderSecretLeakage = (serialized: string): void => {
  expect(serialized).not.toContain(rawProviderKey);
  expect(serialized).not.toContain(replacementProviderKey);
  expect(serialized).not.toContain("encrypted-payload-placeholder-only");
  expect(serialized).not.toContain("vault/ref/placeholder-only");
  expect(serialized).not.toContain("providerCredential");
  expect(serialized).not.toContain("provider-account");
  expect(serialized).not.toContain("connected_success");
  expect(serialized).not.toContain("verification_success");
  expect(serialized).not.toContain("fake_success");
};

test.describe("phase34 BYOK pre-live security boundary", () => {
  test("provider settings mutation routes fail closed without fake success or secret echo", async () => {
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
          expect(result.body).not.toContain("accountEmail");
          expect(result.body).not.toContain("accountId");
          expectNoProviderSecretLeakage(result.body);
        }
      } finally {
        await stopServer(server);
      }
    }
  });

  test("safe event sanitizer redacts BYOK provider secret fields and secret-like values", () => {
    const result = sanitizeSafeEventMetadata({
      Authorization: replacementProviderKey,
      encryptedPayload: "encrypted-payload-placeholder-only",
      nested: {
        provider_raw_error: "provider returned raw body with sk-test-placeholder-only",
        rawProviderError: "provider account metadata should not log",
        token: "header.payload.signature",
      },
      plaintextKey: rawProviderKey,
      providerKey: rawProviderKey,
      replacementPlaintextKey: replacementProviderKey,
      secretRef: "vault/ref/placeholder-only",
      serviceRoleKey: "supabase_service_role_placeholder_only",
    });

    const serialized = JSON.stringify(result);

    expect(result.rejected).toBe(true);
    expect(result.redactedFields).toEqual(
      expect.arrayContaining([
        "Authorization",
        "encryptedPayload",
        "nested.provider_raw_error",
        "nested.rawProviderError",
        "nested.token",
        "plaintextKey",
        "providerKey",
        "replacementPlaintextKey",
        "secretRef",
        "serviceRoleKey",
      ]),
    );
    expectNoProviderSecretLeakage(serialized);
    expect(serialized).not.toContain("provider account metadata");
    expect(serialized).not.toContain("header.payload.signature");
    expect(serialized).not.toContain("supabase_service_role_placeholder_only");
  });

  test("frontend and runtime source boundaries remain pre-live and non-expanding", async () => {
    const providerSettingsPage = await readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsStore = await readSource("src/store/providerSettingsStore.ts");
    const providerSettingsService = await readSource("src/services/providerSettingsService.ts");
    const authenticatedFetch = await readSource("src/services/auth/authenticatedFetch.ts");
    const providerRoute = await readSource("backend/routes/providerSettings.ts");
    const migrationFiles = await fs.readdir(path.join(process.cwd(), "backend", "db", "migrations"));
    const combinedFrontend = [
      providerSettingsPage,
      providerSettingsStore,
      providerSettingsService,
      authenticatedFetch,
    ].join("\n");

    expect(providerSettingsPage).not.toContain('type="password"');
    expect(providerSettingsPage).not.toContain('name="apiKey"');
    expect(providerSettingsPage).not.toContain('name="providerKey"');
    expect(providerSettingsPage).not.toContain("setApiKey");
    expect(providerSettingsPage).not.toContain("setProviderKey");
    expect(providerSettingsPage).toContain("disabled");
    expect(providerSettingsPage).toContain("not_connected");
    expect(providerSettingsPage).toContain("not_enabled_yet");

    expect(providerSettingsStore).not.toContain("apiKey");
    expect(providerSettingsStore).not.toContain("providerKey");
    expect(providerSettingsStore).not.toContain("plaintextKey");
    expect(providerSettingsStore).not.toContain("replacementPlaintextKey");
    expect(providerSettingsStore).not.toContain("persist(");

    expect(providerSettingsService).not.toContain("apiKey:");
    expect(providerSettingsService).not.toContain("providerKey:");
    expect(providerSettingsService).not.toContain("plaintextKey");
    expect(providerSettingsService).not.toContain("replacementPlaintextKey");
    expect(providerSettingsService).not.toContain("secretRef");

    expect(authenticatedFetch).toContain('"/provider-settings/status"');
    expect(authenticatedFetch).not.toContain('"/provider-settings/connections"');
    expect(authenticatedFetch).not.toContain('"/provider-settings/routing-policy"');

    for (const forbidden of [
      ".storage.from(",
      ".from(",
      "createClient(",
      "@supabase/",
      "@aws-sdk/",
      "@google-cloud/storage",
      "@azure/storage",
      "localStorage.setItem",
      "localStorage.getItem",
      "sessionStorage.setItem",
      "sessionStorage.getItem",
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
      "verification_success",
      "fake_success",
    ]) {
      expect(combinedFrontend).not.toContain(forbidden);
    }

    expect(providerRoute).toContain("createNotConfiguredProviderSecretVault");
    expect(providerRoute).toContain("secure_provider_key_storage_not_enabled");
    expect(providerRoute).not.toContain("createClient(");
    expect(providerRoute).not.toContain("@supabase/");
    expect(providerRoute).not.toContain("fetch(");
    expect(providerRoute).not.toContain("providerCredential");
    expect(migrationFiles.join("\n")).not.toContain("provider_key");
    expect(migrationFiles.join("\n")).not.toContain("provider_credential");
  });
});
