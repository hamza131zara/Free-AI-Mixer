import type {
  BackendProviderCatalogEntry,
  BackendProviderRoutingPreference,
  BackendSupportedProviderId,
} from "./providerSettingsHttpTypes";

export type BackendGenerationJobLifecycleState =
  | "rejected"
  | "submitted"
  | "running"
  | "generated_metadata_ready"
  | "artifact_storage_failed"
  | "delivery_unavailable"
  | "failed";

export interface BackendGenerationImageJobRequest {
  generationKind: "image";
  prompt: string;
  providerId: "openai";
  requestId: string;
}

export interface BackendGenerationMetadataOnlyArtifactResponse {
  artifactId: string;
  providerId: BackendSupportedProviderId;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  deliveryStatus: "unavailable";
}

export interface BackendGenerationRuntimeFallbackPolicy {
  enabled: boolean;
  orderedProviderIds: BackendSupportedProviderId[];
  requiresExplicitOptIn: true;
}

export interface BackendGenerationRuntimeRetryPolicy {
  maxSubmissionRetries: number;
  maxPollingRetries: number;
  retryableFailureCodes: string[];
}

export interface BackendGenerationRoutingDecisionPreview {
  selectedProviderId: BackendSupportedProviderId;
  mode: BackendProviderRoutingPreference;
  fallbackEnabled: boolean;
  orderedFallbackProviderIds: BackendSupportedProviderId[];
  selectsSingleProviderPerAttempt: true;
}

export interface BackendGenerationRuntimeSummary {
  executionState: "disabled_by_default";
  vendorCallsEnabled: false;
  routingPreferences: {
    mode: BackendProviderRoutingPreference;
    manualProviderId?: BackendSupportedProviderId;
    fallback: BackendGenerationRuntimeFallbackPolicy;
  };
  routingDecision: BackendGenerationRoutingDecisionPreview;
  retryPolicy: BackendGenerationRuntimeRetryPolicy;
  supportedProviders: Array<
    BackendProviderCatalogEntry & {
      executionState: "runtime_disabled";
    }
  >;
}

export interface BackendGenerationJobRuntimeSnapshot {
  executionState: BackendGenerationRuntimeSummary["executionState"];
  vendorCallsEnabled: boolean;
  routingPreferences: BackendGenerationRuntimeSummary["routingPreferences"];
  retryPolicy: BackendGenerationRuntimeSummary["retryPolicy"];
}

export type BackendGenerationRuntimeStatusResponse =
  | {
      kind: "generation_runtime_status";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      runtime: BackendGenerationRuntimeSummary;
    }
  | {
      kind: "generation_runtime_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "generation_runtime_unavailable";
      status: "auth_not_configured" | "auth_provider_unavailable";
      message: string;
    };

export interface BackendGenerationCatalogResponse {
  kind: "generation_provider_catalog";
  message: string;
  providers: BackendGenerationRuntimeSummary["supportedProviders"];
}

export type BackendGenerationJobMutationResponse =
  | {
      kind: "generation_job_rejected";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "unauthenticated"
        | "generation_runtime_disabled"
        | "generation_execution_blocked"
        | "generation_mock_execution_blocked"
        | "artifact_storage_unavailable"
        | "vault_decrypt_failed"
        | "generation_failed"
        | "invalid_credentials"
        | "invalid_prompt"
        | "invalid_provider"
        | "provider_unavailable"
        | "rate_limited"
        | "timeout"
        | "unsupported_generation_request"
        | "vendor_calls_disabled"
        | "workspace_permission_not_verified"
        | "workspace_owner_or_admin_required"
        | "provider_key_not_configured"
        | "rate_limit_not_configured"
        | "idempotency_not_configured"
        | "single_flight_not_configured"
        | "cost_controls_not_configured";
      message: string;
      runtime: BackendGenerationJobRuntimeSnapshot;
      attemptedProviderIds: BackendSupportedProviderId[];
    }
  | {
      kind: "generation_job_metadata_ready";
      status: "generated_metadata_ready";
      message: string;
      artifact: BackendGenerationMetadataOnlyArtifactResponse;
      runtime: BackendGenerationJobRuntimeSnapshot;
      attemptedProviderIds: BackendSupportedProviderId[];
    };
