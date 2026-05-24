import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import {
  createWorkspaceMembershipNotConfiguredRepository,
  decideWorkspaceMembershipAccess,
  type WorkspaceMembershipRepository,
} from "../auth/workspaceMembership";
import { decideRequesterContext } from "../auth/requesterContextDecision";
import {
  decideProviderKeyAuthorization,
  type ProviderKeyAction,
} from "../authorization/providerKeyAuthorization";
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
import { createNotConfiguredProviderSecretVault } from "../providers/notConfiguredProviderSecretVault";
import { getProviderCatalog } from "../providers/providerCatalog";
import type { ProviderSecretVault } from "../providers/providerSecretVault";

export interface CreateProviderSettingsRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  workspaceMembershipRepository?: WorkspaceMembershipRepository;
  providerSecretVault?: ProviderSecretVault;
}

type ProviderMutationBoundaryDecision =
  | {
      kind: "sign_in_required";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "mutation_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "secure_provider_key_storage_not_enabled"
        | "workspace_permission_not_verified";
      message: string;
    }
  | {
      kind: "forbidden";
      status: "workspace_owner_or_admin_required";
      message: string;
    };

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
    maskedKeySummary: "Secure provider key storage is not enabled yet.",
    lastValidationStatus: "not_enabled_yet" as const,
    verificationStatus: "not_enabled_yet" as const,
    needsReverification: false,
    canManage: false,
    unavailableReason: "secure_provider_key_storage_not_enabled" as const,
  }));

const respondMutationBoundaryDecision = (
  response: Response<BackendProviderConnectionMutationResponse>,
  decision: ProviderMutationBoundaryDecision,
): void => {
  if (decision.kind === "sign_in_required") {
    response.status(401).json({
      kind: "provider_settings_sign_in_required",
      status: "unauthenticated",
      reason: decision.reason,
      message: decision.message,
    });
    return;
  }

  if (decision.kind === "forbidden") {
    response.status(403).json({
      kind: "provider_settings_forbidden",
      status: decision.status,
      message: decision.message,
    });
    return;
  }

  response.status(503).json({
    kind: "provider_settings_mutation_unavailable",
    status: decision.status,
    message: decision.message,
  });
};

const getMutationUnavailableForAuthState = (
  request: Request,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): ProviderMutationBoundaryDecision | undefined => {
  const requesterDecision = decideRequesterContext(getRequesterContextFromRequest(request));

  if (requesterDecision.kind === "verified_authenticated") {
    return undefined;
  }

  if (
    requesterDecision.kind === "auth_not_configured" ||
    runtimeConfig.kind === "auth_provider_not_configured"
  ) {
    return {
      kind: "mutation_unavailable",
      status: "auth_not_configured",
      message: "Authentication is not configured on this backend yet.",
    };
  }

  return {
    kind: "sign_in_required",
    reason:
      requesterDecision.kind === "invalid_credentials"
        ? "invalid_credentials"
        : "missing_credentials",
    message: "Sign in is required before provider settings can be managed.",
  };
};

const authorizeMutationForWorkspace = async (
  request: Request,
  action: ProviderKeyAction,
  workspaceMembershipRepository: WorkspaceMembershipRepository,
): Promise<ProviderMutationBoundaryDecision | undefined> => {
  const requesterContext = getRequesterContextFromRequest(request);

  if (requesterContext.kind !== "authenticated" || !requesterContext.workspaceId) {
    return {
      kind: "mutation_unavailable",
      status: "workspace_permission_not_verified",
      message:
        "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase.",
    };
  }

  const membershipAccess = decideWorkspaceMembershipAccess(
    await workspaceMembershipRepository.getMembership({
      userId: requesterContext.userId,
      workspaceId: requesterContext.workspaceId,
    }),
  );

  if (membershipAccess.kind === "denied") {
    return {
      kind: "mutation_unavailable",
      status: "workspace_permission_not_verified",
      message:
        membershipAccess.reason === "membership_not_configured"
          ? "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase."
          : "Workspace membership could not be verified for provider key management in this phase.",
    };
  }

  const roleDecision = decideProviderKeyAuthorization({
    action,
    requesterContext,
    actorRole: membershipAccess.role,
  });

  if (roleDecision.kind === "allowed") {
    return undefined;
  }

  if (
    roleDecision.reason === "workspace_member_forbidden" ||
    roleDecision.reason === "workspace_viewer_forbidden"
  ) {
    return {
      kind: "forbidden",
      status: "workspace_owner_or_admin_required",
      message:
        "Workspace owner or workspace admin permission is required before provider keys can be managed.",
    };
  }

  return {
    kind: "mutation_unavailable",
    status: "workspace_permission_not_verified",
    message:
      "Workspace permission verification is not configured yet, so provider key management remains unavailable in this phase.",
  };
};

const createMutationHandler = (
  action: ProviderKeyAction,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  workspaceMembershipRepository: WorkspaceMembershipRepository,
  providerSecretVault: ProviderSecretVault,
) => {
  return (
    request: Request,
    response: Response<BackendProviderConnectionMutationResponse>,
    next: NextFunction,
  ): void => {
    void (async () => {
      const authBoundary = getMutationUnavailableForAuthState(request, runtimeConfig);

      if (authBoundary) {
        respondMutationBoundaryDecision(response, authBoundary);
        return;
      }

      const workspaceBoundary = await authorizeMutationForWorkspace(
        request,
        action,
        workspaceMembershipRepository,
      );

      if (workspaceBoundary) {
        respondMutationBoundaryDecision(response, workspaceBoundary);
        return;
      }

      const vaultReadiness = providerSecretVault.getVaultReadiness();

      respondMutationBoundaryDecision(response, {
        kind: "mutation_unavailable",
        status:
          vaultReadiness.kind === "vault_unavailable"
            ? "secure_provider_key_storage_not_enabled"
            : "secure_provider_key_storage_not_enabled",
        message:
          vaultReadiness.kind === "vault_unavailable"
            ? vaultReadiness.message
            : "Secure provider key storage is not enabled yet.",
      });
    })().catch(next);
  };
};

export const createProviderSettingsRouter = (
  options: CreateProviderSettingsRouterOptions,
): Router => {
  const router = Router();
  const workspaceMembershipRepository =
    options.workspaceMembershipRepository ??
    createWorkspaceMembershipNotConfiguredRepository();
  const providerSecretVault =
    options.providerSecretVault ?? createNotConfiguredProviderSecretVault();

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
    createMutationHandler(
      "add_provider_key",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
    ),
  );

  router.delete(
    "/provider-settings/connections/:providerId",
    createMutationHandler(
      "remove_provider_key",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
    ),
  );

  router.post(
    "/provider-settings/connections/:providerId/test",
    createMutationHandler(
      "test_provider_connection",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
    ),
  );

  router.put(
    "/provider-settings/routing-policy",
    createMutationHandler(
      "update_provider_routing_policy",
      options.runtimeConfig,
      workspaceMembershipRepository,
      providerSecretVault,
    ),
  );

  return router;
};
