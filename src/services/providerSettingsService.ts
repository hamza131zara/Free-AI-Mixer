import type {
  ProviderCatalogResult,
  ProviderConnectionsResult,
  ProviderMutationAvailabilityResult,
  ProviderValidationMutationStatus,
  ProviderRoutingPreferences,
  ProviderRoutingPolicyResult,
  ProviderSettingsStatusResult,
  RedactedProviderConnectionSummary,
} from "../types/providerSettings";
import { fetchWithOptionalAccountBearer } from "./auth/authenticatedFetch";

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
      kind: "provider_settings_connection_stored";
      status: "stored";
      message?: string;
      connection: RedactedProviderConnectionSummary;
    }
  | {
      kind: "provider_settings_connection_replaced";
      status: "replaced";
      message?: string;
      connection: RedactedProviderConnectionSummary;
    }
  | {
      kind: "provider_settings_connection_revoked";
      status: "revoked";
      message?: string;
      connection: RedactedProviderConnectionSummary;
    }
  | {
      kind: "provider_settings_connection_validation_result";
      status: ProviderValidationMutationStatus;
      message?: string;
      connection?: RedactedProviderConnectionSummary;
    }
  | {
      kind: "provider_settings_mutation_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "provider_key_repository_unavailable"
        | "validation_unavailable"
        | "secure_provider_key_storage_not_enabled"
        | "workspace_permission_not_verified"
        | "vault_unavailable";
      message?: string;
    }
  | {
      kind: "provider_settings_invalid_request";
      status: "invalid_request";
      message?: string;
    }
  | {
      kind: "provider_settings_mutation_conflict";
      status: "conflict";
      message?: string;
    }
  | {
      kind: "provider_settings_connection_not_found";
      status: "not_found";
      message?: string;
    }
  | {
      kind: "provider_settings_invalid_provider";
      status: "invalid_provider";
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

const supportedProviderIds = new Set([
  "openai",
  "runway",
  "luma",
  "google",
  "stability",
  "replicate",
]);

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
    const response = await fetchWithOptionalAccountBearer(providerConnectionsEndpoint, {
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

    if (payload.kind === "provider_settings_mutation_unavailable") {
      return {
        kind: "mutation_unavailable",
        status: "unavailable",
        code: payload.status,
        message:
          payload.message ??
          "Secure provider key storage is not enabled yet, so this BYOK action remains unavailable.",
      };
    }

    return {
      kind: "mutation_unavailable",
      status: "unavailable",
      code: "secure_provider_key_storage_not_enabled",
      message:
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

const isSupportedProviderId = (providerId: string): boolean =>
  supportedProviderIds.has(providerId);

const mapMutationResponse = (
  payload: BackendProviderConnectionMutationResponse | undefined,
): ProviderMutationAvailabilityResult => {
  if (!payload) {
    return {
      kind: "mutation_unavailable",
      status: "unavailable",
      code: "secure_provider_key_storage_not_enabled",
      message:
        "Provider key storage returned an empty response. No key material was retained in the browser.",
    };
  }

  if (
    payload.kind === "provider_settings_connection_stored" ||
    payload.kind === "provider_settings_connection_replaced" ||
    payload.kind === "provider_settings_connection_revoked"
  ) {
    return {
      kind: "mutation_success",
      status: payload.status,
      message:
        payload.message ??
        "Provider key metadata was updated server-side. Provider validation is not enabled yet.",
      connection: payload.connection,
    };
  }

  if (payload.kind === "provider_settings_connection_validation_result") {
    return {
      kind: "validation_result",
      status: payload.status,
      message: getValidationResultMessage(payload.status, payload.message),
      connection: payload.connection,
    };
  }

  if (payload.kind === "provider_settings_sign_in_required") {
    return {
      kind: "sign_in_required",
      status: "unauthenticated",
      reason: payload.reason,
      message:
        payload.message ?? "Sign in is required before provider settings can be managed.",
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

  if (payload.kind === "provider_settings_mutation_conflict") {
    return {
      kind: "mutation_conflict",
      status: "conflict",
      message:
        payload.message ??
        "An active provider key already exists for this workspace/provider.",
    };
  }

  if (
    payload.kind === "provider_settings_invalid_request" ||
    payload.kind === "provider_settings_invalid_provider" ||
    payload.kind === "provider_settings_connection_not_found"
  ) {
    const fallbackMessage =
      payload.kind === "provider_settings_connection_not_found"
        ? "No active stored key found for this provider."
        : "Provider key metadata could not be updated with the current request.";

    return {
      kind:
        payload.kind === "provider_settings_invalid_request"
          ? "invalid_request"
          : payload.kind === "provider_settings_invalid_provider"
            ? "invalid_provider"
            : "not_found",
      status: payload.status,
      message:
        payload.kind === "provider_settings_connection_not_found"
          ? fallbackMessage
          : payload.message ?? fallbackMessage,
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
};

const getValidationResultMessage = (
  status: ProviderValidationMutationStatus,
  message?: string,
): string => {
  if (status === "validated") {
    return "Validated by backend";
  }

  if (status === "validation_failed") {
    return "Validation failed. Check the stored key or replace it.";
  }

  if (status === "validation_unavailable") {
    return "Provider validation is unavailable on this backend.";
  }

  if (status === "timeout") {
    return "Validation timed out. Try again later.";
  }

  if (status === "rate_limited") {
    return "Validation is rate limited. Wait before retrying.";
  }

  if (status === "provider_unavailable") {
    return "Provider validation endpoint is unavailable.";
  }

  if (status === "vault_decrypt_failed") {
    return "Stored key could not be validated safely. Replace the key.";
  }

  return message ?? "Provider validation is unavailable on this backend.";
};

const requestProviderConnectionMutation = async (
  endpoint: string,
  method: "POST" | "DELETE" | "PUT",
  body?: unknown,
): Promise<ProviderMutationAvailabilityResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(endpoint, {
      ...(body
        ? {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
          }
        : {}),
      credentials: "same-origin",
      method,
    });
    const payload = await parseJson<BackendProviderConnectionMutationResponse>(
      response,
    );

    return mapMutationResponse(payload);
  } catch {
    return {
      kind: "mutation_unavailable",
      status: "unavailable",
      code: "secure_provider_key_storage_not_enabled",
      message:
        "Provider key storage is currently unavailable. No key material was retained in the browser.",
    };
  }
};

export const saveProviderConnectionKey = async (
  providerId: string,
  apiKey: string,
): Promise<ProviderMutationAvailabilityResult> => {
  if (!isSupportedProviderId(providerId)) {
    return {
      kind: "invalid_provider",
      status: "invalid_provider",
      message: "Unsupported provider.",
    };
  }

  return requestProviderConnectionMutation(providerConnectionsEndpoint, "POST", {
    apiKey,
    providerId,
  });
};

export const replaceProviderConnectionKey = async (
  providerId: string,
  apiKey: string,
): Promise<ProviderMutationAvailabilityResult> => {
  if (!isSupportedProviderId(providerId)) {
    return {
      kind: "invalid_provider",
      status: "invalid_provider",
      message: "Unsupported provider.",
    };
  }

  return requestProviderConnectionMutation(
    `${providerConnectionsEndpoint}/${providerId}`,
    "PUT",
    { apiKey },
  );
};

export const revokeProviderConnectionKey = async (
  providerId: string,
): Promise<ProviderMutationAvailabilityResult> => {
  if (!isSupportedProviderId(providerId)) {
    return {
      kind: "invalid_provider",
      status: "invalid_provider",
      message: "Unsupported provider.",
    };
  }

  return requestProviderConnectionMutation(
    `${providerConnectionsEndpoint}/${providerId}`,
    "DELETE",
  );
};

export const testProviderConnectionKey = async (
  providerId: string,
): Promise<ProviderMutationAvailabilityResult> => {
  if (!isSupportedProviderId(providerId)) {
    return {
      kind: "invalid_provider",
      status: "invalid_provider",
      message: "Unsupported provider.",
    };
  }

  return requestProviderConnectionMutation(
    `${providerConnectionsEndpoint}/${providerId}/test`,
    "POST",
  );
};

export const getProviderSettingsStatus = async (): Promise<ProviderSettingsStatusResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(providerStatusEndpoint, {
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
