import type { BackendGenerationAttemptMetadata } from "./generationAttemptMetadata";
import type { BackendGenerationFailureCode } from "./generationFailureMapping";
import type { BackendGenerationProviderId } from "./generationProviderTypes";

export type BackendGenerationKind = "image";

export type BackendGenerationProviderReadiness =
  | {
      kind: "generation_ready";
    }
  | {
      kind: "generation_unavailable";
      status: "not_configured";
      message: string;
    };

export interface BackendGenerationSubmitRequest {
  sceneId: string;
  prompt: string;
  style?: string;
  durationSeconds?: number;
  workspaceId?: string;
  userId: string;
  signal?: AbortSignal;
}

export interface BackendGenerationPollRequest {
  providerId: BackendGenerationProviderId;
  remoteJobId: string;
  workspaceId?: string;
  userId: string;
  signal?: AbortSignal;
}

export interface BackendGenerationStoredProviderKeyReference {
  providerId: BackendGenerationProviderId;
  providerKeyId: string;
  workspaceId: string;
}

export interface BackendGenerationImageDimensions {
  height: number;
  width: number;
}

export interface BackendGenerateImageFromStoredProviderKeyInput
  extends BackendGenerationStoredProviderKeyReference {
  generationKind: "image";
  jobId?: string;
  model?: string;
  prompt: string;
  requestId: string;
  signal?: AbortSignal;
  style?: string;
  dimensions?: BackendGenerationImageDimensions;
}

export type BackendGenerationSafeArtifactStorageState =
  | "not_stored"
  | "storage_unavailable"
  | "metadata_only";

export interface BackendGenerationSafeArtifactMetadata {
  artifactId: string;
  contentType?: "image/png" | "image/jpeg" | "image/webp";
  createdAt: string;
  generationKind: BackendGenerationKind;
  providerId: BackendGenerationProviderId;
  sha256?: string;
  sizeBytes?: number;
  status: "metadata_only";
  storageState: BackendGenerationSafeArtifactStorageState;
}

export type BackendGenerationSafeDiagnosticCode =
  | "artifact_storage_write_failed"
  | "artifact_verification_failed"
  | "provider_5xx"
  | "provider_empty_data"
  | "provider_fetch_failed"
  | "provider_malformed_json"
  | "provider_missing_b64_json"
  | "provider_response_shape_unsupported"
  | "provider_unexpected_status"
  | "provider_url_output_unsupported"
  | "real_provider_gate_missing"
  | "real_provider_storage_not_ready"
  | "vault_decrypt_failed"
  | "vault_not_ready";

export type BackendGenerationSafeFailureCategory =
  | "artifact_storage"
  | "provider_fetch"
  | "provider_response"
  | "provider_status"
  | "runtime_gate"
  | "vault";

export interface BackendGenerationSafeDiagnostic {
  diagnosticCode?: BackendGenerationSafeDiagnosticCode;
  failureCategory?: BackendGenerationSafeFailureCategory;
}

export type BackendGenerationProviderExecutionResult =
  | {
      kind: "generation_unavailable";
      status: "not_configured";
      errorCode: "generation_unavailable";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "generated";
      status: "generated";
      artifact: BackendGenerationSafeArtifactMetadata;
      message: string;
    }
  | {
      kind: "generation_failed";
      status: "generation_failed";
      errorCode: "generation_failed" | "invalid_credentials";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "provider_unavailable";
      status: "provider_unavailable";
      errorCode: "provider_unavailable";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "rate_limited";
      status: "rate_limited";
      errorCode: "rate_limited";
      retryAfterSeconds?: number;
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "timeout";
      status: "timeout";
      errorCode: "timeout";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "invalid_provider";
      status: "invalid_provider";
      errorCode: "invalid_provider";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "key_not_found";
      status: "key_not_found";
      errorCode: "key_not_found";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "vault_decrypt_failed";
      status: "vault_decrypt_failed";
      errorCode: "vault_decrypt_failed";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "invalid_prompt";
      status: "invalid_prompt";
      errorCode: "invalid_prompt";
      message: string;
    } & BackendGenerationSafeDiagnostic
  | {
      kind: "artifact_storage_unavailable";
      status: "artifact_storage_unavailable";
      errorCode: "artifact_storage_unavailable";
      message: string;
    } & BackendGenerationSafeDiagnostic;

export const generationRuntimeEnvNames = {
  allowRealProviderCalls: "FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS",
  providerAdapter: "FREE_AI_MIXER_GENERATION_PROVIDER_ADAPTER",
  runtimeEnabled: "FREE_AI_MIXER_GENERATION_RUNTIME_ENABLED",
} as const;

const generationProviderSafeErrorCodes = new Set<
  Exclude<BackendGenerationProviderExecutionResult, { kind: "generated" }>["errorCode"]
>([
  "artifact_storage_unavailable",
  "generation_failed",
  "generation_unavailable",
  "invalid_credentials",
  "invalid_prompt",
  "invalid_provider",
  "key_not_found",
  "provider_unavailable",
  "rate_limited",
  "timeout",
  "vault_decrypt_failed",
]);

export const isBackendGenerationSafeErrorCode = (
  value: string,
): value is Exclude<
  BackendGenerationProviderExecutionResult,
  { kind: "generated" }
>["errorCode"] => generationProviderSafeErrorCodes.has(value as never);

export type BackendGenerationProviderSubmitResult =
  | {
      kind: "submitted";
      remoteJobId: string;
      metadata: BackendGenerationAttemptMetadata;
    }
  | {
      kind: "failure";
      failureCode: BackendGenerationFailureCode;
      metadata: BackendGenerationAttemptMetadata;
    };

export type BackendGenerationProviderPollResult =
  | {
      kind: "pending";
      metadata: BackendGenerationAttemptMetadata;
    }
  | {
      kind: "success";
      metadata: BackendGenerationAttemptMetadata;
    }
  | {
      kind: "failure";
      failureCode: BackendGenerationFailureCode;
      metadata: BackendGenerationAttemptMetadata;
    };

export interface BackendGenerationProviderAdapter {
  readonly providerId: BackendGenerationProviderId;
  getReadiness?(): BackendGenerationProviderReadiness;
  generateImageFromStoredProviderKey?(
    request: BackendGenerateImageFromStoredProviderKeyInput,
  ): Promise<BackendGenerationProviderExecutionResult>;
  submit(
    request: BackendGenerationSubmitRequest,
  ): Promise<BackendGenerationProviderSubmitResult>;
  poll(
    request: BackendGenerationPollRequest,
  ): Promise<BackendGenerationProviderPollResult>;
}

export interface BackendGenerationProviderAdapterRegistry {
  get(
    providerId: BackendGenerationProviderId,
  ): BackendGenerationProviderAdapter | undefined;
  list(): BackendGenerationProviderAdapter[];
}
