import type { Request } from "express";
import type { BackendExportJobOwnerScope } from "../contracts/exportHttpTypes";

export type ExportRequesterAuthMode = "local_dev_fallback";

export interface ExportRequesterContext extends BackendExportJobOwnerScope {
  authMode: ExportRequesterAuthMode;
}

export type ExportRequesterContextResolver = (
  request: Request<any, any, any, any, any>,
) => ExportRequesterContext;

const localDevFallbackRequesterContext: ExportRequesterContext = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
  authMode: "local_dev_fallback",
};

export const createLocalDevFallbackExportRequesterContext =
  (): ExportRequesterContext => ({
    ...localDevFallbackRequesterContext,
  });

export const resolveExportRequesterContext: ExportRequesterContextResolver = (
  _request,
) => createLocalDevFallbackExportRequesterContext();

export const isLocalDevFallbackExportRequesterContext = (
  requesterContext: ExportRequesterContext,
): boolean => requesterContext.authMode === "local_dev_fallback";
