import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { BackendSupportedProviderId } from "../contracts/providerSettingsHttpTypes";
import type {
  DecryptProviderKeyInput,
  EncryptProviderKeyInput,
  ProviderSecretVault,
  ProviderSecretVaultEncryptedSecretHandle,
  ProviderSecretVaultOperationResult,
  ProviderSecretVaultReadiness,
  RevokeProviderKeyInput,
  RotateProviderKeyInput,
  StoreProviderKeyInput,
} from "./providerSecretVault";
import {
  parseProviderSecretVaultConfig,
  type ProviderSecretVaultConfigDecision,
  type ProviderSecretVaultEnv,
  type ProviderSecretVaultLocalEncryptedPayloadConfig,
} from "./providerSecretVaultConfig";

const algorithm = "aes-256-gcm";
const payloadVersion = 1;
const unavailableMessage = "Secure provider key storage is not configured.";
const decryptFailedMessage = "Provider key could not be decrypted safely.";
const supportedProviderIds: ReadonlySet<BackendSupportedProviderId> = new Set([
  "openai",
  "runway",
  "luma",
  "google",
  "stability",
  "replicate",
]);

interface EncryptedPayloadEnvelope {
  version: 1;
  algorithm: typeof algorithm;
  keyVersion: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

const unavailableResult = (): ProviderSecretVaultOperationResult => ({
  kind: "vault_operation_unavailable",
  status: "not_configured",
  message: unavailableMessage,
});

const invalidProviderResult = (): ProviderSecretVaultOperationResult => ({
  kind: "vault_invalid_provider",
  status: "invalid_provider",
  message: "Unsupported provider.",
});

const decryptFailedResult = (): ProviderSecretVaultOperationResult => ({
  kind: "vault_decrypt_failed",
  status: "decrypt_failed",
  message: decryptFailedMessage,
});

const readinessForConfig = (
  config: ProviderSecretVaultConfigDecision,
): ProviderSecretVaultReadiness =>
  config.kind === "configured"
    ? { kind: "vault_ready" }
    : {
        kind: "vault_unavailable",
        status: "not_configured",
        message: unavailableMessage,
      };

const isSupportedProviderId = (
  providerId: BackendSupportedProviderId,
): boolean => supportedProviderIds.has(providerId);

const fingerprintKey = (
  plaintextKey: string,
): { maskedFingerprint: string; keyFingerprintSuffix: string } => {
  const digest = createHash("sha256").update(plaintextKey).digest("hex");

  return {
    maskedFingerprint: `sha256:${digest.slice(0, 12)}`,
    keyFingerprintSuffix: digest.slice(-4),
  };
};

const encodeEnvelope = (envelope: EncryptedPayloadEnvelope): string =>
  Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");

const decodeEnvelope = (
  encryptedPayload: string,
): EncryptedPayloadEnvelope | undefined => {
  try {
    const parsed = JSON.parse(
      Buffer.from(encryptedPayload, "base64url").toString("utf8"),
    ) as Partial<EncryptedPayloadEnvelope>;

    if (
      parsed.version !== payloadVersion ||
      parsed.algorithm !== algorithm ||
      typeof parsed.keyVersion !== "string" ||
      typeof parsed.iv !== "string" ||
      typeof parsed.tag !== "string" ||
      typeof parsed.ciphertext !== "string"
    ) {
      return undefined;
    }

    return parsed as EncryptedPayloadEnvelope;
  } catch {
    return undefined;
  }
};

const encryptPlaintextKey = (
  config: ProviderSecretVaultLocalEncryptedPayloadConfig,
  plaintextKey: string,
): ProviderSecretVaultEncryptedSecretHandle => {
  const iv = randomBytes(12);
  const key = config.keysByVersion.get(config.currentKeyVersion);

  if (!key) {
    throw new Error("Provider secret vault key configuration is unavailable.");
  }

  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintextKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    kind: "encrypted_secret",
    encryptedPayload: encodeEnvelope({
      version: payloadVersion,
      algorithm,
      keyVersion: config.currentKeyVersion,
      iv: iv.toString("base64url"),
      tag: tag.toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    }),
    keyVersion: config.currentKeyVersion,
    algorithm,
  };
};

const decryptSecretHandle = (
  config: ProviderSecretVaultLocalEncryptedPayloadConfig,
  handle: ProviderSecretVaultEncryptedSecretHandle,
): string | undefined => {
  if (handle.algorithm !== algorithm) {
    return undefined;
  }

  const envelope = decodeEnvelope(handle.encryptedPayload);

  if (!envelope) {
    return undefined;
  }

  const key = config.keysByVersion.get(envelope.keyVersion);

  if (!key) {
    return undefined;
  }

  try {
    const decipher = createDecipheriv(
      algorithm,
      key,
      Buffer.from(envelope.iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return undefined;
  }
};

export const createLocalEncryptedProviderSecretVault = (
  config: ProviderSecretVaultConfigDecision,
): ProviderSecretVault => ({
  getVaultReadiness: () => readinessForConfig(config),

  encryptProviderKey: async (
    input: EncryptProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> => {
    if (config.kind !== "configured") {
      return unavailableResult();
    }

    if (!isSupportedProviderId(input.providerId)) {
      return invalidProviderResult();
    }

    const secretHandle = encryptPlaintextKey(config, input.plaintextKey);

    return {
      kind: "vault_provider_key_encrypted",
      status: "encrypted",
      secretHandle,
      ...fingerprintKey(input.plaintextKey),
    };
  },

  decryptProviderKey: async (
    input: DecryptProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> => {
    if (config.kind !== "configured") {
      return unavailableResult();
    }

    if (!input.secretHandle || input.secretHandle.kind !== "encrypted_secret") {
      return decryptFailedResult();
    }

    const plaintextKey = decryptSecretHandle(config, input.secretHandle);

    if (!plaintextKey) {
      return decryptFailedResult();
    }

    return {
      kind: "vault_provider_key_decrypted",
      status: "decrypted",
      plaintextKey,
    };
  },

  storeProviderKey: async (
    input: StoreProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> => {
    const encrypted = await createLocalEncryptedProviderSecretVault(
      config,
    ).encryptProviderKey(input);

    if (encrypted.kind !== "vault_provider_key_encrypted") {
      return encrypted;
    }

    return {
      kind: "vault_provider_key_stored",
      status: "stored",
      secretHandle: encrypted.secretHandle,
      maskedFingerprint: encrypted.maskedFingerprint,
      keyFingerprintSuffix: encrypted.keyFingerprintSuffix,
    };
  },

  revokeProviderKey: async (
    _input: RevokeProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> => {
    if (config.kind !== "configured") {
      return unavailableResult();
    }

    return {
      kind: "vault_provider_key_revoked",
      status: "revoked",
    };
  },

  rotateProviderKey: async (
    input: RotateProviderKeyInput,
  ): Promise<ProviderSecretVaultOperationResult> => {
    if (config.kind !== "configured") {
      return unavailableResult();
    }

    if (!isSupportedProviderId(input.providerId)) {
      return invalidProviderResult();
    }

    const secretHandle = encryptPlaintextKey(config, input.replacementPlaintextKey);

    return {
      kind: "vault_provider_key_rotated",
      status: "replaced",
      secretHandle,
      ...fingerprintKey(input.replacementPlaintextKey),
    };
  },
});

export const createLocalEncryptedProviderSecretVaultFromEnv = (
  env: ProviderSecretVaultEnv = process.env,
): ProviderSecretVault =>
  createLocalEncryptedProviderSecretVault(parseProviderSecretVaultConfig(env));
