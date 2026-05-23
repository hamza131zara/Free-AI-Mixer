import type {
  ProviderCatalogResult,
  ProviderRoutingPreferences,
  ProviderSettingsStatusResult,
  RedactedProviderConnectionSummary,
} from "../types/providerSettings";

interface BackendProviderCatalogResponse {
  kind: "provider_catalog";
  message?: string;
  providers: ProviderCatalogResult["providers"];
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
  status: "auth_not_configured" | "auth_provider_unavailable";
  message?: string;
}

type BackendProviderSettingsResponse =
  | BackendAuthenticatedProviderSettingsResponse
  | BackendUnauthenticatedProviderSettingsResponse
  | BackendUnavailableProviderSettingsResponse;

const providerCatalogEndpoint = "/provider-settings/catalog";
const providerStatusEndpoint = "/provider-settings/status";

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

  return {
    kind: "unavailable",
    status: "unavailable",
    code: payload.status,
    message:
      payload.message ??
      (payload.status === "auth_not_configured"
        ? "Authentication is not configured on this backend yet."
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
