export type AuthStatus =
  | "unknown"
  | "unauthenticated"
  | "authenticated"
  | "unavailable";

export type AuthRecoveryStatus =
  | "recovery_unknown"
  | "recovery_processing"
  | "recovery_ready"
  | "recovery_invalid"
  | "recovery_complete";

export interface VerifiedAccountIdentity {
  userId: string;
  appUserId?: string;
  supabaseUserId?: string;
  workspaceId?: string;
  workspaceRole?: string;
  workspaceAuthority?: "verified" | "not_available";
  workspaceAuthorityReason?:
    | "workspace_runtime_not_enabled"
    | "no_active_workspace_membership"
    | "multiple_active_workspace_memberships";
  authProvider?: string;
  authSubject?: string;
  email?: string;
}

export type AuthUnavailableCode =
  | "auth_not_configured"
  | "auth_provider_unavailable"
  | "auth_service_unreachable"
  | "supabase_auth_not_configured"
  | "email_verification_required"
  | "workspace_bootstrap_blocked"
  | "account_bootstrap_unavailable";

export type AuthUnauthenticatedReason =
  | "missing_credentials"
  | "invalid_credentials"
  | "email_verification_required";

export type AuthSessionResult =
  | {
      kind: "authenticated";
      status: "authenticated";
      identity: VerifiedAccountIdentity;
      message: string;
    }
  | {
      kind: "unauthenticated";
      status: "unauthenticated";
      message: string;
      reason: AuthUnauthenticatedReason;
    }
  | {
      kind: "unavailable";
      status: "unavailable";
      message: string;
      code: AuthUnavailableCode;
    };

export type AuthMutationResult =
  | AuthSessionResult
  | {
      kind: "logged_out";
      status: "unauthenticated";
      message: string;
      recoveryStatus?: AuthRecoveryStatus;
    };

export interface AuthCredentialsInput {
  email: string;
  password: string;
}
