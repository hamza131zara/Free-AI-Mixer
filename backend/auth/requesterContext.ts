export type BackendRequesterUnauthenticatedReason =
  | "auth_not_configured"
  | "missing_credentials"
  | "invalid_credentials";

export type BackendRequesterWorkspaceAuthority =
  | "verified"
  | "not_available";

export type BackendRequesterWorkspaceAuthorityReason =
  | "workspace_runtime_not_enabled"
  | "no_active_workspace_membership"
  | "multiple_active_workspace_memberships";

export interface BackendUnauthenticatedRequesterContext {
  kind: "unauthenticated";
  reason: BackendRequesterUnauthenticatedReason;
}

export interface BackendAuthenticatedRequesterContext {
  kind: "authenticated";
  userId: string;
  appUserId?: string;
  supabaseUserId?: string;
  workspaceId?: string;
  workspaceRole?: string;
  workspaceAuthority?: BackendRequesterWorkspaceAuthority;
  workspaceAuthorityReason?: BackendRequesterWorkspaceAuthorityReason;
  authProvider?: string;
  authSubject?: string;
  email?: string;
}

export type BackendRequesterContext =
  | BackendUnauthenticatedRequesterContext
  | BackendAuthenticatedRequesterContext;

export const createUnauthenticatedRequesterContext = (
  reason: BackendRequesterUnauthenticatedReason = "auth_not_configured",
): BackendUnauthenticatedRequesterContext => ({
  kind: "unauthenticated",
  reason,
});

export const createAuthenticatedRequesterContext = (
  requester: Omit<BackendAuthenticatedRequesterContext, "kind">,
): BackendAuthenticatedRequesterContext => ({
  kind: "authenticated",
  ...requester,
});

export const isAuthenticatedRequesterContext = (
  requester: BackendRequesterContext,
): requester is BackendAuthenticatedRequesterContext =>
  requester.kind === "authenticated";

export const getAuthenticatedRequesterOrUndefined = (
  requester: BackendRequesterContext,
): BackendAuthenticatedRequesterContext | undefined =>
  isAuthenticatedRequesterContext(requester) ? requester : undefined;
