export const byokVaultEnvNames = {
  enabled: "FREE_AI_MIXER_BYOK_VAULT_ENABLED",
  provider: "FREE_AI_MIXER_BYOK_VAULT_PROVIDER",
  keyVersion: "FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_VERSION",
  keyPrefix: "FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_",
} as const;

export interface ProviderSecretVaultLocalEncryptedPayloadConfig {
  kind: "configured";
  provider: "local_encrypted_payload";
  currentKeyVersion: string;
  keysByVersion: ReadonlyMap<string, Buffer>;
}

export interface ProviderSecretVaultConfigUnavailable {
  kind: "not_configured";
  reason:
    | "vault_disabled"
    | "unknown_provider"
    | "missing_key_version"
    | "missing_key"
    | "invalid_base64_key"
    | "invalid_key_length"
    | "missing_current_key";
  message: string;
}

export type ProviderSecretVaultConfigDecision =
  | ProviderSecretVaultLocalEncryptedPayloadConfig
  | ProviderSecretVaultConfigUnavailable;

export type ProviderSecretVaultEnv = Record<string, string | undefined>;

const unavailable = (
  reason: ProviderSecretVaultConfigUnavailable["reason"],
): ProviderSecretVaultConfigUnavailable => ({
  kind: "not_configured",
  reason,
  message: "Secure provider key storage is not configured.",
});

const normalizeKeyVersionForEnv = (keyVersion: string): string =>
  keyVersion.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();

const readKeyForVersion = (
  env: ProviderSecretVaultEnv,
  keyVersion: string,
): string | undefined =>
  env[`${byokVaultEnvNames.keyPrefix}${normalizeKeyVersionForEnv(keyVersion)}`];

const decodeBase64Key = (
  encoded: string,
): Buffer | undefined => {
  try {
    const decoded = Buffer.from(encoded, "base64");
    return decoded.toString("base64").replace(/=+$/, "") === encoded.replace(/=+$/, "")
      ? decoded
      : undefined;
  } catch {
    return undefined;
  }
};

export const parseProviderSecretVaultConfig = (
  env: ProviderSecretVaultEnv = process.env,
): ProviderSecretVaultConfigDecision => {
  if (env[byokVaultEnvNames.enabled] !== "1") {
    return unavailable("vault_disabled");
  }

  if (env[byokVaultEnvNames.provider] !== "local_encrypted_payload") {
    return unavailable("unknown_provider");
  }

  const currentKeyVersion = env[byokVaultEnvNames.keyVersion]?.trim();

  if (!currentKeyVersion) {
    return unavailable("missing_key_version");
  }

  const encodedKey = readKeyForVersion(env, currentKeyVersion);

  if (!encodedKey) {
    return unavailable("missing_key");
  }

  const decodedKey = decodeBase64Key(encodedKey);

  if (!decodedKey) {
    return unavailable("invalid_base64_key");
  }

  if (decodedKey.byteLength !== 32) {
    return unavailable("invalid_key_length");
  }

  const keysByVersion = new Map<string, Buffer>([
    [currentKeyVersion, decodedKey],
  ]);

  if (!keysByVersion.has(currentKeyVersion)) {
    return unavailable("missing_current_key");
  }

  return {
    kind: "configured",
    provider: "local_encrypted_payload",
    currentKeyVersion,
    keysByVersion,
  };
};
