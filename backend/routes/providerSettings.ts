import { Router } from "express";
import type { Response } from "express";
import type {
  BackendProviderCatalogResponse,
  BackendProviderConnectionMutationResponse,
  BackendProviderConnectionsResponse,
  BackendProviderRoutingPreferences,
  BackendProviderRoutingPolicyResponse,
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
  recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
  recommendedImagePriority: ["openai", "stability", "google", "replicate"],
  fallback: {
    enabled: false,
    orderedProviderIds: [],
    requiresExplicitOptIn: true,
  },
};

const buildConnectionSummaries = () =>
  getProviderCatalog().map((provider) => ({
    providerId: provider.id,
    status: "not_connected" as const,
    maskedKeySummary: "Secure API key connection is not enabled yet.",
    lastValidationStatus: "not_enabled_yet" as const,
  }));

const respondMutationUnavailable = (
  response: Response<BackendProviderConnectionMutationResponse>,
  requesterContext: ReturnType<typeof getRequesterContextFromRequest>,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): void => {
  if (requesterContext.kind === "authenticated") {
    response.status(503).json({
      kind: "provider_settings_mutation_unavailable",
      status: "secure_provider_key_storage_not_enabled",
      message:
        "Secure provider key storage is not enabled yet, so add, replace, remove, and test actions remain unavailable in this phase.",
    });
    return;
  }

  if (
    requesterContext.reason === "auth_not_configured" ||
    runtimeConfig.kind === "auth_provider_not_configured"
  ) {
    response.status(503).json({
      kind: "provider_settings_mutation_unavailable",
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
};

export const createProviderSettingsRouter = (
  options: CreateProviderSettingsRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/provider-settings/catalog",
    (_request, response: Response<BackendProviderCatalogResponse>) => {
      response.status(200).json({
        kind: "provider_catalog",
        message:
          "Supported BYOK providers are listed for future routing and capability planning. Provider balances remain separate from Free AI Mixer platform credits.",
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
          connections: buildConnectionSummaries(),
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

  router.get(
    "/provider-settings/connections",
    (request, response: Response<BackendProviderConnectionsResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "provider_settings_connections",
          message:
            "Connection summaries are metadata-only until secure backend provider key storage and verification are implemented.",
          connections: buildConnectionSummaries(),
        });
        return;
      }

      response.status(200).json({
        kind: "provider_settings_connections",
        message:
          "Connection summaries remain read-only and not_connected until verified auth and secure provider key storage are implemented.",
        connections: buildConnectionSummaries(),
      });
    },
  );

  router.get(
    "/provider-settings/routing-policy",
    (_request, response: Response<BackendProviderRoutingPolicyResponse>) => {
      response.status(200).json({
        kind: "provider_settings_routing_policy",
        message:
          "Routing policy remains metadata-only in this phase. Auto, manual, and priority routing stay single-provider-per-attempt, and fallback remains explicit opt-in only.",
        routingPreferences: defaultRoutingPreferences,
      });
    },
  );

  router.post(
    "/provider-settings/connections",
    (request, response: Response<BackendProviderConnectionMutationResponse>) => {
      respondMutationUnavailable(
        response,
        getRequesterContextFromRequest(request),
        options.runtimeConfig,
      );
    },
  );

  router.delete(
    "/provider-settings/connections/:providerId",
    (request, response: Response<BackendProviderConnectionMutationResponse>) => {
      respondMutationUnavailable(
        response,
        getRequesterContextFromRequest(request),
        options.runtimeConfig,
      );
    },
  );

  router.post(
    "/provider-settings/connections/:providerId/test",
    (request, response: Response<BackendProviderConnectionMutationResponse>) => {
      respondMutationUnavailable(
        response,
        getRequesterContextFromRequest(request),
        options.runtimeConfig,
      );
    },
  );

  router.put(
    "/provider-settings/routing-policy",
    (request, response: Response<BackendProviderConnectionMutationResponse>) => {
      respondMutationUnavailable(
        response,
        getRequesterContextFromRequest(request),
        options.runtimeConfig,
      );
    },
  );

  return router;
};
