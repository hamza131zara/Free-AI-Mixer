export type SupportedProviderId =
  | "openai"
  | "runway"
  | "luma"
  | "google"
  | "stability"
  | "replicate";

export type ProviderCapability =
  | "image_generation"
  | "image_editing"
  | "video_generation"
  | "image_to_video"
  | "text_to_video"
  | "video_to_video"
  | "audio_generation"
  | "text_to_speech"
  | "template_generation_candidate"
  | "card_generation_candidate"
  | "prompt_text_intelligence"
  | "model_marketplace";

export type ProviderRoutingPreference = "manual" | "priority" | "auto";

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
  officialWebsite: string;
  docsUrl: string;
  securityNote: string;
  costNote: string;
  platformLimitNote: string;
  status: "available" | "planned" | "not_enabled";
}

export interface ProviderFallbackPreference {
  enabled: boolean;
  orderedProviderIds: SupportedProviderId[];
  requiresExplicitOptIn: true;
}

export interface ProviderRoutingPreferences {
  mode: ProviderRoutingPreference;
  manualProviderId?: SupportedProviderId;
  recommendedVideoPriority: SupportedProviderId[];
  recommendedImagePriority: SupportedProviderId[];
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

export interface ProviderConnectionsResult {
  kind: "connections";
  message: string;
  connections: RedactedProviderConnectionSummary[];
}

export interface ProviderRoutingPolicyResult {
  kind: "routing_policy";
  message: string;
  routingPreferences: ProviderRoutingPreferences;
}

export type ProviderMutationAvailabilityResult =
  | {
      kind: "mutation_unavailable";
      status: "unavailable";
      code:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "secure_provider_key_storage_not_enabled";
      message: string;
    }
  | {
      kind: "sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    };

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
