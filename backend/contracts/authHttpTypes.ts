export interface BackendVerifiedSessionIdentity {
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

export type AuthUnavailableStatus =
  | "auth_not_configured"
  | "auth_provider_unavailable";

export type BackendAuthSessionResponse =
  | {
      kind: "authenticated_session";
      status: "authenticated";
      message: string;
      identity: BackendVerifiedSessionIdentity;
    }
  | {
      kind: "unauthenticated_session";
      status: "unauthenticated";
      message: string;
      reason: "missing_credentials" | "invalid_credentials";
    }
  | {
      kind: "auth_unavailable";
      status: AuthUnavailableStatus;
      message: string;
    };

export type BackendAuthMutationResponse =
  | BackendAuthSessionResponse
  | {
      kind: "logged_out";
      status: "unauthenticated";
      message: string;
    };
