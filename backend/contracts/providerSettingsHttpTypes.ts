export type BackendSupportedProviderId =
  | "openai"
  | "runway"
  | "luma"
  | "google"
  | "stability"
  | "replicate";

export type BackendProviderCapability =
  | "image_generation"
  | "video_generation"
  | "native_video_audio"
  | "text_to_speech"
  | "music_generation"
  | "sound_effects"
  | "upscale"
  | "template_generation_candidate";

export type BackendProviderRoutingPreference =
  | "manual"
  | "auto"
  | "cheapest"
  | "fastest"
  | "highest_quality";

export type BackendProviderConnectionStatus = "not_connected" | "unavailable";

export type BackendProviderValidationStatus =
  | "not_enabled_yet"
  | "not_validated"
  | "validation_unavailable";

export interface BackendProviderCatalogEntry {
  id: BackendSupportedProviderId;
  displayName: string;
  capabilities: BackendProviderCapability[];
  supportsByok: true;
  summary: string;
}

export interface BackendProviderFallbackPreference {
  enabled: boolean;
  orderedProviderIds: BackendSupportedProviderId[];
}

export interface BackendProviderRoutingPreferences {
  mode: BackendProviderRoutingPreference;
  manualProviderId?: BackendSupportedProviderId;
  fallback: BackendProviderFallbackPreference;
}

export interface BackendRedactedProviderConnectionSummary {
  providerId: BackendSupportedProviderId;
  status: BackendProviderConnectionStatus;
  maskedKeySummary?: string;
  lastValidationStatus?: BackendProviderValidationStatus;
}

export interface BackendProviderCatalogResponse {
  kind: "provider_catalog";
  message: string;
  providers: BackendProviderCatalogEntry[];
}

export type BackendProviderSettingsStatusResponse =
  | {
      kind: "provider_settings_status";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      routingPreferences: BackendProviderRoutingPreferences;
      connections: BackendRedactedProviderConnectionSummary[];
    }
  | {
      kind: "provider_settings_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "provider_settings_unavailable";
      status: "auth_not_configured" | "auth_provider_unavailable";
      message: string;
    };
