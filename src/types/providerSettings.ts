export type SupportedProviderId =
  | "openai"
  | "runway"
  | "luma"
  | "google"
  | "stability"
  | "replicate";

export type ProviderCapability =
  | "image_generation"
  | "video_generation"
  | "native_video_audio"
  | "text_to_speech"
  | "music_generation"
  | "sound_effects"
  | "upscale"
  | "template_generation_candidate";

export type ProviderRoutingPreference =
  | "manual"
  | "auto"
  | "cheapest"
  | "fastest"
  | "highest_quality";

export type ProviderConnectionStatus = "not_connected" | "unavailable";

export type ProviderValidationStatus =
  | "not_enabled_yet"
  | "not_validated"
  | "validation_unavailable";

export interface ProviderCatalogEntry {
  id: SupportedProviderId;
  displayName: string;
  capabilities: ProviderCapability[];
  supportsByok: true;
  summary: string;
}

export interface ProviderFallbackPreference {
  enabled: boolean;
  orderedProviderIds: SupportedProviderId[];
}

export interface ProviderRoutingPreferences {
  mode: ProviderRoutingPreference;
  manualProviderId?: SupportedProviderId;
  fallback: ProviderFallbackPreference;
}

export interface RedactedProviderConnectionSummary {
  providerId: SupportedProviderId;
  status: ProviderConnectionStatus;
  maskedKeySummary?: string;
  lastValidationStatus?: ProviderValidationStatus;
}

export interface ProviderCatalogResult {
  kind: "catalog";
  message: string;
  providers: ProviderCatalogEntry[];
}

export type ProviderSettingsStatusResult =
  | {
      kind: "authenticated";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      routingPreferences: ProviderRoutingPreferences;
      connections: RedactedProviderConnectionSummary[];
    }
  | {
      kind: "unauthenticated";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "unavailable";
      status: "unavailable";
      code:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "provider_settings_service_unreachable";
      message: string;
    };
