import type {
  AdminAnalyticsReadinessSummary,
  AdminMetricCatalogSummary,
} from "./adminAnalytics";

export const platformRoles = [
  "platform_admin",
  "platform_moderator",
  "support_agent",
  "read_only_analyst",
] as const;

export type PlatformRole = (typeof platformRoles)[number];

export const workspaceScopedRoles = [
  "workspace_owner",
  "workspace_admin",
  "workspace_member",
] as const;

export type WorkspaceScopedRole = (typeof workspaceScopedRoles)[number];

export type AdminRoleReadinessStatus =
  | "auth_not_configured"
  | "sign_in_required"
  | "not_enabled_yet";

export interface AdminStatusSummary {
  status: AdminRoleReadinessStatus;
  message: string;
  noindexRequired: true;
  verifiedAdminSessionRequired: true;
  platformRolesConfigured: false;
  analyticsReadiness?: AdminAnalyticsReadinessSummary;
  metricCatalog?: AdminMetricCatalogSummary;
}
