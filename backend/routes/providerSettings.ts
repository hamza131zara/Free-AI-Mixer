import { Router } from "express";
import type { Response } from "express";
import type {
  BackendProviderCatalogResponse,
  BackendProviderRoutingPreferences,
  BackendProviderSettingsStatusResponse,
} from "../contracts/providerSettingsHttpTypes";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { getProviderCatalog } from "../providers/providerCatalog";

export interface CreateProviderSettingsRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

const defaultRoutingPreferences: BackendProviderRoutingPreferences = {
  mode: "auto",
  fallback: {
    enabled: false,
    orderedProviderIds: [],
  },
};

const resolveUnavailableStatus = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const resolveUnavailableMessage = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): string =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "Authentication is not configured on this backend yet."
    : "Provider settings are configured behind auth, but not available in this product phase.";

export const createProviderSettingsRouter = (
  options: CreateProviderSettingsRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/provider-settings/catalog",
    (_request, response: Response<BackendProviderCatalogResponse>) => {
      response.status(200).json({
        kind: "provider_catalog",
        message: "Supported providers are listed for future BYOK routing and capability planning.",
        providers: getProviderCatalog(),
      });
    },
  );

  router.get(
    "/provider-settings/status",
    (request, response: Response<BackendProviderSettingsStatusResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "provider_settings_status",
          status: "authenticated",
          message:
            "Provider settings foundation is available, but secure API key connection, real validation, and routing execution are not enabled yet.",
          activeWorkspaceId: requesterContext.workspaceId,
          routingPreferences: defaultRoutingPreferences,
          connections: getProviderCatalog().map((provider) => ({
            providerId: provider.id,
            status: "not_connected",
            maskedKeySummary: "Not connected yet",
            lastValidationStatus: "not_enabled_yet",
          })),
        });
        return;
      }

      if (requesterContext.reason === "auth_not_configured") {
        response.status(503).json({
          kind: "provider_settings_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        });
        return;
      }

      if (options.runtimeConfig.kind === "auth_provider_not_configured") {
        response.status(503).json({
          kind: "provider_settings_unavailable",
          status: "auth_not_configured",
          message: "Authentication is not configured on this backend yet.",
        });
        return;
      }

      response.status(401).json({
        kind: "provider_settings_sign_in_required",
        status: "unauthenticated",
        reason: requesterContext.reason,
        message: "Sign in is required before provider settings can be managed.",
      });
    },
  );

  return router;
};
