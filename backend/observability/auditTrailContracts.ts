import type {
  EventActorKind,
  EventOutcome,
  EventSource,
} from "./eventLogContracts";
import type { SafeEventMetadata } from "./safeEventSanitizer";

export type AuditTrailCategory =
  | "auth_security"
  | "workspace_security"
  | "provider_key_security"
  | "admin_access"
  | "platform_role_change"
  | "billing_sensitive_action"
  | "credit_sensitive_action"
  | "support_moderation_action";

export type AuditTrailType =
  | "auth_verification_checked"
  | "login_denied"
  | "workspace_membership_denied"
  | "provider_key_mutation_denied"
  | "provider_key_mutation_attempted"
  | "admin_route_access_denied"
  | "admin_route_access_attempted"
  | "platform_role_assignment_changed"
  | "billing_sensitive_action_attempted"
  | "credit_sensitive_action_attempted"
  | "moderation_action_attempted"
  | "support_action_attempted";

export interface FutureAuditTrailEntry {
  auditType: AuditTrailType;
  category: AuditTrailCategory;
  displayName: string;
  description: string;
  appendOnlyLater: true;
  safeToPersistNow: false;
  requiredPrerequisites: string[];
  reasonUnavailable: string;
}

export interface SafeAuditTrailEntry {
  eventId: string;
  eventType: AuditTrailType;
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

export interface AuditTrailTaxonomySummary {
  kind: "audit_trail_taxonomy";
  appendOnlyLater: true;
  persistenceEnabled: false;
  routeHooksEnabled: false;
  workerHooksEnabled: false;
  entries: FutureAuditTrailEntry[];
}

const futureAudit = (
  auditType: AuditTrailType,
  category: AuditTrailCategory,
  displayName: string,
  description: string,
  requiredPrerequisites: string[],
  reasonUnavailable: string,
): FutureAuditTrailEntry => ({
  auditType,
  category,
  displayName,
  description,
  appendOnlyLater: true,
  safeToPersistNow: false,
  requiredPrerequisites,
  reasonUnavailable,
});

export const resolveAuditTrailTaxonomy = (): AuditTrailTaxonomySummary => ({
  kind: "audit_trail_taxonomy",
  appendOnlyLater: true,
  persistenceEnabled: false,
  routeHooksEnabled: false,
  workerHooksEnabled: false,
  entries: [
    futureAudit(
      "auth_verification_checked",
      "auth_security",
      "Auth verification checked",
      "Future backend-only auth security event.",
      ["verified auth runtime"],
      "Verified auth runtime is not enabled yet.",
    ),
    futureAudit(
      "workspace_membership_denied",
      "workspace_security",
      "Workspace membership denied",
      "Future workspace security audit event.",
      ["workspace lookup runtime"],
      "Workspace membership lookup runtime is not enabled yet.",
    ),
    futureAudit(
      "provider_key_mutation_attempted",
      "provider_key_security",
      "Provider key mutation attempted",
      "Future BYOK security audit event.",
      ["verified auth", "workspace truth", "BYOK vault/storage"],
      "BYOK vault and verified identity are not enabled yet.",
    ),
    futureAudit(
      "admin_route_access_attempted",
      "admin_access",
      "Admin route access attempted",
      "Future platform admin access audit event.",
      ["verified platform_admin auth"],
      "Platform-admin enforcement is not enabled yet.",
    ),
    futureAudit(
      "platform_role_assignment_changed",
      "platform_role_change",
      "Platform role assignment changed",
      "Future platform role security event.",
      ["platform role lookup runtime", "admin role mutation runtime"],
      "Platform role runtime is not enabled yet.",
    ),
    futureAudit(
      "billing_sensitive_action_attempted",
      "billing_sensitive_action",
      "Billing-sensitive action attempted",
      "Future billing security event.",
      ["billing runtime"],
      "Billing runtime is not enabled yet.",
    ),
    futureAudit(
      "credit_sensitive_action_attempted",
      "credit_sensitive_action",
      "Credit-sensitive action attempted",
      "Future credit security event.",
      ["credit ledger runtime"],
      "Credit ledger runtime is not enabled yet.",
    ),
    futureAudit(
      "moderation_action_attempted",
      "support_moderation_action",
      "Moderation action attempted",
      "Future moderation/support audit event.",
      ["verified moderator or support auth"],
      "Moderator/support runtime is not enabled yet.",
    ),
  ],
});
