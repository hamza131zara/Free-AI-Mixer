import { expect, test } from "@playwright/test";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../backend/app";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";

const rawKey = "FAKE_PHASE34_PROVIDER_API_KEY_DO_NOT_STORE";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const mutationRequests = [
  {
    label: "add connection",
    path: "/provider-settings/connections",
    method: "POST",
  },
  {
    label: "test connection",
    path: "/provider-settings/connections/openai/test",
    method: "POST",
  },
  {
    label: "remove connection",
    path: "/provider-settings/connections/openai",
    method: "DELETE",
  },
  {
    label: "update routing policy",
    path: "/provider-settings/routing-policy",
    method: "PUT",
  },
] as const;

const startServer = async (app = createApp()): Promise<{ server: Server; baseUrl: string }> => {
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
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

const assertNoByokSecretLeakage = (text: string): void => {
  expect(text).not.toContain(rawKey);
  expect(text).not.toContain("encryptedPayload");
  expect(text).not.toContain("secretRef");
  expect(text).not.toContain("connected");
  expect(text).not.toContain("verified");
  expect(text).not.toContain("fake_success");
  expect(text).not.toContain("providerCredential");
  expect(text).not.toContain("providerAccount");
  expect(text).not.toContain("providerBalance");
};

const postMutation = async (
  baseUrl: string,
  request: (typeof mutationRequests)[number],
): Promise<Response> =>
  fetch(`${baseUrl}${request.path}`, {
    method: request.method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      providerId: "openai",
      apiKey: rawKey,
      providerKey: rawKey,
      plaintextKey: rawKey,
      replacementPlaintextKey: rawKey,
      secretRef: "secret-ref-should-not-echo",
    }),
  });

const createAuthenticatedProviderSettingsApp = (
  role: "owner" | "admin" | "member" | "viewer",
): express.Express => {
  const app = express();
  const workspaceMembershipRepository: WorkspaceMembershipRepository = {
    getMembership: async ({ userId, workspaceId }) => ({
      kind: "member",
      membership: {
        userId,
        workspaceId,
        role,
        status: "active",
        source: "workspace_memberships",
      },
    }),
  };

  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      kind: "authenticated",
      userId: `user_${role}`,
      workspaceId: "workspace_alpha",
      authProvider: "session",
      authSubject: `subject_${role}`,
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository,
    }),
  );

  return app;
};

const createUnauthenticatedProviderSettingsApp = (): express.Express => {
  const app = express();

  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      kind: "unauthenticated",
      reason: "missing_credentials",
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
    }),
  );

  return app;
};

test.describe("phase34 provider settings mutation fail-closed boundary", () => {
  test("auth-not-configured mutation requests fail closed and do not echo raw key bodies", async () => {
    const { server, baseUrl } = await startServer();

    try {
      for (const request of mutationRequests) {
        const response = await postMutation(baseUrl, request);
        const text = await response.text();

        expect(response.status, request.label).toBe(503);
        expect(text).toContain("provider_settings_mutation_unavailable");
        expect(text).toContain("auth_not_configured");
        assertNoByokSecretLeakage(text);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("unauthenticated mutation requests fail closed and do not echo raw key bodies", async () => {
    const { server, baseUrl } = await startServer(createUnauthenticatedProviderSettingsApp());

    try {
      for (const request of mutationRequests) {
        const response = await postMutation(baseUrl, request);
        const text = await response.text();

        expect(response.status, request.label).toBe(401);
        expect(text).toContain("provider_settings_sign_in_required");
        expect(text).toContain("unauthenticated");
        assertNoByokSecretLeakage(text);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("workspace owner and admin remain unavailable because vault storage is not configured", async () => {
    for (const role of ["owner", "admin"] as const) {
      const { server, baseUrl } = await startServer(createAuthenticatedProviderSettingsApp(role));

      try {
        for (const request of mutationRequests) {
          const response = await postMutation(baseUrl, request);
          const text = await response.text();

          expect(response.status, `${role} ${request.label}`).toBe(503);
          expect(text).toContain("provider_settings_mutation_unavailable");
          expect(text).toContain("secure_provider_key_storage_not_enabled");
          assertNoByokSecretLeakage(text);
        }
      } finally {
        await stopServer(server);
      }
    }
  });

  test("workspace member and viewer mutation attempts are forbidden and do not echo raw key bodies", async () => {
    for (const role of ["member", "viewer"] as const) {
      const { server, baseUrl } = await startServer(createAuthenticatedProviderSettingsApp(role));

      try {
        for (const request of mutationRequests) {
          const response = await postMutation(baseUrl, request);
          const text = await response.text();

          expect(response.status, `${role} ${request.label}`).toBe(403);
          expect(text).toContain("provider_settings_forbidden");
          expect(text).toContain("workspace_owner_or_admin_required");
          assertNoByokSecretLeakage(text);
        }
      } finally {
        await stopServer(server);
      }
    }
  });
});
