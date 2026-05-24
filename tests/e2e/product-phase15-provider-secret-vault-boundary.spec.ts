import { expect, test } from "@playwright/test";
import { createNotConfiguredProviderSecretVault } from "../../backend/providers/notConfiguredProviderSecretVault";

test.describe("product phase 15 provider secret vault boundary", () => {
  test("not-configured provider secret vault stays unavailable and never echoes plaintext", async () => {
    const vault = createNotConfiguredProviderSecretVault();
    const plaintextSecret = "sk-proj-phase15-secret-value";

    const readiness = vault.getVaultReadiness();
    const encryptResult = await vault.encryptProviderKey({
      providerId: "openai",
      workspaceId: "workspace_alpha",
      requesterUserId: "user_owner",
      plaintextKey: plaintextSecret,
    });
    const storeResult = await vault.storeProviderKey({
      providerId: "openai",
      workspaceId: "workspace_alpha",
      requesterUserId: "user_owner",
      plaintextKey: plaintextSecret,
    });
    const rotateResult = await vault.rotateProviderKey({
      providerKeyId: "provider_key_1",
      providerId: "openai",
      workspaceId: "workspace_alpha",
      requesterUserId: "user_owner",
      replacementPlaintextKey: plaintextSecret,
    });

    expect(readiness).toMatchObject({
      kind: "vault_unavailable",
      status: "not_configured",
    });
    expect(encryptResult).toMatchObject({
      kind: "vault_operation_unavailable",
      status: "not_configured",
    });
    expect(storeResult).toMatchObject({
      kind: "vault_operation_unavailable",
      status: "not_configured",
    });
    expect(rotateResult).toMatchObject({
      kind: "vault_operation_unavailable",
      status: "not_configured",
    });

    expect(JSON.stringify(readiness)).not.toContain(plaintextSecret);
    expect(JSON.stringify(encryptResult)).not.toContain(plaintextSecret);
    expect(JSON.stringify(storeResult)).not.toContain(plaintextSecret);
    expect(JSON.stringify(rotateResult)).not.toContain(plaintextSecret);
  });
});
