import type { BackendRequesterContext } from "../auth/requesterContext";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { decideAdminRouteGuard } from "./adminRouteGuards";

export type AdminReadinessStatus =
  | "auth_not_configured"
  | "sign_in_required"
  | "not_enabled_yet";

export interface AdminReadinessDecision {
  kind: "admin_status" | "admin_unavailable" | "admin_sign_in_required";
  status: AdminReadinessStatus;
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
}

export const resolveAdminReadiness = ({
  requesterContext,
  runtimeConfig,
}: {
  requesterContext: BackendRequesterContext;
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
}): AdminReadinessDecision => {
  if (
    requesterContext.kind === "unauthenticated" &&
    requesterContext.reason === "auth_not_configured"
  ) {
    return {
      kind: "admin_unavailable",
      status: "auth_not_configured",
      message: "Authentication is not configured on this backend yet.",
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformRolesConfigured: false,
    };
  }

  if (runtimeConfig.kind === "auth_provider_not_configured") {
    return {
      kind: "admin_unavailable",
      status: "auth_not_configured",
      message: "Authentication is not configured on this backend yet.",
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformRolesConfigured: false,
    };
  }

  if (requesterContext.kind !== "authenticated") {
    return {
      kind: "admin_sign_in_required",
      status: "sign_in_required",
      message: "A verified backend session is required before admin readiness can be reviewed.",
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformRolesConfigured: false,
    };
  }

  const routeGuardDecision = decideAdminRouteGuard({
    action: "view_admin_status",
    requesterContext,
    adminToolsEnabled: false,
  });

  if (routeGuardDecision.kind === "denied") {
    return {
      kind: "admin_status",
      status: "not_enabled_yet",
      message: routeGuardDecision.message,
      noindexRequired: true,
      verifiedAdminSessionRequired: true,
      platformRolesConfigured: false,
    };
  }

  return {
    kind: "admin_status",
    status: "not_enabled_yet",
    message:
      "Admin and moderator tools are not enabled yet. Platform role truth and privileged operational access remain backend-verified future work.",
    noindexRequired: true,
    verifiedAdminSessionRequired: true,
    platformRolesConfigured: false,
  };
};
