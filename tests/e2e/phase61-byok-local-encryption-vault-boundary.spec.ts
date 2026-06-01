import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { sanitizeSafeEventMetadata } from "../../backend/observability/safeEventSanitizer";
import {
  createLocalEncryptedProviderSecretVault,
  createLocalEncryptedProviderSecretVaultFromEnv,
} from "../../backend/providers/localEncryptedProviderSecretVault";
import type {
  ProviderSecretVaultEncryptedSecretHandle,
  ProviderSecretVaultOperationResult,
} from "../../backend/providers/providerSecretVault";
import {
  byokVaultEnvNames,
  parseProviderSecretVaultConfig,
  type ProviderSecretVaultEnv,
} from "../../backend/providers/providerSecretVaultConfig";

const fakeProviderKey = "FAKE_PHASE61_PROVIDER_KEY_DO_NOT_STORE";
const fakeReplacementKey = "FAKE_PHASE61_REPLACEMENT_KEY_DO_NOT_STORE";
const fakeProviderRawError = "FAKE_PHASE61_PROVIDER_RAW_ERROR_DO_NOT_RETURN";

const readSource = (relativePath: string): Promise<string> =>
  fs.readFile(path.join(process.cwd(), relativePath), "utf8");

const buildEnv = (
  overrides: ProviderSecretVaultEnv = {},
): ProviderSecretVaultEnv => {
  const keyVersion = "v1";

  return {
    [byokVaultEnvNames.enabled]: "1",
    [byokVaultEnvNames.provider]: "local_encrypted_payload",
    [byokVaultEnvNames.keyVersion]: keyVersion,
    [`${byokVaultEnvNames.keyPrefix}V1`]: Buffer.alloc(32, 61).toString("base64"),
    ...overrides,
  };
};

const expectNoRawSecret = (serialized: string): void => {
  for (const forbidden of [
    fakeProviderKey,
    fakeReplacementKey,
    fakeProviderRawError,
    "providerCredential",
    "provider_raw_error",
    "providerRawError",
    "service_role",
    "serviceRole",
    "secretRef",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
};

const expectEncryptedHandle = (
  result: ProviderSecretVaultOperationResult,
): ProviderSecretVaultEncryptedSecretHandle => {
  expect(result.kind).toBe("vault_provider_key_encrypted");

  if (result.kind !== "vault_provider_key_encrypted") {
    throw new Error("Expected encrypted result.");
  }

  expect(result.secretHandle.kind).toBe("encrypted_secret");
  expect(result.secretHandle.algorithm).toBe("aes-256-gcm");
  expect(result.secretHandle.keyVersion).toBe("v1");
  expect(result.secretHandle.encryptedPayload).toBeTruthy();
  expect(JSON.stringify(result)).not.toContain(fakeProviderKey);

  return result.secretHandle;
};

test.describe("phase61 local encrypted provider secret vault boundary", () => {
  test("config parser fails closed for missing or malformed backend-only env", () => {
    const cases: Array<{
      env: ProviderSecretVaultEnv;
      reason: ReturnType<typeof parseProviderSecretVaultConfig> extends infer Result
        ? Result extends { reason: infer Reason }
          ? Reason
          : never
        : never;
    }> = [
      { env: {}, reason: "vault_disabled" },
      { env: buildEnv({ [byokVaultEnvNames.enabled]: "0" }), reason: "vault_disabled" },
      { env: buildEnv({ [byokVaultEnvNames.provider]: "unknown" }), reason: "unknown_provider" },
      { env: buildEnv({ [byokVaultEnvNames.keyVersion]: "" }), reason: "missing_key_version" },
      { env: buildEnv({ [`${byokVaultEnvNames.keyPrefix}V1`]: undefined }), reason: "missing_key" },
      { env: buildEnv({ [`${byokVaultEnvNames.keyPrefix}V1`]: "not-valid-base64" }), reason: "invalid_base64_key" },
      { env: buildEnv({ [`${byokVaultEnvNames.keyPrefix}V1`]: Buffer.alloc(16, 61).toString("base64") }), reason: "invalid_key_length" },
      { env: buildEnv({ [byokVaultEnvNames.keyVersion]: "v2" }), reason: "missing_key" },
    ];

    for (const { env, reason } of cases) {
      expect(parseProviderSecretVaultConfig(env)).toMatchObject({
        kind: "not_configured",
        reason,
      });
      expect(createLocalEncryptedProviderSecretVaultFromEnv(env).getVaultReadiness()).toMatchObject({
        kind: "vault_unavailable",
        status: "not_configured",
      });
    }
  });

  test("valid config makes the vault ready without exposing env values", () => {
    const config = parseProviderSecretVaultConfig(buildEnv());
    const vault = createLocalEncryptedProviderSecretVault(config);

    expect(config).toMatchObject({
      kind: "configured",
      provider: "local_encrypted_payload",
      currentKeyVersion: "v1",
    });
    expect(vault.getVaultReadiness()).toEqual({ kind: "vault_ready" });
    expect(JSON.stringify(config)).not.toContain(fakeProviderKey);
  });

  test("encrypt and decrypt round-trip only with the correct authenticated payload", async () => {
    const vault = createLocalEncryptedProviderSecretVault(
      parseProviderSecretVaultConfig(buildEnv()),
    );
    const encrypted = await vault.encryptProviderKey({
      plaintextKey: fakeProviderKey,
      providerId: "openai",
      requesterUserId: "phase61-user",
      workspaceId: "phase61-workspace",
    });
    const secretHandle = expectEncryptedHandle(encrypted);
    const decrypted = await vault.decryptProviderKey({
      providerKeyId: "phase61-provider-key",
      secretHandle,
      workspaceId: "phase61-workspace",
    });

    expect(decrypted).toMatchObject({
      kind: "vault_provider_key_decrypted",
      status: "decrypted",
      plaintextKey: fakeProviderKey,
    });

    const wrongKeyVault = createLocalEncryptedProviderSecretVault(
      parseProviderSecretVaultConfig(
        buildEnv({
          [`${byokVaultEnvNames.keyPrefix}V1`]: Buffer.alloc(32, 62).toString("base64"),
        }),
      ),
    );
    const wrongKeyResult = await wrongKeyVault.decryptProviderKey({
      providerKeyId: "phase61-provider-key",
      secretHandle,
      workspaceId: "phase61-workspace",
    });

    expect(wrongKeyResult).toMatchObject({
      kind: "vault_decrypt_failed",
      status: "decrypt_failed",
    });
    expect(JSON.stringify(wrongKeyResult)).not.toContain(secretHandle.encryptedPayload);
    expect(JSON.stringify(wrongKeyResult)).not.toContain(fakeProviderKey);

    const tamperedResult = await vault.decryptProviderKey({
      providerKeyId: "phase61-provider-key",
      secretHandle: {
        ...secretHandle,
        encryptedPayload: `${secretHandle.encryptedPayload.slice(0, -2)}aa`,
      },
      workspaceId: "phase61-workspace",
    });

    expect(tamperedResult).toMatchObject({
      kind: "vault_decrypt_failed",
      status: "decrypt_failed",
    });
    expect(JSON.stringify(tamperedResult)).not.toContain(fakeProviderKey);
  });

  test("store rotate and revoke expose only internal encrypted handles or revoked result", async () => {
    const vault = createLocalEncryptedProviderSecretVault(
      parseProviderSecretVaultConfig(buildEnv()),
    );
    const stored = await vault.storeProviderKey({
      plaintextKey: fakeProviderKey,
      providerId: "openai",
      requesterUserId: "phase61-user",
      workspaceId: "phase61-workspace",
    });
    const rotated = await vault.rotateProviderKey({
      providerId: "openai",
      providerKeyId: "phase61-provider-key",
      replacementPlaintextKey: fakeReplacementKey,
      requesterUserId: "phase61-user",
      workspaceId: "phase61-workspace",
    });
    const revoked = await vault.revokeProviderKey({
      providerKeyId: "phase61-provider-key",
      requesterUserId: "phase61-user",
      workspaceId: "phase61-workspace",
    });
    const serialized = JSON.stringify([stored, rotated, revoked]);

    expect(stored).toMatchObject({
      kind: "vault_provider_key_stored",
      status: "stored",
      secretHandle: {
        kind: "encrypted_secret",
        algorithm: "aes-256-gcm",
        keyVersion: "v1",
      },
    });
    expect(rotated).toMatchObject({
      kind: "vault_provider_key_rotated",
      status: "replaced",
      secretHandle: {
        kind: "encrypted_secret",
        algorithm: "aes-256-gcm",
        keyVersion: "v1",
      },
    });
    expect(revoked).toEqual({
      kind: "vault_provider_key_revoked",
      status: "revoked",
    });
    expectNoRawSecret(serialized);
  });

  test("sanitizer redacts provider key crypto env and raw provider error fields", () => {
    const sanitized = sanitizeSafeEventMetadata({
      apiKey: fakeProviderKey,
      encryptedPayload: "encrypted-payload-placeholder",
      env: {
        FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1: "placeholder-only",
      },
      providerRawError: fakeProviderRawError,
      replacementPlaintextKey: fakeReplacementKey,
      secretRef: "secret-ref-placeholder",
      token: "header.payload.signature",
    });
    const serialized = JSON.stringify(sanitized);

    expect(sanitized.rejected).toBe(true);
    expect(sanitized.redactedFields).toEqual(
      expect.arrayContaining([
        "apiKey",
        "encryptedPayload",
        "env.FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1",
        "providerRawError",
        "replacementPlaintextKey",
        "secretRef",
        "token",
      ]),
    );
    expect(serialized).not.toContain(fakeProviderKey);
    expect(serialized).not.toContain(fakeReplacementKey);
    expect(serialized).not.toContain(fakeProviderRawError);
    expect(serialized).not.toContain("header.payload.signature");
  });

  test("provider settings routes remain fail closed and unwired to local encrypted vault", async () => {
    const providerSettingsRoute = await readSource("backend/routes/providerSettings.ts");
    const backendDependencies = await readSource("backend/composition/backendDependencies.ts");
    const appSource = await readSource("backend/app.ts");
    const combinedRuntime = `${providerSettingsRoute}\n${backendDependencies}\n${appSource}`;

    expect(providerSettingsRoute).toContain("createNotConfiguredProviderSecretVault");
    expect(providerSettingsRoute).toContain("secure_provider_key_storage_not_enabled");
    expect(backendDependencies).toContain("createLocalEncryptedProviderSecretVault");
    expect(backendDependencies).toContain("parseProviderSecretVaultConfig");
    expect(providerSettingsRoute).not.toContain("createLocalEncryptedProviderSecretVault");
    expect(providerSettingsRoute).not.toContain("parseProviderSecretVaultConfig");
    expect(providerSettingsRoute).not.toContain(".storeProviderKey(");
    expect(providerSettingsRoute).not.toContain(".rotateProviderKey(");
    expect(providerSettingsRoute).not.toContain(".decryptProviderKey(");
    expect(appSource).not.toContain(".storeProviderKey(");
    expect(combinedRuntime).not.toContain(".createProviderKey(");
  });

  test("frontend source remains free of key input browser storage provider SDK calls and fake state", async () => {
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

  test("phase61 docs describe backend-only local vault boundary and no-go items", async () => {
    const byokDoc = await readSource("docs/byok-provider-key-storage-strategy.md");
    const phases = await readSource("docs/phases.md");
    const roadmap = await readSource("docs/roadmap.md");
    const combinedDocs = `${byokDoc}\n${phases}\n${roadmap}`;

    expect(byokDoc).toContain("Phase 61 Local Encryption Vault Boundary");
    expect(byokDoc).toContain("AES-256-GCM");
    expect(byokDoc).toContain("FREE_AI_MIXER_BYOK_VAULT_ENABLED");
    expect(byokDoc).toContain("FREE_AI_MIXER_BYOK_VAULT_PROVIDER");
    expect(byokDoc).toContain("FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_VERSION");
    expect(byokDoc).toContain("FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1");
    expect(phases).toContain("Phase 61 - Backend BYOK Local Encryption Vault Boundary Pack");
    expect(roadmap).toContain("Phase 61 status");
    expect(combinedDocs).toContain("No frontend API key input");
    expect(combinedDocs).toContain("No provider SDK/API calls");
    expect(combinedDocs).not.toContain(fakeProviderKey);
    expect(combinedDocs).not.toContain(fakeReplacementKey);
  });
});
