export type BackendGenerationFailureCode =
  | "auth_not_configured"
  | "auth_provider_unavailable"
  | "sign_in_required"
  | "generation_runtime_disabled"
  | "provider_not_supported"
  | "manual_provider_unavailable"
  | "fallback_disabled"
  | "vendor_calls_disabled"
  | "provider_key_not_configured";

export interface BackendGenerationFailureMapping {
  code: BackendGenerationFailureCode;
  message: string;
  httpStatus: 401 | 403 | 501 | 503;
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
};

export const getGenerationFailureMapping = (
  code: BackendGenerationFailureCode,
): BackendGenerationFailureMapping => generationFailureMappings[code];
