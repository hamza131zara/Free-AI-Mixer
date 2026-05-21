export type BackendRequesterUnauthenticatedReason =
  | "auth_not_configured"
  | "missing_credentials"
  | "invalid_credentials";

export interface BackendUnauthenticatedRequesterContext {
  kind: "unauthenticated";
  reason: BackendRequesterUnauthenticatedReason;
}

export interface BackendAuthenticatedRequesterContext {
  kind: "authenticated";
  userId: string;
  workspaceId?: string;
  authProvider?: string;
  authSubject?: string;
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

export const isAuthenticatedRequesterContext = (
  requester: BackendRequesterContext,
): requester is BackendAuthenticatedRequesterContext =>
  requester.kind === "authenticated";

export const getAuthenticatedRequesterOrUndefined = (
  requester: BackendRequesterContext,
): BackendAuthenticatedRequesterContext | undefined =>
  isAuthenticatedRequesterContext(requester) ? requester : undefined;
