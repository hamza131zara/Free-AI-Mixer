export type BackendSupportedProviderId =
  | "openai"
  | "runway"
  | "luma"
  | "google"
  | "stability"
  | "replicate";

export type BackendProviderCapability =
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

export type BackendProviderRoutingPreference = "manual" | "priority" | "auto";

export type BackendProviderConnectionStatus = "not_connected" | "unavailable";

export type BackendProviderValidationStatus =
  | "not_enabled_yet"
  | "not_validated"
  | "validation_unavailable"
  | "validation_failed"
  | "validated";

export type BackendProviderConnectionUnavailableReason =
  | "secure_provider_key_storage_not_enabled"
  | "workspace_permission_not_verified";

export interface BackendProviderCatalogEntry {
  id: BackendSupportedProviderId;
  displayName: string;
  capabilities: BackendProviderCapability[];
  supportsByok: true;
  summary: string;
  officialWebsite: string;
  docsUrl: string;
  securityNote: string;
  costNote: string;
  platformLimitNote: string;
  status: "available" | "planned" | "not_enabled";
}

export interface BackendProviderFallbackPreference {
  enabled: boolean;
  orderedProviderIds: BackendSupportedProviderId[];
  requiresExplicitOptIn: true;
}

export interface BackendProviderRoutingPreferences {
  mode: BackendProviderRoutingPreference;
  manualProviderId?: BackendSupportedProviderId;
  recommendedVideoPriority: BackendSupportedProviderId[];
  recommendedImagePriority: BackendSupportedProviderId[];
  fallback: BackendProviderFallbackPreference;
}

export interface BackendRedactedProviderConnectionSummary {
  providerId: BackendSupportedProviderId;
  status: BackendProviderConnectionStatus;
  maskedKeySummary?: string;
  maskedFingerprint?: string;
  keyFingerprintSuffix?: string;
  createdAt?: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  lastValidationStatus?: BackendProviderValidationStatus;
  verificationStatus?: BackendProviderValidationStatus;
  needsReverification?: boolean;
  managedByWorkspaceRole?: "workspace_owner" | "workspace_admin";
  canManage?: boolean;
  unavailableReason?: BackendProviderConnectionUnavailableReason;
}

export interface BackendProviderCatalogResponse {
  kind: "provider_catalog";
  message: string;
  providers: BackendProviderCatalogEntry[];
}

export interface BackendProviderConnectionsResponse {
  kind: "provider_settings_connections";
  message: string;
  connections: BackendRedactedProviderConnectionSummary[];
}

export interface BackendProviderRoutingPolicyResponse {
  kind: "provider_settings_routing_policy";
  message: string;
  routingPreferences: BackendProviderRoutingPreferences;
}

export type BackendProviderConnectionMutationResponse =
  | {
      kind: "provider_settings_mutation_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "secure_provider_key_storage_not_enabled"
        | "workspace_permission_not_verified";
      message: string;
    }
  | {
      kind: "provider_settings_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "provider_settings_forbidden";
      status: "workspace_owner_or_admin_required";
      message: string;
    };

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
      kind: "provider_settings_access_required";
      status: "workspace_required";
      message: string;
    }
  | {
      kind: "provider_settings_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured";
      message: string;
    };
