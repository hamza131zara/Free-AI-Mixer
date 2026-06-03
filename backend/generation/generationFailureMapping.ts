export type BackendGenerationFailureCode =
  | "auth_not_configured"
  | "auth_provider_unavailable"
  | "sign_in_required"
  | "generation_runtime_disabled"
  | "artifact_storage_unavailable"
  | "generation_failed"
  | "provider_not_supported"
  | "manual_provider_unavailable"
  | "fallback_disabled"
  | "vendor_calls_disabled"
  | "provider_key_not_configured"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "invalid_prompt"
  | "vault_decrypt_failed";

export interface BackendGenerationFailureMapping {
  code: BackendGenerationFailureCode;
  message: string;
  httpStatus: 400 | 401 | 403 | 429 | 501 | 503 | 504;
  retryable: boolean;
  allowsFallback: boolean;
}

const generationFailureMappings: Record<
  BackendGenerationFailureCode,
  BackendGenerationFailureMapping
> = {
  auth_not_configured: {
    code: "auth_not_configured",
    message: "Authentication is not configured on this backend yet.",
    httpStatus: 503,
    retryable: false,
    allowsFallback: false,
  },
  auth_provider_unavailable: {
    code: "auth_provider_unavailable",
    message:
      "Authentication is configured but generation runtime access is not enabled in this product phase.",
    httpStatus: 501,
    retryable: false,
    allowsFallback: false,
  },
  sign_in_required: {
    code: "sign_in_required",
    message:
      "Sign in is required before backend generation runtime routes can show verified state.",
    httpStatus: 401,
    retryable: false,
    allowsFallback: false,
  },
  generation_runtime_disabled: {
    code: "generation_runtime_disabled",
    message:
      "Backend generation runtime boundaries are present, but live provider execution is disabled by default in this product phase.",
    httpStatus: 503,
    retryable: false,
    allowsFallback: false,
  },
  artifact_storage_unavailable: {
    code: "artifact_storage_unavailable",
    message:
      "Generated artifact storage is not configured, so provider generation cannot complete safely.",
    httpStatus: 503,
    retryable: false,
    allowsFallback: false,
  },
  generation_failed: {
    code: "generation_failed",
    message: "Provider generation failed with a sanitized backend error.",
    httpStatus: 503,
    retryable: false,
    allowsFallback: false,
  },
  provider_not_supported: {
    code: "provider_not_supported",
    message: "The selected provider is not supported by the current runtime boundary.",
    httpStatus: 403,
    retryable: false,
    allowsFallback: false,
  },
  manual_provider_unavailable: {
    code: "manual_provider_unavailable",
    message:
      "The requested manual provider is not available in the current runtime boundary.",
    httpStatus: 403,
    retryable: false,
    allowsFallback: false,
  },
  fallback_disabled: {
    code: "fallback_disabled",
    message:
      "Fallback is disabled by default and must be explicitly enabled before a second provider can be attempted.",
    httpStatus: 403,
    retryable: false,
    allowsFallback: false,
  },
  vendor_calls_disabled: {
    code: "vendor_calls_disabled",
    message:
      "External provider calls are disabled by default in this runtime boundary.",
    httpStatus: 503,
    retryable: false,
    allowsFallback: false,
  },
  provider_key_not_configured: {
    code: "provider_key_not_configured",
    message:
      "A verified backend-owned provider key is required before runtime execution can begin.",
    httpStatus: 403,
    retryable: false,
    allowsFallback: false,
  },
  provider_unavailable: {
    code: "provider_unavailable",
    message: "The selected provider is unavailable for generation.",
    httpStatus: 503,
    retryable: true,
    allowsFallback: true,
  },
  rate_limited: {
    code: "rate_limited",
    message: "Provider generation is rate limited.",
    httpStatus: 429,
    retryable: true,
    allowsFallback: false,
  },
  timeout: {
    code: "timeout",
    message: "Provider generation timed out.",
    httpStatus: 504,
    retryable: true,
    allowsFallback: true,
  },
  invalid_prompt: {
    code: "invalid_prompt",
    message: "Generation prompt is invalid or unsafe.",
    httpStatus: 400,
    retryable: false,
    allowsFallback: false,
  },
  vault_decrypt_failed: {
    code: "vault_decrypt_failed",
    message: "Stored provider key could not be decrypted for generation.",
    httpStatus: 503,
    retryable: false,
    allowsFallback: false,
  },
};

export const getGenerationFailureMapping = (
  code: BackendGenerationFailureCode,
): BackendGenerationFailureMapping => generationFailureMappings[code];
