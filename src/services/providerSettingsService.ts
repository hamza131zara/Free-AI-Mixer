import type {
  ProviderCatalogResult,
  ProviderConnectionsResult,
  ProviderMutationAvailabilityResult,
  ProviderRoutingPreferences,
  ProviderRoutingPolicyResult,
  ProviderSettingsStatusResult,
  RedactedProviderConnectionSummary,
} from "../types/providerSettings";

interface BackendProviderCatalogResponse {
  kind: "provider_catalog";
  message?: string;
  providers: ProviderCatalogResult["providers"];
}

interface BackendProviderConnectionsResponse {
  kind: "provider_settings_connections";
  message?: string;
  connections: RedactedProviderConnectionSummary[];
}

interface BackendProviderRoutingPolicyResponse {
  kind: "provider_settings_routing_policy";
  message?: string;
  routingPreferences: ProviderRoutingPreferences;
}

interface BackendAuthenticatedProviderSettingsResponse {
  kind: "provider_settings_status";
  status: "authenticated";
  message?: string;
  activeWorkspaceId?: string;
  routingPreferences: ProviderRoutingPreferences;
  connections: RedactedProviderConnectionSummary[];
}

interface BackendUnauthenticatedProviderSettingsResponse {
  kind: "provider_settings_sign_in_required";
  status: "unauthenticated";
  reason: "missing_credentials" | "invalid_credentials";
  message?: string;
}

interface BackendUnavailableProviderSettingsResponse {
  kind: "provider_settings_unavailable";
  status:
    | "auth_not_configured"
    | "auth_provider_unavailable"
    | "workspace_runtime_not_configured";
  message?: string;
}

interface BackendForbiddenProviderSettingsResponse {
  kind: "provider_settings_access_required";
  status: "workspace_required";
  message?: string;
}

type BackendProviderSettingsResponse =
  | BackendAuthenticatedProviderSettingsResponse
  | BackendUnauthenticatedProviderSettingsResponse
  | BackendForbiddenProviderSettingsResponse
  | BackendUnavailableProviderSettingsResponse;

type BackendProviderConnectionMutationResponse =
  | {
      kind: "provider_settings_mutation_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "secure_provider_key_storage_not_enabled"
        | "workspace_permission_not_verified";
      message?: string;
    }
  | {
      kind: "provider_settings_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message?: string;
    }
  | {
      kind: "provider_settings_forbidden";
      status: "workspace_owner_or_admin_required";
      message?: string;
    };

const providerCatalogEndpoint = "/provider-settings/catalog";
const providerStatusEndpoint = "/provider-settings/status";
const providerConnectionsEndpoint = "/provider-settings/connections";
const providerRoutingPolicyEndpoint = "/provider-settings/routing-policy";

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

const toCatalogUnavailable = (message: string): ProviderCatalogResult => ({
  kind: "catalog",
  message,
  providers: [],
});

const toStatusUnavailable = (message: string): ProviderSettingsStatusResult => ({
  kind: "unavailable",
  status: "unavailable",
  code: "provider_settings_service_unreachable",
  message,
});

const toConnectionsUnavailable = (message: string): ProviderConnectionsResult => ({
  kind: "connections",
  message,
  connections: [],
});

const toRoutingPolicyUnavailable = (message: string): ProviderRoutingPolicyResult => ({
  kind: "routing_policy",
  message,
  routingPreferences: {
    mode: "auto",
    recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
    recommendedImagePriority: ["openai", "stability", "google", "replicate"],
    fallback: {
      enabled: false,
      orderedProviderIds: [],
      requiresExplicitOptIn: true,
    },
  },
});

const mapStatusResponse = (
  payload: BackendProviderSettingsResponse,
): ProviderSettingsStatusResult => {
  if (payload.kind === "provider_settings_status") {
    return {
      kind: "authenticated",
      status: "authenticated",
      message: payload.message ?? "Provider settings are available for this verified session.",
      activeWorkspaceId: payload.activeWorkspaceId,
      routingPreferences: payload.routingPreferences,
      connections: payload.connections,
    };
  }

  if (payload.kind === "provider_settings_sign_in_required") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: payload.reason,
      message: payload.message ?? "Sign in is required before provider settings can be managed.",
    };
  }

  if (payload.kind === "provider_settings_access_required") {
    return {
      kind: "forbidden",
      status: "forbidden",
      code: "workspace_required",
      message:
        payload.message ??
        "Workspace access is required before this page can show backend-owned data.",
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    code: payload.status,
    message:
      payload.message ??
      (payload.status === "auth_not_configured"
        ? "Authentication is not configured on this backend yet."
        : payload.status === "workspace_runtime_not_configured"
          ? "Workspace authority is not configured on this backend yet."
        : "Provider settings are configured behind auth, but not available in this product phase."),
  };
};

export const getProviderCatalog = async (): Promise<ProviderCatalogResult> => {
  try {
    const response = await fetch(providerCatalogEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProviderCatalogResponse>(response);

    if (!response.ok || !payload || payload.kind !== "provider_catalog") {
      return toCatalogUnavailable("Provider catalog is currently unavailable.");
    }

    return {
      kind: "catalog",
      message: payload.message ?? "Supported providers are listed below.",
      providers: payload.providers,
    };
  } catch {
    return toCatalogUnavailable("Provider catalog is currently unavailable.");
  }
};

export const getProviderConnections = async (): Promise<ProviderConnectionsResult> => {
  try {
    const response = await fetch(providerConnectionsEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProviderConnectionsResponse>(response);

    if (!response.ok || !payload || payload.kind !== "provider_settings_connections") {
      return toConnectionsUnavailable("Provider connection summaries are currently unavailable.");
    }

    return {
      kind: "connections",
      message:
        payload.message ??
        "Provider connection summaries remain metadata-only until secure backend key storage is implemented.",
      connections: payload.connections,
    };
  } catch {
    return toConnectionsUnavailable("Provider connection summaries are currently unavailable.");
  }
};

export const getProviderRoutingPolicy = async (): Promise<ProviderRoutingPolicyResult> => {
  try {
    const response = await fetch(providerRoutingPolicyEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProviderRoutingPolicyResponse>(response);

    if (!response.ok || !payload || payload.kind !== "provider_settings_routing_policy") {
      return toRoutingPolicyUnavailable("Provider routing policy metadata is currently unavailable.");
    }

    return {
      kind: "routing_policy",
      message:
        payload.message ??
        "Routing policy stays metadata-only until secure provider connection storage and runtime execution are ready.",
      routingPreferences: payload.routingPreferences,
    };
  } catch {
    return toRoutingPolicyUnavailable("Provider routing policy metadata is currently unavailable.");
  }
};

export const requestUnavailableProviderConnectionMutation = async (
  endpoint: string,
  method: "POST" | "DELETE" | "PUT",
): Promise<ProviderMutationAvailabilityResult> => {
  try {
    const response = await fetch(endpoint, {
      method,
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProviderConnectionMutationResponse>(response);

    if (!payload) {
      return {
        kind: "mutation_unavailable",
        status: "unavailable",
        code: "secure_provider_key_storage_not_enabled",
        message:
          "Secure provider key storage is not enabled yet, so this BYOK action remains unavailable.",
      };
    }

    if (payload.kind === "provider_settings_sign_in_required") {
      return {
        kind: "sign_in_required",
        status: "unauthenticated",
        reason: payload.reason,
        message: payload.message ?? "Sign in is required before provider settings can be managed.",
      };
    }

    if (payload.kind === "provider_settings_forbidden") {
      return {
        kind: "forbidden",
        status: "forbidden",
        code: payload.status,
        message:
          payload.message ??
          "Workspace owner or workspace admin permission is required before provider keys can be managed.",
      };
    }

    return {
      kind: "mutation_unavailable",
      status: "unavailable",
      code: payload.status,
      message:
        payload.message ??
        "Secure provider key storage is not enabled yet, so this BYOK action remains unavailable.",
    };
  } catch {
    return {
      kind: "mutation_unavailable",
      status: "unavailable",
      code: "secure_provider_key_storage_not_enabled",
      message:
        "Secure provider key storage is not enabled yet, so this BYOK action remains unavailable.",
    };
  }
};

export const getProviderSettingsStatus = async (): Promise<ProviderSettingsStatusResult> => {
  try {
    const response = await fetch(providerStatusEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProviderSettingsResponse>(response);

    if (!payload) {
      return toStatusUnavailable("Provider settings returned an empty response.");
    }

    return mapStatusResponse(payload);
  } catch {
    return toStatusUnavailable(
      "Provider settings are currently unavailable because the backend settings boundary could not be reached.",
    );
  }
};
