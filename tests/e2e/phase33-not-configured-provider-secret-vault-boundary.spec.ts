import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createNotConfiguredProviderSecretVault } from "../../backend/providers/notConfiguredProviderSecretVault";

const rawKey = "FAKE_PHASE33_PROVIDER_KEY_DO_NOT_STORE";
const replacementKey = "FAKE_PHASE33_REPLACEMENT_KEY_DO_NOT_STORE";

const unavailableOperation = {
  kind: "vault_operation_unavailable",
  status: "not_configured",
  message: "Secure provider key storage is not enabled yet.",
} as const;

const assertNoSecretOrSuccessLeakage = (value: unknown): void => {
  const serialized = JSON.stringify(value);

  expect(serialized).not.toContain(rawKey);
  expect(serialized).not.toContain(replacementKey);
  expect(serialized).not.toContain("encryptedPayload");
  expect(serialized).not.toContain("secretRef");
  expect(serialized).not.toContain("providerCredential");
  expect(serialized).not.toContain("connected");
  expect(serialized).not.toContain("verified");
  expect(serialized).not.toContain("providerAccount");
  expect(serialized).not.toContain("fake_success");
  expect(serialized).not.toContain("success");
};

test.describe("phase33 not-configured provider secret vault boundary", () => {
  test("readiness is unavailable and not configured", () => {
    const vault = createNotConfiguredProviderSecretVault();

    const readiness = vault.getVaultReadiness();

    expect(readiness).toEqual({
      kind: "vault_unavailable",
      status: "not_configured",
      message: "Secure provider key storage is not enabled yet.",
    });
    assertNoSecretOrSuccessLeakage(readiness);
  });

  test("all operations return unavailable and never echo secret inputs", async () => {
    const vault = createNotConfiguredProviderSecretVault();

    const results = [
      await vault.encryptProviderKey({
        providerId: "openai",
        workspaceId: "workspace-1",
        requesterUserId: "user-1",
        plaintextKey: rawKey,
      }),
      await vault.decryptProviderKey({
        providerKeyId: "provider-key-1",
        workspaceId: "workspace-1",
      }),
      await vault.storeProviderKey({
        providerId: "replicate",
        workspaceId: "workspace-1",
        requesterUserId: "user-1",
        plaintextKey: rawKey,
      }),
      await vault.revokeProviderKey({
        providerKeyId: "provider-key-1",
        workspaceId: "workspace-1",
        requesterUserId: "user-1",
      }),
      await vault.rotateProviderKey({
        providerKeyId: "provider-key-1",
        providerId: "luma",
        workspaceId: "workspace-1",
        requesterUserId: "user-1",
        replacementPlaintextKey: replacementKey,
      }),
    ];

    for (const result of results) {
      expect(result).toEqual(unavailableOperation);
      assertNoSecretOrSuccessLeakage(result);
    }
  });

  test("repeated calls are deterministic and fail closed", async () => {
    const vault = createNotConfiguredProviderSecretVault();

    const firstStore = await vault.storeProviderKey({
      providerId: "google",
      workspaceId: "workspace-1",
      requesterUserId: "user-1",
      plaintextKey: rawKey,
    });
    const secondStore = await vault.storeProviderKey({
      providerId: "google",
      workspaceId: "workspace-1",
      requesterUserId: "user-1",
      plaintextKey: replacementKey,
    });
    const firstReadiness = vault.getVaultReadiness();
    const secondReadiness = vault.getVaultReadiness();

    expect(firstStore).toEqual(unavailableOperation);
    expect(secondStore).toEqual(unavailableOperation);
    expect(firstReadiness).toEqual(secondReadiness);
    assertNoSecretOrSuccessLeakage([firstStore, secondStore, firstReadiness, secondReadiness]);
  });

  test("source boundary avoids routes frontend storage provider SDK fetch and logging", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "backend", "providers", "notConfiguredProviderSecretVault.ts"),
      "utf8",
    );

    expect(source).not.toContain("Router");
    expect(source).not.toContain("../routes");
    expect(source).not.toContain("../../src");
    expect(source).not.toContain("@supabase/");
    expect(source).not.toContain("createClient");
    expect(source).not.toContain("StorageClient");
    expect(source).not.toContain("@aws-sdk/");
    expect(source).not.toContain("@google-cloud/storage");
    expect(source).not.toContain("@azure/storage");
    expect(source).not.toContain(".storage");
    expect(source).not.toContain("storage.from");
    expect(source).not.toContain("bucket(");
    expect(source).not.toContain("openai");
    expect(source).not.toContain("replicate");
    expect(source).not.toContain("runway");
    expect(source).not.toContain("luma");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("console.");
    expect(source).not.toContain("logger");
  });
});
