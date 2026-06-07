import type {
  BackendProviderCatalogEntry,
  BackendProviderRoutingPreference,
  BackendSupportedProviderId,
} from "../contracts/providerSettingsHttpTypes";

export type BackendGenerationProviderId = BackendSupportedProviderId;
export type BackendGenerationArtifactProviderId =
  | BackendGenerationProviderId
  | "mock_local";
export type BackendGenerationRoutingMode = BackendProviderRoutingPreference;

export interface BackendGenerationFallbackPolicy {
  enabled: boolean;
  orderedProviderIds: BackendGenerationProviderId[];
  requiresExplicitOptIn: true;
}

export interface BackendGenerationRoutingPreferences {
  mode: BackendGenerationRoutingMode;
  manualProviderId?: BackendGenerationProviderId;
  fallback: BackendGenerationFallbackPolicy;
}

export interface BackendGenerationRetryPolicy {
  maxSubmissionRetries: number;
  maxPollingRetries: number;
  retryableFailureCodes: string[];
}

export interface BackendGenerationProviderRuntimeEntry
  extends BackendProviderCatalogEntry {
  executionState: "runtime_disabled";
}

export const defaultGenerationFallbackPolicy: BackendGenerationFallbackPolicy = {
  enabled: false,
  orderedProviderIds: [],
  requiresExplicitOptIn: true,
};

export const defaultGenerationRoutingPreferences: BackendGenerationRoutingPreferences = {
  mode: "auto",
  fallback: defaultGenerationFallbackPolicy,
};

export const defaultGenerationRetryPolicy: BackendGenerationRetryPolicy = {
  maxSubmissionRetries: 0,
  maxPollingRetries: 0,
  retryableFailureCodes: [],
};
