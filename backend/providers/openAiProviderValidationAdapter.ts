import type {
  BackendProviderKeyRecord,
  BackendProviderKeyRepository,
} from "../repositories/repositoryContracts";
import type {
  ProviderSecretVault,
  ProviderSecretVaultSecretHandle,
} from "./providerSecretVault";
import type {
  ProviderValidationAdapter,
  ProviderValidationReadiness,
  ProviderValidationResult,
  ValidateStoredProviderKeyInput,
} from "./providerValidationAdapter";

export interface OpenAiProviderValidationAdapterOptions {
  fetchImpl?: typeof fetch;
  now?: () => string;
  providerKeyRepository: BackendProviderKeyRepository;
  providerSecretVault: ProviderSecretVault;
  timeoutMs?: number;
}

const openAiModelsEndpoint = "https://api.openai.com/v1/models";
const defaultTimeoutMs = 5_000;

const defaultNow = (): string => new Date().toISOString();

const toSecretHandle = (
  record: BackendProviderKeyRecord,
): ProviderSecretVaultSecretHandle | undefined => {
  if (record.encryptedSecret) {
    return {
      kind: "encrypted_secret",
      algorithm: record.encryptedSecret.algorithm,
      encryptedPayload: record.encryptedSecret.encryptedPayload,
      keyVersion: record.encryptedSecret.keyVersion,
    };
  }

  if (record.secretRef) {
    return {
      kind: "external_secret_ref",
      keyVersion: "external-ref-v1",
      secretRef: record.secretRef,
    };
  }

  return undefined;
};

const timeoutResult = (): ProviderValidationResult => ({
  kind: "timeout",
  status: "timeout",
  diagnosticCode: "validation_timeout",
  errorCode: "timeout",
  failureCategory: "provider_timeout",
  message: "OpenAI provider validation timed out.",
});

const providerUnavailableResult = (
  diagnosticCode:
    | "validation_provider_5xx"
    | "validation_provider_fetch_failed",
): ProviderValidationResult => ({
  kind: "provider_unavailable",
  status: "provider_unavailable",
  diagnosticCode,
  errorCode: "provider_unavailable",
  failureCategory:
    diagnosticCode === "validation_provider_fetch_failed"
      ? "provider_network"
      : "provider_response",
  message: "OpenAI provider validation is unavailable.",
});

const validationFailedResult = (
  diagnosticCode:
    | "validation_invalid_credentials"
    | "validation_provider_unexpected_status",
): ProviderValidationResult => ({
  kind: "validation_failed",
  status: "validation_failed",
  diagnosticCode,
  errorCode:
    diagnosticCode === "validation_invalid_credentials"
      ? "invalid_credentials"
      : "validation_failed",
  failureCategory: "provider_response",
  message: "OpenAI provider validation failed.",
});

const vaultDecryptFailedResult = (): ProviderValidationResult => ({
  kind: "vault_decrypt_failed",
  status: "vault_decrypt_failed",
  diagnosticCode: "validation_vault_decrypt_failed",
  errorCode: "vault_decrypt_failed",
  failureCategory: "vault",
  message: "Stored provider key could not be decrypted for validation.",
});

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export const createOpenAiProviderValidationAdapter = ({
  fetchImpl = globalThis.fetch,
  now = defaultNow,
  providerKeyRepository,
  providerSecretVault,
  timeoutMs = defaultTimeoutMs,
}: OpenAiProviderValidationAdapterOptions): ProviderValidationAdapter => ({
  getReadiness(): ProviderValidationReadiness {
    if (typeof fetchImpl !== "function") {
      return {
        kind: "validation_unavailable",
        status: "not_configured",
        message: "OpenAI provider validation fetch runtime is unavailable.",
      };
    }

    if (providerSecretVault.getVaultReadiness().kind !== "vault_ready") {
      return {
        kind: "validation_unavailable",
        status: "not_configured",
        message: "OpenAI provider validation requires a configured backend vault.",
      };
    }

    return {
      kind: "validation_ready",
    };
  },

  async validateStoredProviderKey(
    input: ValidateStoredProviderKeyInput,
  ): Promise<ProviderValidationResult> {
    if (input.providerId !== "openai") {
      return {
        kind: "invalid_provider",
        status: "invalid_provider",
        diagnosticCode: "validation_provider_unexpected_status",
        errorCode: "invalid_provider",
        failureCategory: "provider_response",
        message: "OpenAI minimal validation supports only the OpenAI provider.",
      };
    }

    const record = await providerKeyRepository.getByProviderKeyId(
      input.providerKeyId,
    );

    if (
      !record ||
      record.workspaceId !== input.workspaceId ||
      record.providerName !== "openai" ||
      record.status !== "active" ||
      record.deletedAt
    ) {
      return {
        kind: "key_not_found",
        status: "key_not_found",
        diagnosticCode: "validation_key_not_found",
        errorCode: "key_not_found",
        failureCategory: "stored_key",
        message: "Active OpenAI provider key was not found for validation.",
      };
    }

    const secretHandle = toSecretHandle(record);

    if (!secretHandle) {
      return vaultDecryptFailedResult();
    }

    const decrypted = await providerSecretVault.decryptProviderKey({
      providerKeyId: record.providerKeyId,
      secretHandle,
      workspaceId: input.workspaceId,
    });

    if (decrypted.kind !== "vault_provider_key_decrypted") {
      return vaultDecryptFailedResult();
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(openAiModelsEndpoint, {
        headers: {
          Authorization: `Bearer ${decrypted.plaintextKey}`,
        },
        method: "GET",
        signal: controller.signal,
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          kind: "validated",
          status: "validated",
          verifiedAt: now(),
          message: "OpenAI provider key was validated by backend.",
        };
      }

      if (response.status === 401 || response.status === 403) {
        return validationFailedResult("validation_invalid_credentials");
      }

      if (response.status === 429) {
        return {
          kind: "rate_limited",
          status: "rate_limited",
          diagnosticCode: "validation_provider_rate_limited",
          errorCode: "rate_limited",
          failureCategory: "provider_response",
          message: "OpenAI provider validation is rate limited.",
        };
      }

      if (response.status >= 500) {
        return providerUnavailableResult("validation_provider_5xx");
      }

      return validationFailedResult("validation_provider_unexpected_status");
    } catch (error) {
      return isAbortError(error)
        ? timeoutResult()
        : providerUnavailableResult("validation_provider_fetch_failed");
    } finally {
      clearTimeout(timeout);
    }
  },
});
