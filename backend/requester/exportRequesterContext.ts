import type { Request } from "express";
import type { BackendExportJobOwnerScope } from "../contracts/exportHttpTypes";

export type ExportRequesterAuthMode = "local_dev_fallback";

export interface ExportRequesterContext extends BackendExportJobOwnerScope {
  authMode: ExportRequesterAuthMode;
}

const localDevFallbackRequesterContext: ExportRequesterContext = {
  ownerId: "local-dev-owner",
  workspaceId: "local-dev-workspace",
  authMode: "local_dev_fallback",
};

export const createLocalDevFallbackExportRequesterContext =
  (): ExportRequesterContext => ({
    ...localDevFallbackRequesterContext,
  });

export const resolveExportRequesterContext = (
  _request: Request<any, any, any, any, any>,
): ExportRequesterContext => createLocalDevFallbackExportRequesterContext();

export const isLocalDevFallbackExportRequesterContext = (
  requesterContext: ExportRequesterContext,
): boolean => requesterContext.authMode === "local_dev_fallback";
