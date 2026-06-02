import type {
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";
import type {
  ProviderValidationAdapter,
  ProviderValidationReadiness,
  ProviderValidationResult,
  ValidateStoredProviderKeyInput,
} from "./providerValidationAdapter";

export type MockProviderValidationOutcome =
  | "validated"
  | "validation_failed"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "invalid_provider"
  | "key_not_found"
  | "vault_decrypt_failed";

export interface MockProviderValidationAdapterOptions {
  outcomeByProviderId?: Partial<
    Record<BackendSupportedProviderId, MockProviderValidationOutcome>
  >;
  now?: () => string;
}

const defaultNow = (): string => new Date().toISOString();

const toResult = (
  outcome: MockProviderValidationOutcome,
  now: () => string,
): ProviderValidationResult => {
  if (outcome === "validated") {
    return {
      kind: "validated",
      status: "validated",
      verifiedAt: now(),
      message: "Provider key validation completed by local mock adapter.",
    };
  }

  if (outcome === "validation_failed") {
    return {
      kind: "validation_failed",
      status: "validation_failed",
      errorCode: "invalid_credentials",
      message: "Provider key validation failed in local mock adapter.",
    };
  }

  if (outcome === "rate_limited") {
    return {
      kind: "rate_limited",
      status: "rate_limited",
      errorCode: "rate_limited",
      retryAfterSeconds: 60,
      message: "Provider validation is rate limited in local mock adapter.",
    };
  }

  if (outcome === "timeout") {
    return {
      kind: "timeout",
      status: "timeout",
      errorCode: "timeout",
      message: "Provider validation timed out in local mock adapter.",
    };
  }

  if (outcome === "provider_unavailable") {
    return {
      kind: "provider_unavailable",
      status: "provider_unavailable",
      errorCode: "provider_unavailable",
      message: "Provider validation is unavailable in local mock adapter.",
    };
  }

  if (outcome === "invalid_provider") {
    return {
      kind: "invalid_provider",
      status: "invalid_provider",
      errorCode: "invalid_provider",
      message: "Unsupported provider for local mock validation.",
    };
  }

  if (outcome === "key_not_found") {
    return {
      kind: "key_not_found",
      status: "key_not_found",
      errorCode: "key_not_found",
      message: "Stored provider key was not found for local mock validation.",
    };
  }

  return {
    kind: "vault_decrypt_failed",
    status: "vault_decrypt_failed",
    errorCode: "vault_decrypt_failed",
    message: "Stored provider key could not be decrypted for local mock validation.",
  };
};

export const createMockProviderValidationAdapter = (
  options: MockProviderValidationAdapterOptions = {},
): ProviderValidationAdapter => {
  const now = options.now ?? defaultNow;

  return {
    getReadiness(): ProviderValidationReadiness {
      return {
        kind: "validation_ready",
      };
    },
    async validateStoredProviderKey(
      input: ValidateStoredProviderKeyInput,
    ): Promise<ProviderValidationResult> {
      const outcome = options.outcomeByProviderId?.[input.providerId] ?? "validated";

      return toResult(outcome, now);
    },
  };
};
