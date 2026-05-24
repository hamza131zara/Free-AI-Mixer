import type { SafeEventMetadata } from "./safeEventSanitizer";

export type EventLogCategory =
  | "auth_account"
  | "workspace"
  | "byok_provider"
  | "admin_platform"
  | "product_usage"
  | "generation_export"
  | "credits_billing"
  | "storage_artifact"
  | "operational_error";

export type EventActorKind =
  | "anonymous"
  | "authenticated_user"
  | "workspace_member"
  | "platform_operator"
  | "system";

export type EventOutcome =
  | "attempted"
  | "succeeded"
  | "failed"
  | "denied"
  | "unavailable"
  | "not_configured";

export type EventSource =
  | "backend_route"
  | "backend_worker"
  | "backend_scheduler"
  | "backend_admin"
  | "frontend_opt_in_later";

export type EventLogType =
  | "login_attempted"
  | "login_succeeded"
  | "login_failed"
  | "signup_attempted"
  | "session_refreshed"
  | "logout"
  | "workspace_created"
  | "workspace_member_invited"
  | "workspace_member_role_changed"
  | "workspace_member_removed"
  | "active_workspace_changed"
  | "provider_key_add_attempted"
  | "provider_key_added"
  | "provider_key_replaced"
  | "provider_key_revoked"
  | "provider_key_test_attempted"
  | "provider_verification_failed"
  | "routing_policy_changed"
  | "admin_status_viewed"
  | "admin_analytics_viewed"
  | "platform_role_changed"
  | "moderator_action"
  | "support_action"
  | "page_viewed"
  | "onboarding_step_completed"
  | "template_selected"
  | "card_template_edited"
  | "provider_settings_viewed"
  | "generation_job_submitted"
  | "provider_selected"
  | "provider_failed"
  | "generation_succeeded"
  | "generation_failed"
  | "export_submitted"
  | "render_started"
  | "render_succeeded"
  | "render_failed"
  | "artifact_access_requested"
  | "credits_reserved"
  | "credits_settled"
  | "credits_released"
  | "subscription_checkout_started"
  | "subscription_changed"
  | "payment_failed"
  | "artifact_stored"
  | "artifact_access_generated"
  | "artifact_expired"
  | "cleanup_succeeded"
  | "cleanup_failed"
  | "operational_error_detected";

export interface FutureEventLogEntry {
  eventType: EventLogType;
  category: EventLogCategory;
  displayName: string;
  description: string;
  safeToEmitNow: false;
  requiredPrerequisites: string[];
  reasonUnavailable: string;
}

export interface SafeEventEnvelope {
  eventId: string;
  eventType: EventLogType;
  occurredAt: string;
  actorKind: EventActorKind;
  actorUserId?: string;
  workspaceId?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  outcome: EventOutcome;
  source: EventSource;
  requestId?: string;
  failureCode?: string;
  metadata: SafeEventMetadata;
}

export interface EventLogTaxonomySummary {
  kind: "event_log_taxonomy";
  liveEventEmissionEnabled: false;
  persistenceEnabled: false;
  routeHooksEnabled: false;
  workerHooksEnabled: false;
  creditAndBillingSeparated: true;
  entries: FutureEventLogEntry[];
}

const futureOnly = (
  eventType: EventLogType,
  category: EventLogCategory,
  displayName: string,
  description: string,
  requiredPrerequisites: string[],
  reasonUnavailable: string,
): FutureEventLogEntry => ({
  eventType,
  category,
  displayName,
  description,
  safeToEmitNow: false,
  requiredPrerequisites,
  reasonUnavailable,
});

export const resolveEventLogTaxonomy = (): EventLogTaxonomySummary => ({
  kind: "event_log_taxonomy",
  liveEventEmissionEnabled: false,
  persistenceEnabled: false,
  routeHooksEnabled: false,
  workerHooksEnabled: false,
  creditAndBillingSeparated: true,
  entries: [
    futureOnly(
      "login_attempted",
      "auth_account",
      "Login attempted",
      "Future auth analytics event for real sign-in attempts.",
      ["verified auth runtime"],
      "Auth runtime is not enabled yet.",
    ),
    futureOnly(
      "workspace_created",
      "workspace",
      "Workspace created",
      "Future workspace lifecycle event.",
      ["real auth/workspace truth"],
      "Workspace creation runtime is not enabled yet.",
    ),
    futureOnly(
      "provider_key_added",
      "byok_provider",
      "Provider key added",
      "Future BYOK provider event.",
      ["verified auth", "workspace truth", "BYOK vault/storage"],
      "BYOK vault and verified workspace identity are not enabled yet.",
    ),
    futureOnly(
      "admin_analytics_viewed",
      "admin_platform",
      "Admin analytics viewed",
      "Future platform admin visibility event.",
      ["verified platform_admin auth", "admin analytics runtime"],
      "Platform-admin enforcement and analytics runtime are not enabled yet.",
    ),
    futureOnly(
      "page_viewed",
      "product_usage",
      "Page viewed",
      "Future product usage analytics event.",
      ["privacy review", "consented analytics collection"],
      "Frontend/backend analytics collection is not enabled yet.",
    ),
    futureOnly(
      "generation_succeeded",
      "generation_export",
      "Generation succeeded",
      "Future generation lifecycle event that must match a real runtime result.",
      ["generation runtime truth"],
      "Generation runtime truth is not enabled yet.",
    ),
    futureOnly(
      "credits_settled",
      "credits_billing",
      "Credits settled",
      "Future credits event that must match the real ledger.",
      ["credit ledger runtime"],
      "Credit ledger runtime is not enabled yet.",
    ),
    futureOnly(
      "artifact_stored",
      "storage_artifact",
      "Artifact stored",
      "Future artifact storage event.",
      ["storage provider runtime"],
      "Storage provider runtime is not enabled yet.",
    ),
    futureOnly(
      "operational_error_detected",
      "operational_error",
      "Operational error detected",
      "Future structured operational signal for real runtime failures.",
      ["event recorder runtime", "route or worker hooks"],
      "Operational event hooks are not enabled yet.",
    ),
  ],
});
