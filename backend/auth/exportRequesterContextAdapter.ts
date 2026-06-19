import type { BackendExportJobOwnerScope } from "../contracts/exportHttpTypes";
import type {
  BackendAuthenticatedRequesterContext,
  BackendRequesterContext,
} from "./requesterContext";
import { isAuthenticatedRequesterContext } from "./requesterContext";
import type {
  AuthenticatedSessionExportRequesterContext,
  AuthenticatedTokenExportRequesterContext,
  ExportRequesterContext,
} from "../requester/exportRequesterContext";
import {
  createAuthenticatedSessionExportRequesterContext,
  createAuthenticatedTokenExportRequesterContext,
} from "../requester/exportRequesterContext";

export type ExportRequesterContextAdapterMode =
  | "authenticated_session"
  | "authenticated_token";

export type ExportRequesterContextAdapterResult =
  | {
      kind: "adapted";
      requesterContext: ExportRequesterContext;
    }
  | {
      kind: "not_authenticated";
      reason:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "missing_credentials"
        | "invalid_credentials"
        | "missing_workspace";
    };

export const toExportOwnerScopeFromAuthenticatedRequester = (
  requester: BackendAuthenticatedRequesterContext,
): BackendExportJobOwnerScope => {
  if (!requester.workspaceId) {
    throw new Error(
      "Authenticated requester workspaceId is required for export owner scope adaptation.",
    );
  }

  return {
    ownerId: requester.userId,
    workspaceId: requester.workspaceId,
  };
};

/**
 * Phase 88 boundary helper.
 *
 * This adapts a future trusted authenticated requester context into the
 * existing export requester context shape.
 *
 * Safety rules:
 * - Must only adapt authenticated requester contexts.
 * - Must not fabricate authenticated identity.
 * - Must not fabricate workspace scope.
 * - Must not trust arbitrary headers.
 * - Must not read service-role secrets.
 * - Must not apply RLS policies.
 * - Must not mutate route behavior.
 * - Must not enable public artifact delivery.
 */
export const adaptAuthenticatedRequesterToExportRequesterContext = (
  requester: BackendRequesterContext,
  mode: ExportRequesterContextAdapterMode,
): ExportRequesterContextAdapterResult => {
  if (!isAuthenticatedRequesterContext(requester)) {
    return {
      kind: "not_authenticated",
      reason: requester.reason,
    };
  }

  if (!requester.workspaceId) {
    return {
      kind: "not_authenticated",
      reason: "missing_workspace",
    };
  }

  const ownerScope = toExportOwnerScopeFromAuthenticatedRequester(requester);

  const exportRequesterContext:
    | AuthenticatedSessionExportRequesterContext
    | AuthenticatedTokenExportRequesterContext =
    mode === "authenticated_session"
      ? createAuthenticatedSessionExportRequesterContext(ownerScope)
      : createAuthenticatedTokenExportRequesterContext(ownerScope);

  return {
    kind: "adapted",
    requesterContext: exportRequesterContext,
  };
};
