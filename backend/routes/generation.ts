import { Router } from "express";
import type { Response } from "express";
import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import type {
  BackendGenerationCatalogResponse,
  BackendGenerationJobMutationResponse,
  BackendGenerationRuntimeStatusResponse,
} from "../contracts/generationRuntimeHttpTypes";
import { getProviderCatalog } from "../providers/providerCatalog";
import { getGenerationFailureMapping } from "../generation/generationFailureMapping";
import {
  defaultGenerationRetryPolicy,
  defaultGenerationRoutingPreferences,
} from "../generation/generationProviderTypes";
import { chooseGenerationProvider } from "../generation/generationRouting";

export interface CreateGenerationRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}

const resolveAuthUnavailableCode = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const toRuntimeProviders = () =>
  getProviderCatalog().map((provider) => ({
    ...provider,
    executionState: "runtime_disabled" as const,
  }));

const createRuntimeSummary = () => {
  const supportedProviders = toRuntimeProviders();

  return {
    executionState: "disabled_by_default" as const,
    vendorCallsEnabled: false as const,
    routingPreferences: defaultGenerationRoutingPreferences,
    routingDecision: chooseGenerationProvider({
      availableProviderIds: supportedProviders.map((provider) => provider.id),
      preferences: defaultGenerationRoutingPreferences,
    }),
    retryPolicy: defaultGenerationRetryPolicy,
    supportedProviders,
  };
};

export const createGenerationRouter = (
  options: CreateGenerationRouterOptions,
): Router => {
  const router = Router();

  router.get(
    "/generation/providers/catalog",
    (_request, response: Response<BackendGenerationCatalogResponse>) => {
      response.status(200).json({
        kind: "generation_provider_catalog",
        message:
          "Backend generation runtime uses the same provider IDs as the Phase 3 provider catalog, but execution remains disabled by default.",
        providers: toRuntimeProviders(),
      });
    },
  );

  router.get(
    "/generation/runtime-status",
    (request, response: Response<BackendGenerationRuntimeStatusResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);

      if (requesterContext.kind === "authenticated") {
        response.status(200).json({
          kind: "generation_runtime_status",
          status: "authenticated",
          message:
            "Backend generation runtime boundaries are present, but live provider execution is disabled by default in this product phase.",
          activeWorkspaceId: requesterContext.workspaceId,
          runtime: createRuntimeSummary(),
        });
        return;
      }

      if (requesterContext.reason === "auth_not_configured") {
        const failure = getGenerationFailureMapping("auth_not_configured");
        response.status(failure.httpStatus).json({
          kind: "generation_runtime_unavailable",
          status: "auth_not_configured",
          message: failure.message,
        });
        return;
      }

      if (options.runtimeConfig.kind === "auth_provider_not_configured") {
        const failure = getGenerationFailureMapping("auth_not_configured");
        response.status(failure.httpStatus).json({
          kind: "generation_runtime_unavailable",
          status: "auth_not_configured",
          message: failure.message,
        });
        return;
      }

      response.status(401).json({
        kind: "generation_runtime_sign_in_required",
        status: "unauthenticated",
        reason: requesterContext.reason,
        message:
          getGenerationFailureMapping("sign_in_required").message,
      });
    },
  );

  router.post(
    "/generation/jobs",
    (request, response: Response<BackendGenerationJobMutationResponse>) => {
      const requesterContext = getRequesterContextFromRequest(request);
      const runtimeSummary = createRuntimeSummary();

      if (requesterContext.kind === "authenticated") {
        const failure = getGenerationFailureMapping("generation_runtime_disabled");
        response.status(failure.httpStatus).json({
          kind: "generation_job_rejected",
          status: "generation_runtime_disabled",
          message: failure.message,
          runtime: {
            executionState: runtimeSummary.executionState,
            vendorCallsEnabled: runtimeSummary.vendorCallsEnabled,
            routingPreferences: runtimeSummary.routingPreferences,
            retryPolicy: runtimeSummary.retryPolicy,
          },
          attemptedProviderIds: [],
        });
        return;
      }

      const authUnavailableCode =
        requesterContext.reason === "auth_not_configured"
          ? "auth_not_configured"
          : resolveAuthUnavailableCode(options.runtimeConfig);

      if (
        requesterContext.reason === "auth_not_configured" ||
        options.runtimeConfig.kind === "auth_provider_not_configured"
      ) {
        const failure = getGenerationFailureMapping(authUnavailableCode);
        response.status(failure.httpStatus).json({
          kind: "generation_job_rejected",
          status: authUnavailableCode,
          message: failure.message,
          runtime: {
            executionState: runtimeSummary.executionState,
            vendorCallsEnabled: runtimeSummary.vendorCallsEnabled,
            routingPreferences: runtimeSummary.routingPreferences,
            retryPolicy: runtimeSummary.retryPolicy,
          },
          attemptedProviderIds: [],
        });
        return;
      }

      const failure = getGenerationFailureMapping("sign_in_required");
      response.status(failure.httpStatus).json({
        kind: "generation_job_rejected",
        status: "unauthenticated",
        message: failure.message,
        runtime: {
          executionState: runtimeSummary.executionState,
          vendorCallsEnabled: runtimeSummary.vendorCallsEnabled,
          routingPreferences: runtimeSummary.routingPreferences,
          retryPolicy: runtimeSummary.retryPolicy,
        },
        attemptedProviderIds: [],
      });
    },
  );

  return router;
};
