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
  secretHandle?: ProviderSecretVaultSecretHandle;
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

export interface ProviderSecretVaultEncryptedSecretHandle {
  kind: "encrypted_secret";
  encryptedPayload: string;
  keyVersion: string;
  algorithm: string;
}

export interface ProviderSecretVaultExternalSecretHandle {
  kind: "external_secret_ref";
  secretRef: string;
  keyVersion: string;
}

export type ProviderSecretVaultSecretHandle =
  | ProviderSecretVaultEncryptedSecretHandle
  | ProviderSecretVaultExternalSecretHandle;

export interface ProviderSecretVaultStoredResult {
  kind: "vault_provider_key_stored";
  status: "stored";
  secretHandle: ProviderSecretVaultSecretHandle;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
}

export interface ProviderSecretVaultEncryptedResult {
  kind: "vault_provider_key_encrypted";
  status: "encrypted";
  secretHandle: ProviderSecretVaultSecretHandle;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
}

export interface ProviderSecretVaultDecryptedResult {
  kind: "vault_provider_key_decrypted";
  status: "decrypted";
  plaintextKey: string;
}

export interface ProviderSecretVaultDecryptFailedResult {
  kind: "vault_decrypt_failed";
  status: "decrypt_failed";
  message: string;
}

export interface ProviderSecretVaultRevokedResult {
  kind: "vault_provider_key_revoked";
  status: "revoked";
}

export interface ProviderSecretVaultRotatedResult {
  kind: "vault_provider_key_rotated";
  status: "replaced";
  secretHandle: ProviderSecretVaultSecretHandle;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
}

export interface ProviderSecretVaultInvalidProviderResult {
  kind: "vault_invalid_provider";
  status: "invalid_provider";
  message: string;
}

export type ProviderSecretVaultOperationResult =
  | ProviderSecretVaultUnavailableResult
  | ProviderSecretVaultEncryptedResult
  | ProviderSecretVaultStoredResult
  | ProviderSecretVaultDecryptedResult
  | ProviderSecretVaultDecryptFailedResult
  | ProviderSecretVaultRevokedResult
  | ProviderSecretVaultRotatedResult
  | ProviderSecretVaultInvalidProviderResult;

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
