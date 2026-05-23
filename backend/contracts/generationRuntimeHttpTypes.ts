import type {
  BackendProviderCatalogEntry,
  BackendProviderRoutingPreference,
  BackendSupportedProviderId,
} from "./providerSettingsHttpTypes";

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
        | "generation_runtime_disabled";
      message: string;
      runtime: Pick<
        BackendGenerationRuntimeSummary,
        "executionState" | "vendorCallsEnabled" | "routingPreferences" | "retryPolicy"
      >;
      attemptedProviderIds: BackendSupportedProviderId[];
    };
