import type {
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";
import type {
  BackendProviderKeyValidationStateInput,
} from "../repositories/repositoryContracts";

export interface ProviderValidationReadinessUnavailable {
  kind: "validation_unavailable";
  status: "not_configured";
  message: string;
}

export interface ProviderValidationReadinessReady {
  kind: "validation_ready";
}

export type ProviderValidationReadiness =
  | ProviderValidationReadinessUnavailable
  | ProviderValidationReadinessReady;

export interface ValidateStoredProviderKeyInput {
  providerId: BackendSupportedProviderId;
  providerKeyId: string;
  requesterUserId?: string;
  workspaceId: string;
}

export type ProviderValidationSafeErrorCode =
  | "invalid_credentials"
  | "invalid_provider"
  | "key_not_found"
  | "provider_unavailable"
  | "rate_limited"
  | "timeout"
  | "validation_failed"
  | "validation_unavailable"
  | "vault_decrypt_failed";

export type ProviderValidationSafeDiagnosticCode =
  | "validation_adapter_not_ready"
  | "validation_invalid_credentials"
  | "validation_key_not_found"
  | "validation_provider_5xx"
  | "validation_provider_fetch_failed"
  | "validation_provider_rate_limited"
  | "validation_provider_unexpected_status"
  | "validation_timeout"
  | "validation_vault_decrypt_failed";

export type ProviderValidationSafeFailureCategory =
  | "provider_network"
  | "provider_response"
  | "provider_timeout"
  | "runtime_gate"
  | "stored_key"
  | "vault";

export interface ProviderValidationSafeDiagnostic {
  diagnosticCode: ProviderValidationSafeDiagnosticCode;
  failureCategory: ProviderValidationSafeFailureCategory;
}

export type ProviderValidationResult =
  | {
      kind: "validation_unavailable";
      status: "not_configured";
      errorCode: "validation_unavailable";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "validated";
      status: "validated";
      verifiedAt: string;
      message: string;
    }
  | {
      kind: "validation_failed";
      status: "validation_failed";
      errorCode: "invalid_credentials" | "validation_failed";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "provider_unavailable";
      status: "provider_unavailable";
      errorCode: "provider_unavailable";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "rate_limited";
      status: "rate_limited";
      errorCode: "rate_limited";
      retryAfterSeconds?: number;
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "timeout";
      status: "timeout";
      errorCode: "timeout";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "invalid_provider";
      status: "invalid_provider";
      errorCode: "invalid_provider";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "key_not_found";
      status: "key_not_found";
      errorCode: "key_not_found";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    }
  | {
      kind: "vault_decrypt_failed";
      status: "vault_decrypt_failed";
      errorCode: "vault_decrypt_failed";
      message: string;
      diagnosticCode?: ProviderValidationSafeDiagnosticCode;
      failureCategory?: ProviderValidationSafeFailureCategory;
    };

export interface ProviderValidationAdapter {
  getReadiness(): ProviderValidationReadiness;
  validateStoredProviderKey(
    input: ValidateStoredProviderKeyInput,
  ): Promise<ProviderValidationResult>;
}

const toValidationErrorCode = (
  result: Exclude<ProviderValidationResult, { kind: "validated" }>,
) => result.errorCode;

export const mapProviderValidationResultToStateInput = (
  result: ProviderValidationResult,
  input: {
    providerKeyId: string;
    requesterUserId: string;
    workspaceId: string;
  },
): BackendProviderKeyValidationStateInput => {
  if (result.kind === "validated") {
    return {
      providerKeyId: input.providerKeyId,
      workspaceId: input.workspaceId,
      requesterUserId: input.requesterUserId,
      verificationStatus: "validated",
      lastVerifiedAt: result.verifiedAt,
      lastVerificationErrorCode: undefined,
      needsReverification: false,
    };
  }

  return {
    providerKeyId: input.providerKeyId,
    workspaceId: input.workspaceId,
    requesterUserId: input.requesterUserId,
    verificationStatus:
      result.kind === "validation_failed" ? "validation_failed" : "needs_reverification",
    lastVerificationErrorCode: toValidationErrorCode(result),
    needsReverification: true,
  };
};
