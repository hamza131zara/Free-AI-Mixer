import { expect, test, type Page } from "@playwright/test";
import express from "express";
import { readFileSync, promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import type {
  BackendRedactedProviderConnectionSummary,
  BackendSupportedProviderId,
} from "../../backend/contracts/providerSettingsHttpTypes";
import type {
  ProviderSecretVault,
  ProviderSecretVaultOperationResult,
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

const rawProviderKey = "FAKE_PHASE88_FIX3_KEY_DO_NOT_STORE";
const encryptedPayload = "FAKE_PHASE88_FIX3_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const secretRef = "FAKE_PHASE88_FIX3_SECRET_REF_DO_NOT_RETURN";
const rawProviderError = "FAKE_PHASE88_FIX3_PROVIDER_RAW_ERROR_DO_NOT_RETURN";
const serviceRoleLike = "supabase_service_role_PHASE88_FIX3_DO_NOT_RETURN";
const jwtLike = "phase88fix3.header.payload";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const projectRoot = process.cwd();
const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(projectRoot, relativePath), "utf8");
const readSourceSync = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};

const expectNoSecretLeak = (serialized: string): void => {
  for (const forbidden of [
    rawProviderKey,
    encryptedPayload,
    secretRef,
    rawProviderError,
    serviceRoleLike,
    jwtLike,
    "encryptedPayload",
    "secretRef",
    "decryptedKey",
    "providerCredential",
    "providerAccountMetadata",
    "provider_raw_error",
    "service_role",
    "encryptionKey",
    "connected_success",
    "verified_success",
    "test_passed",
    "fake_success",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const toStoredConnection = (
  providerId: BackendSupportedProviderId,
  suffix: string,
): BackendRedactedProviderConnectionSummary => ({
  providerId,
  status: "stored",
  maskedKeySummary: `Provider key metadata is stored server-side only; record ending ${suffix}.`,
  maskedFingerprint: `provider-key:${suffix}`,
  keyFingerprintSuffix: suffix,
  createdAt: "2026-06-03T00:00:00.000Z",
  updatedAt: "2026-06-03T00:00:00.000Z",
  lastVerifiedAt: "2026-06-03T00:00:00.000Z",
  lastValidationStatus: "validated",
  verificationStatus: "validated",
  needsReverification: false,
  canManage: true,
});

const emptyOpenAiConnection: BackendRedactedProviderConnectionSummary = {
  providerId: "openai",
  status: "not_connected",
  maskedKeySummary: "No stored key summary yet.",
  lastValidationStatus: "not_validated",
  verificationStatus: "not_validated",
  needsReverification: true,
  canManage: false,
};

class ActiveSummaryRepository implements BackendProviderKeyRepository {
  private activeProviderIds = new Set<BackendSupportedProviderId>([
    "openai",
    "runway",
    "google",
  ]);

  async getByProviderKeyId(): Promise<BackendProviderKeyRecord | undefined> {
    return undefined;
  }

  async listForWorkspace(workspaceId: string): Promise<BackendProviderKeyRecord[]> {
    return [...this.activeProviderIds].map((providerId) => ({
      createdByUserId: "phase88-fix3-user",
      ownerId: "phase88-fix3-user",
      providerKeyId: `phase88-fix3-${providerId}`,
      providerName: providerId,
      status: "active",
      workspaceId,
      verificationStatus: "validated",
      needsReverification: false,
    }));
  }

  async listRedactedConnectionSummariesForWorkspace(): Promise<
    BackendRedactedProviderConnectionSummary[]
  > {
    return [...this.activeProviderIds].map((providerId) =>
      toStoredConnection(providerId, `${providerId.slice(0, 2)}f3`),
    );
  }

  async createProviderKey(): Promise<BackendProviderKeyStorageResult> {
    return {
      kind: "conflict",
      status: "conflict",
      code: "active_provider_key_exists",
      message: "An active provider key already exists for this workspace/provider.",
    };
  }

  async replaceProviderKey(
    input: BackendProviderKeyReplaceInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.activeProviderIds.add(input.providerId);

    return {
      kind: "replaced",
      status: "replaced",
      connection: toStoredConnection(input.providerId, "rpf3"),
    };
  }

  async revokeProviderKey(
    input: BackendProviderKeyRevokeInput,
  ): Promise<BackendProviderKeyStorageResult> {
    this.activeProviderIds.delete("openai");

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

  async createProviderKeyFromInput(
    _input: BackendProviderKeyCreateInput,
  ): Promise<BackendProviderKeyStorageResult> {
    return this.createProviderKey();
  }
}

const readyVault: ProviderSecretVault = {
  getVaultReadiness: () => ({ kind: "vault_ready" }),
  encryptProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_operation_unavailable",
    status: "not_configured",
    message: "Not used by status mapping tests.",
  }),
  decryptProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_decrypt_failed",
    status: "decrypt_failed",
    message: "Not used by status mapping tests.",
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
    keyFingerprintSuffix: "saf3",
    maskedFingerprint: "provider-key:saf3",
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
    keyFingerprintSuffix: "rpf3",
    maskedFingerprint: "provider-key:rpf3",
  }),
  revokeProviderKey: async (): Promise<ProviderSecretVaultOperationResult> => ({
    kind: "vault_provider_key_revoked",
    status: "revoked",
  }),
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

const startProviderSettingsApp = async (): Promise<{
  baseUrl: string;
  server: Server;
}> => {
  const app = express();
  app.use(express.json());
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      providerKeyRepository: new ActiveSummaryRepository(),
      providerKeysRuntimeEnabled: true,
      providerSecretVault: readyVault,
      routeAccessResolver: {
        resolve: async () => ({
          appUserId: "phase88-fix3-user",
          authProvider: "session",
          authSubject: "phase88-fix3-subject",
          kind: "authenticated",
          userId: "phase88-fix3-user",
          workspaceAuthority: "verified",
          workspaceId: "phase88-fix3-workspace",
          workspaceRole: "workspace_owner",
        }),
      },
      workspaceMembershipRepository: createMembershipRepository(),
    }),
  );
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
};

const jsonResponse = (payload: unknown, status = 200) => ({
  body: JSON.stringify(payload),
  contentType: "application/json",
  status,
});

const routePath = (pathname: string) => (url: URL): boolean =>
  url.pathname === pathname;

const setupBrowserBackend = async (page: Page) => {
  let active = true;
  const getConnection = () =>
    active ? toStoredConnection("openai", "uif3") : emptyOpenAiConnection;

  await page.route(routePath("/auth/session"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "authenticated_session",
        status: "authenticated",
        identity: {
          userId: "phase88-fix3-user",
          appUserId: "phase88-fix3-user",
          email: "phase88.fix3@example.invalid",
          workspaceId: "phase88-fix3-workspace",
          workspaceRole: "workspace_owner",
          workspaceAuthority: "verified",
        },
      }),
    );
  });

  await page.route(routePath("/provider-settings/catalog"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_catalog",
        message: "Supported providers are listed below.",
        providers: [
          {
            id: "openai",
            displayName: "OpenAI",
            capabilities: ["image_generation"],
            supportsByok: true,
            summary: "OpenAI BYOK status mapping smoke.",
            officialWebsite: "https://example.invalid/openai",
            docsUrl: "https://example.invalid/openai/docs",
            securityNote: "Keys are sent only to the backend.",
            costNote: "Provider costs are billed by the provider.",
            platformLimitNote: "Free AI Mixer credits are separate.",
            status: "available",
          },
        ],
      }),
    );
  });

  await page.route(routePath("/provider-settings/routing-policy"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_routing_policy",
        routingPreferences: {
          mode: "auto",
          recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
          recommendedImagePriority: ["openai", "stability", "google", "replicate"],
          fallback: { enabled: false, orderedProviderIds: [], requiresExplicitOptIn: true },
        },
      }),
    );
  });

  await page.route(routePath("/provider-settings/status"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_status",
        status: "authenticated",
        message: "Provider settings are available with redacted summaries.",
        activeWorkspaceId: "phase88-fix3-workspace",
        routingPreferences: {
          mode: "auto",
          recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
          recommendedImagePriority: ["openai", "stability", "google", "replicate"],
          fallback: { enabled: false, orderedProviderIds: [], requiresExplicitOptIn: true },
        },
        connections: [getConnection()],
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections/openai/test"), async (route) => {
    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connection_validation_result",
        status: "validated",
        message: "Validated by backend",
        connection: getConnection(),
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections/openai"), async (route) => {
    if (route.request().method() === "DELETE") {
      active = false;
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_connection_revoked",
          status: "revoked",
          message: "Provider key was revoked server-side.",
          connection: {
            ...emptyOpenAiConnection,
            maskedKeySummary: "Provider key was revoked server-side.",
          },
        }),
      );
      return;
    }

    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_connection_replaced",
        status: "replaced",
        message: "Provider key was replaced server-side.",
        connection: getConnection(),
      }),
    );
  });

  await page.route(routePath("/provider-settings/connections"), async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill(
        jsonResponse({
          kind: "provider_settings_connections",
          message: "Provider connection summaries are available.",
          connections: [getConnection()],
        }),
      );
      return;
    }

    await route.fulfill(
      jsonResponse({
        kind: "provider_settings_mutation_conflict",
        status: "conflict",
        message: "An active provider key already exists for this workspace/provider.",
      }, 409),
    );
  });
};

test.describe("phase88 BYOK hydrated active key status mapping", () => {
  test("hydrated active provider keys return stored status and safe validated metadata", async () => {
    const { baseUrl, server } = await startProviderSettingsApp();

    try {
      for (const pathname of [
        "/provider-settings/status",
        "/provider-settings/connections",
      ]) {
        const response = await fetch(`${baseUrl}${pathname}`);
        const text = await response.text();
        const payload = JSON.parse(text) as {
          connections: BackendRedactedProviderConnectionSummary[];
        };
        const openai = payload.connections.find(
          (connection) => connection.providerId === "openai",
        );
        const runway = payload.connections.find(
          (connection) => connection.providerId === "runway",
        );
        const google = payload.connections.find(
          (connection) => connection.providerId === "google",
        );
        const replicate = payload.connections.find(
          (connection) => connection.providerId === "replicate",
        );

        expect(response.status).toBe(200);
        expect(openai?.status).toBe("stored");
        expect(openai?.status).not.toBe("not_connected");
        expect(openai?.canManage).toBe(true);
        expect(openai?.verificationStatus).toBe("validated");
        expect(openai?.needsReverification).toBe(false);
        expect(runway?.status).toBe("stored");
        expect(google?.status).toBe("stored");
        expect(replicate?.status).toBe("not_connected");
        expectNoSecretLeak(text);
      }
    } finally {
      await stopServer(server);
    }
  });

  test("frontend treats hydrated stored status as active and remove works after rehydration", async ({
    page,
  }) => {
    await setupBrowserBackend(page);
    await page.goto("/settings/providers", { waitUntil: "load" });

    const keyForm = page.getByTestId("provider-key-form");

    await expect(
      keyForm.getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();
    await expect(
      keyForm.getByRole("button", { name: "Remove key", exact: true }),
    ).toBeEnabled();
    await expect(
      keyForm.getByRole("button", { name: "Validate stored key", exact: true }),
    ).toBeEnabled();
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Validated by backend",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Verification status: validated",
    );
    await expect(page.getByTestId("provider-key-redacted-summary")).toContainText(
      "Needs reverification: no",
    );

    await page
      .getByLabel("Primary navigation")
      .getByRole("button", { name: "Mixer", exact: true })
      .click();
    await page.getByTestId("account-menu-trigger").click();
    await page.getByRole("button", { name: "Provider Settings", exact: true }).click();

    await expect(
      keyForm.getByRole("button", { name: "Replace key", exact: true }),
    ).toBeVisible();
    await keyForm.getByRole("button", { name: "Remove key", exact: true }).click();
    await expect(page.getByTestId("provider-key-mutation-message")).toContainText(
      "Provider key was revoked server-side.",
    );

    await page.getByRole("button", { name: "Refresh provider settings" }).click();
    await expect(
      keyForm.getByRole("button", { name: "Save key", exact: true }),
    ).toBeVisible();
    await expect(
      keyForm.getByRole("button", { name: "Remove key", exact: true }),
    ).toBeDisabled();
    await expect(
      keyForm.getByRole("button", { name: "Store key before validation", exact: true }),
    ).toBeDisabled();

    const browserState = await page.evaluate(() =>
      JSON.stringify({
        cookie: document.cookie,
        href: window.location.href,
        localStorage: { ...window.localStorage },
        sessionStorage: { ...window.sessionStorage },
        visibleText: document.body.innerText,
      }),
    );
    expectNoSecretLeak(browserState);
  });

  test("source boundaries avoid fake connected wording provider SDKs and external calls", async () => {
    const backendContract = await readSource(
      "backend/contracts/providerSettingsHttpTypes.ts",
    );
    const frontendTypes = await readSource("src/types/providerSettings.ts");
    const repositorySource = await readSource(
      "backend/repositories/supabaseProviderKeyRepository.ts",
    );
    const routeSource = await readSource("backend/routes/providerSettings.ts");
    const pageSource = await readSource("src/pages/ProviderSettingsPage.tsx");
    const packageJson = readSourceSync("package.json");
    const combined = [
      backendContract,
      frontendTypes,
      repositorySource,
      routeSource,
      pageSource,
    ].join("\n");

    expect(backendContract).toContain('"stored"');
    expect(frontendTypes).toContain('"stored"');
    expect(repositorySource).toContain(
      'status: BackendProviderConnectionStatus = "stored"',
    );

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
      "Connected",
      "connected_success",
      "Verified provider",
      "verified_success",
      "Test passed",
      "test_passed",
      "Live provider ready",
      "Generation enabled",
    ]) {
      expect(combined).not.toContain(forbidden);
      expect(packageJson).not.toContain(forbidden);
    }
  });
});
