export interface BackendVerifiedSessionIdentity {
  userId: string;
  workspaceId?: string;
  authProvider?: string;
  authSubject?: string;
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
