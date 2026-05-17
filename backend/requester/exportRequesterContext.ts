import type { Request } from "express";
import type { BackendExportJobOwnerScope } from "../contracts/exportHttpTypes";

export type ExportRequesterAuthMode =
  | "local_dev_fallback"
  | "authenticated_session"
  | "authenticated_token";

interface ExportRequesterContextBase extends BackendExportJobOwnerScope {}

export interface LocalDevFallbackExportRequesterContext
  extends ExportRequesterContextBase {
  authMode: "local_dev_fallback";
}

export interface AuthenticatedSessionExportRequesterContext
  extends ExportRequesterContextBase {
  authMode: "authenticated_session";
}

export interface AuthenticatedTokenExportRequesterContext
  extends ExportRequesterContextBase {
  authMode: "authenticated_token";
}

export type ExportRequesterContext =
  | LocalDevFallbackExportRequesterContext
  | AuthenticatedSessionExportRequesterContext
  | AuthenticatedTokenExportRequesterContext;

export type ExportRequesterContextResolver = (
  request: Request<any, any, any, any, any>,
) => ExportRequesterContext;

const localDevFallbackRequesterContext: LocalDevFallbackExportRequesterContext =
  {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
  authMode: "local_dev_fallback",
  };

export const createLocalDevFallbackExportRequesterContext =
  (): LocalDevFallbackExportRequesterContext => ({
    ...localDevFallbackRequesterContext,
  });

export const createAuthenticatedSessionExportRequesterContext = (
  ownerScope: BackendExportJobOwnerScope,
): AuthenticatedSessionExportRequesterContext => ({
  ownerId: ownerScope.ownerId,
  workspaceId: ownerScope.workspaceId,
  authMode: "authenticated_session",
});

export const createAuthenticatedTokenExportRequesterContext = (
  ownerScope: BackendExportJobOwnerScope,
): AuthenticatedTokenExportRequesterContext => ({
  ownerId: ownerScope.ownerId,
  workspaceId: ownerScope.workspaceId,
  authMode: "authenticated_token",
});

export const resolveExportRequesterContext: ExportRequesterContextResolver = (
  _request,
) => createLocalDevFallbackExportRequesterContext();

export const isLocalDevFallbackExportRequesterContext = (
  requesterContext: ExportRequesterContext,
): requesterContext is LocalDevFallbackExportRequesterContext =>
  requesterContext.authMode === "local_dev_fallback";

export const isAuthenticatedSessionExportRequesterContext = (
  requesterContext: ExportRequesterContext,
): requesterContext is AuthenticatedSessionExportRequesterContext =>
  requesterContext.authMode === "authenticated_session";

export const isAuthenticatedTokenExportRequesterContext = (
  requesterContext: ExportRequesterContext,
): requesterContext is AuthenticatedTokenExportRequesterContext =>
  requesterContext.authMode === "authenticated_token";
