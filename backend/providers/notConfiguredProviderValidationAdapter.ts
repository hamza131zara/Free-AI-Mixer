import type {
  ProviderValidationAdapter,
  ProviderValidationReadiness,
  ProviderValidationResult,
  ValidateStoredProviderKeyInput,
} from "./providerValidationAdapter";

const unavailableMessage =
  "Provider validation is not configured yet. No provider API call was made.";

export const createNotConfiguredProviderValidationAdapter =
  (): ProviderValidationAdapter => ({
    getReadiness(): ProviderValidationReadiness {
      return {
        kind: "validation_unavailable",
        status: "not_configured",
        message: unavailableMessage,
      };
    },
    async validateStoredProviderKey(
      _input: ValidateStoredProviderKeyInput,
    ): Promise<ProviderValidationResult> {
      return {
        kind: "validation_unavailable",
        status: "not_configured",
        diagnosticCode: "validation_adapter_not_ready",
        errorCode: "validation_unavailable",
        failureCategory: "runtime_gate",
        message: unavailableMessage,
      };
    },
  });
