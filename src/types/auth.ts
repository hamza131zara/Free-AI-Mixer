export type AuthStatus =
  | "unknown"
  | "unauthenticated"
  | "authenticated"
  | "unavailable";

export interface VerifiedAccountIdentity {
  userId: string;
  workspaceId?: string;
  authProvider?: string;
  authSubject?: string;
}

export type AuthUnavailableCode =
  | "auth_not_configured"
  | "auth_provider_unavailable"
  | "auth_service_unreachable";

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
      reason: "missing_credentials" | "invalid_credentials";
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
    };

export interface AuthCredentialsInput {
  email: string;
  password: string;
}
