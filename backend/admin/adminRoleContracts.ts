export const platformAdminRoles = [
  "platform_admin",
  "platform_moderator",
  "support_agent",
  "read_only_analyst",
] as const;

export type BackendPlatformRole = (typeof platformAdminRoles)[number];

export const workspaceScopedAdminRoles = [
  "workspace_owner",
  "workspace_admin",
  "workspace_member",
] as const;

export type BackendWorkspaceScopedRole = (typeof workspaceScopedAdminRoles)[number];

export const moderatorForbiddenCapabilities = [
  "raw_provider_api_keys",
  "service_role_credentials",
  "payment_secrets",
  "webhook_secrets",
  "signed_delivery_urls",
  "local_filesystem_paths",
  "unrestricted_ledger_mutation",
  "unrestricted_user_download_access",
  "platform_config_mutation",
] as const;

export type ModeratorForbiddenCapability =
  (typeof moderatorForbiddenCapabilities)[number];

export const getPlatformRoleCapabilities = (
  role: BackendPlatformRole,
): readonly string[] =>
  role === "platform_admin"
    ? [
        "moderation_review",
        "support_triage",
        "readiness_review",
        "platform_operations_readiness",
      ]
    : role === "platform_moderator"
      ? [
          "moderation_review",
          "support_triage",
        ]
      : role === "support_agent"
        ? [
            "support_triage",
          ]
        : [
            "analytics_read_only",
          ];

export const isPlatformRole = (
  role: string,
): role is BackendPlatformRole =>
  platformAdminRoles.includes(role as BackendPlatformRole);

export const isWorkspaceScopedAdminRole = (
  role: string,
): role is BackendWorkspaceScopedRole =>
  workspaceScopedAdminRoles.includes(role as BackendWorkspaceScopedRole);
