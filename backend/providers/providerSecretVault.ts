import type { BackendSupportedProviderId } from "../contracts/providerSettingsHttpTypes";

export interface EncryptProviderKeyInput {
  providerId: BackendSupportedProviderId;
  workspaceId: string;
  requesterUserId: string;
  plaintextKey: string;
}

export interface DecryptProviderKeyInput {
  providerKeyId: string;
  workspaceId: string;
}

export interface StoreProviderKeyInput {
  providerId: BackendSupportedProviderId;
  workspaceId: string;
  requesterUserId: string;
  plaintextKey: string;
}

export interface RevokeProviderKeyInput {
  providerKeyId: string;
  workspaceId: string;
  requesterUserId: string;
}

export interface RotateProviderKeyInput {
  providerKeyId: string;
  providerId: BackendSupportedProviderId;
  workspaceId: string;
  requesterUserId: string;
  replacementPlaintextKey: string;
}

export interface ProviderSecretVaultUnavailableReadiness {
  kind: "vault_unavailable";
  status: "not_configured";
  message: string;
}

export interface ProviderSecretVaultReadyReadiness {
  kind: "vault_ready";
}

export type ProviderSecretVaultReadiness =
  | ProviderSecretVaultUnavailableReadiness
  | ProviderSecretVaultReadyReadiness;

export interface ProviderSecretVaultUnavailableResult {
  kind: "vault_operation_unavailable";
  status: "not_configured";
  message: string;
}

export type ProviderSecretVaultOperationResult = ProviderSecretVaultUnavailableResult;

export interface ProviderSecretVault {
  getVaultReadiness(): ProviderSecretVaultReadiness;
  encryptProviderKey(
    input: EncryptProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult>;
  decryptProviderKey(
    input: DecryptProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult>;
  storeProviderKey(
    input: StoreProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult>;
  revokeProviderKey(
    input: RevokeProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult>;
  rotateProviderKey(
    input: RotateProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult>;
}
