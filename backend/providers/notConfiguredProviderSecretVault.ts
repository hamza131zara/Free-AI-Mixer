import type {
  DecryptProviderKeyInput,
  EncryptProviderKeyInput,
  ProviderSecretVault,
  ProviderSecretVaultOperationResult,
  ProviderSecretVaultReadiness,
  RevokeProviderKeyInput,
  RotateProviderKeyInput,
  StoreProviderKeyInput,
} from "./providerSecretVault";

const unavailableMessage =
  "Secure provider key storage is not enabled yet.";

const unavailableReadiness = (): ProviderSecretVaultReadiness => ({
  kind: "vault_unavailable",
  status: "not_configured",
  message: unavailableMessage,
});

const unavailableOperationResult = (): ProviderSecretVaultOperationResult => ({
  kind: "vault_operation_unavailable",
  status: "not_configured",
  message: unavailableMessage,
});

const ignoreSensitiveInput = (..._inputs: unknown[]): ProviderSecretVaultOperationResult =>
  unavailableOperationResult();

export const createNotConfiguredProviderSecretVault = (): ProviderSecretVault => ({
  getVaultReadiness: unavailableReadiness,
  encryptProviderKey: async (input: EncryptProviderKeyInput) => ignoreSensitiveInput(input),
  decryptProviderKey: async (input: DecryptProviderKeyInput) => ignoreSensitiveInput(input),
  storeProviderKey: async (input: StoreProviderKeyInput) => ignoreSensitiveInput(input),
  revokeProviderKey: async (input: RevokeProviderKeyInput) => ignoreSensitiveInput(input),
  rotateProviderKey: async (input: RotateProviderKeyInput) => ignoreSensitiveInput(input),
});
