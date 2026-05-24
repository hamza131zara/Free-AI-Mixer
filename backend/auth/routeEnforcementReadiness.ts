export type RouteAccessFamily =
  | "public_read_only"
  | "auth_required"
  | "workspace_required"
  | "owner_admin_required"
  | "platform_admin_required";

export interface RouteEnforcementReadinessEntry {
  family: RouteAccessFamily;
  paths: string[];
}

export interface RouteEnforcementReadinessDecision {
  kind: "route_enforcement_rollout_planned";
  liveRouteGuardRolloutEnabled: false;
  routeFamilies: RouteEnforcementReadinessEntry[];
}

/**
 * Phase 17 route-enforcement rollout plan.
 *
 * This is documentation-as-contract only. It does not wire live route guards
 * or change current route behavior.
 */
export const resolveRouteEnforcementReadiness =
  (): RouteEnforcementReadinessDecision => ({
    kind: "route_enforcement_rollout_planned",
    liveRouteGuardRolloutEnabled: false,
    routeFamilies: [
      {
        family: "public_read_only",
        paths: [
          "/billing/plans",
          "/credits/policy",
          "/provider-settings/catalog",
          "/provider-settings/connections",
          "/provider-settings/routing-policy",
          "/templates/catalog",
          "/cards/catalog",
          "/ai-tools/catalog",
          "/ai-news/feed",
        ],
      },
      {
        family: "auth_required",
        paths: [
          "/auth/session",
          "/provider-settings/status",
          "/project-library/projects",
          "/project-library/history",
          "/credits/status",
        ],
      },
      {
        family: "workspace_required",
        paths: ["/project-library/projects", "/project-library/history", "/credits/status"],
      },
      {
        family: "owner_admin_required",
        paths: [
          "/provider-settings/connections",
          "/provider-settings/connections/:providerId",
          "/provider-settings/connections/:providerId/test",
          "/provider-settings/routing-policy",
        ],
      },
      {
        family: "platform_admin_required",
        paths: ["/admin/status"],
      },
    ],
  });
