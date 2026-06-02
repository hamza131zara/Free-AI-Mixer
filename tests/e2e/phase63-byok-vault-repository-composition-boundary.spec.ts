import { expect, test } from "@playwright/test";
import express from "express";
import { promises as fs } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createRepositoryComposition } from "../../backend/composition/repositoryComposition";
import { createLocalEncryptedProviderSecretVault } from "../../backend/providers/localEncryptedProviderSecretVault";
import { createNotConfiguredProviderSecretVault } from "../../backend/providers/notConfiguredProviderSecretVault";
import {
  byokVaultEnvNames,
  parseByokProviderKeysRuntimeGate,
  parseProviderSecretVaultConfig,
} from "../../backend/providers/providerSecretVaultConfig";
import { parseSupabaseConfig } from "../../backend/config/supabaseConfig";
import type { ProviderSecretVault } from "../../backend/providers/providerSecretVault";
import type { BackendProviderKeyRepository } from "../../backend/repositories/repositoryContracts";
import type { WorkspaceMembershipRepository } from "../../backend/auth/workspaceMembership";
import { createProviderSettingsRouter } from "../../backend/routes/providerSettings";
import type { SupabaseClientFactory } from "../../backend/db/supabaseClientFactory";

const fakeRawKey = "FAKE_PHASE63_PROVIDER_KEY_DO_NOT_STORE";
const fakeEncryptedPayload = "FAKE_PHASE63_ENCRYPTED_PAYLOAD_DO_NOT_RETURN";
const fakeSecretRef = "FAKE_PHASE63_SECRET_REF_DO_NOT_RETURN";
const fakeProviderRawError = "FAKE_PHASE63_PROVIDER_RAW_ERROR_DO_NOT_RETURN";

const authConfiguredRuntime = {
  kind: "auth_provider_configured" as const,
  provider: "future_session_provider" as const,
};

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const buildByokEnv = (
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> => ({
  [byokVaultEnvNames.enabled]: "1",
  [byokVaultEnvNames.provider]: "local_encrypted_payload",
  [byokVaultEnvNames.keyVersion]: "v1",
  [`${byokVaultEnvNames.keyPrefix}V1`]: Buffer.alloc(32, 63).toString("base64"),
  ...overrides,
});

const buildVaultFromEnv = (
  env: Record<string, string | undefined>,
): ProviderSecretVault => {
  const config = parseProviderSecretVaultConfig(env);
  return config.kind === "configured"
    ? createLocalEncryptedProviderSecretVault(config)
    : createNotConfiguredProviderSecretVault();
};

const createFakeProviderKeyRepository = (): BackendProviderKeyRepository => ({
  getByProviderKeyId: async () => undefined,
  listForWorkspace: async () => [],
  createProviderKey: async () => ({
    kind: "unavailable",
    status: "unavailable",
    code: "repository_unavailable",
    message: "Repository is not live in this phase.",
  }),
  replaceProviderKey: async () => ({
    kind: "unavailable",
    status: "unavailable",
    code: "repository_unavailable",
    message: "Repository is not live in this phase.",
  }),
  revokeProviderKey: async () => ({
    kind: "unavailable",
    status: "unavailable",
    code: "repository_unavailable",
    message: "Repository is not live in this phase.",
  }),
});

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

const startProviderSettingsApp = async (options: {
  providerKeyRepository?: BackendProviderKeyRepository;
  providerKeysRuntimeEnabled?: boolean;
  providerSecretVault?: ProviderSecretVault;
}): Promise<{ baseUrl: string; server: Server }> => {
  const app = express();

  app.use(express.json());
  app.use((request, _response, next) => {
    (request as { backendRequesterContext?: unknown }).backendRequesterContext = {
      authProvider: "session",
      authSubject: "phase63-subject",
      kind: "authenticated",
      userId: "phase63-user",
      workspaceId: "phase63-workspace",
    };
    next();
  });
  app.use(
    createProviderSettingsRouter({
      runtimeConfig: authConfiguredRuntime,
      workspaceMembershipRepository: createMembershipRepository("owner"),
      ...options,
    }),
  );

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

const expectNoSecretLeak = (serialized: string): void => {
  for (const forbidden of [
    fakeRawKey,
    fakeEncryptedPayload,
    fakeSecretRef,
    fakeProviderRawError,
    "encryptedPayload",
    "secretRef",
    "providerCredential",
    "providerRawError",
    "provider_raw_error",
    "service_role",
    "iv",
    "ciphertext",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

test.describe("phase63 BYOK vault repository composition boundary", () => {
  test("repository composition exposes providerKeyRepository only when Supabase DB config is valid", () => {
    const disabledComposition = createRepositoryComposition(parseSupabaseConfig({}));
    expect(disabledComposition.kind).toBe("repository_composition_disabled");

    const invalidComposition = createRepositoryComposition(
      parseSupabaseConfig({
        FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
        FREE_AI_MIXER_DB_PROVIDER: "supabase",
      }),
    );
    expect(invalidComposition.kind).toBe("repository_composition_disabled");

    const validConfig = parseSupabaseConfig({
      FREE_AI_MIXER_ENABLE_SUPABASE_DB: "1",
      FREE_AI_MIXER_DB_PROVIDER: "supabase",
      FREE_AI_MIXER_SUPABASE_URL: "https://phase63.supabase.co",
      FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY: "phase63-service-role-placeholder",
    });
    const fakeClientFactory: SupabaseClientFactory = {
      kind: "supabase_client_factory",
      enabled: true,
      valid: true,
      runtime: "sdk_installed",
      publicConfig: {
        enabled: true,
        valid: true,
        dbProvider: "supabase",
        appMode: "local",
        projectUrl: "https://phase63.supabase.co",
      },
      createAdminClientHandle: () => ({
        kind: "supabase_admin_client_handle",
        runtime: "sdk_installed",
        projectUrl: "https://phase63.supabase.co",
        client: {} as never,
      }),
    };
    const availableComposition = createRepositoryComposition(
      validConfig,
      fakeClientFactory,
    );

    expect(availableComposition.kind).toBe("repository_composition_available");
    if (availableComposition.kind !== "repository_composition_available") {
      throw new Error("Expected available repository composition.");
    }

    const repositories = availableComposition.createRepositories();
    expect(repositories.providerKeyRepository).toBeTruthy();
    expect(repositories.providerKeyRepository.createProviderKey).toBeInstanceOf(Function);
    expect(repositories.workspaceMembershipRepository).toBeTruthy();
  });

  test("backend dependency source composes not-configured default and env-configured local vault without route liveness", async () => {
    const backendDependencies = await readSource("backend/composition/backendDependencies.ts");

    expect(backendDependencies).toContain("providerSecretVault");
    expect(backendDependencies).toContain("createNotConfiguredProviderSecretVault");
    expect(backendDependencies).toContain("createLocalEncryptedProviderSecretVault");
    expect(backendDependencies).toContain("parseProviderSecretVaultConfig");
    expect(backendDependencies).toContain("parseByokProviderKeysRuntimeGate");
    expect(backendDependencies).toContain("byokProviderKeysRuntimeGate");
    expect(backendDependencies).not.toContain(".storeProviderKey(");
    expect(backendDependencies).not.toContain(".rotateProviderKey(");
    expect(backendDependencies).not.toContain(".decryptProviderKey(");

    expect(buildVaultFromEnv({}).getVaultReadiness()).toMatchObject({
      kind: "vault_unavailable",
      status: "not_configured",
    });
    expect(buildVaultFromEnv(buildByokEnv()).getVaultReadiness()).toEqual({
      kind: "vault_ready",
    });
    expect(
      buildVaultFromEnv(
        buildByokEnv({
          [`${byokVaultEnvNames.keyPrefix}V1`]: "malformed",
        }),
      ).getVaultReadiness(),
    ).toMatchObject({
      kind: "vault_unavailable",
      status: "not_configured",
    });
  });

  test("explicit route-live gate is parsed and provider settings live wiring remains gated", async () => {
    expect(parseByokProviderKeysRuntimeGate({}).enabled).toBe(false);
    expect(
      parseByokProviderKeysRuntimeGate({
        [byokVaultEnvNames.providerKeysRuntimeEnabled]: "1",
      }).enabled,
    ).toBe(true);

    const providerSettingsRoute = await readSource("backend/routes/providerSettings.ts");
    const appSource = await readSource("backend/app.ts");

    expect(appSource).toContain("providerKeysRuntimeEnabled");
    expect(providerSettingsRoute).toContain("providerKeysRuntimeEnabled");
    expect(providerSettingsRoute).toContain("getLiveDependencies");
    expect(providerSettingsRoute).toContain("secure_provider_key_storage_not_enabled");
    expect(providerSettingsRoute).not.toContain("if (options.providerKeysRuntimeEnabled)");
    expect(providerSettingsRoute).toContain(".createProviderKey(");
    expect(providerSettingsRoute).toContain(".replaceProviderKey(");
    expect(providerSettingsRoute).toContain(".revokeProviderKey(");
    expect(providerSettingsRoute).not.toContain(".decryptProviderKey(");
  });

  test("provider settings mutation routes remain unavailable when route gate is off even with vault and repository dependencies", async () => {
    const { baseUrl, server } = await startProviderSettingsApp({
      providerKeyRepository: createFakeProviderKeyRepository(),
      providerKeysRuntimeEnabled: false,
      providerSecretVault: buildVaultFromEnv(buildByokEnv()),
    });

    try {
      const response = await fetch(`${baseUrl}/provider-settings/connections`, {
        body: JSON.stringify({
          apiKey: fakeRawKey,
          encryptedPayload: fakeEncryptedPayload,
          providerId: "openai",
          providerRawError: fakeProviderRawError,
          secretRef: fakeSecretRef,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const body = await response.text();

      expect(response.status).toBe(503);
      expect(body).toContain("secure_provider_key_storage_not_enabled");
      expectNoSecretLeak(body);
    } finally {
      await stopServer(server);
    }
  });

  test("frontend and runtime boundaries remain unchanged for pre-live BYOK composition", async () => {
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

  test("phase63 docs record composition boundary without live route mutation claims", async () => {
    const byokDoc = await readSource("docs/byok-provider-key-storage-strategy.md");
    const phases = await readSource("docs/phases.md");
    const roadmap = await readSource("docs/roadmap.md");
    const combinedDocs = `${byokDoc}\n${phases}\n${roadmap}`;

    expect(byokDoc).toContain("Phase 63 Vault/Repository Composition Boundary");
    expect(byokDoc).toContain("Provider key repository composition");
    expect(byokDoc).toContain("explicit route-live gate");
    expect(byokDoc).toContain("Provider Settings mutation routes remain unavailable");
    expect(phases).toContain("Phase 63 - BYOK Vault/Repository Composition Boundary Pack");
    expect(roadmap).toContain("Phase 63 status");
    expect(combinedDocs).toContain("No frontend API key input");
    expect(combinedDocs).toContain("No live route mutation behavior");
    expect(combinedDocs).toContain("No provider SDK/API calls");
    expect(combinedDocs).not.toContain(fakeRawKey);
    expect(combinedDocs).not.toContain(fakeEncryptedPayload);
    expect(combinedDocs).not.toContain(fakeSecretRef);
  });
});
