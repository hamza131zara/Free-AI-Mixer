import type { Request, RequestHandler } from "express";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";

export interface BackendRequesterContextRequest extends Request {
  backendRequesterContext?: BackendRequesterContext;
}

/**
 * Phase 90 boundary middleware.
 *
 * This is a non-enforcing trusted auth middleware seam for future real auth.
 * It intentionally does not authenticate users yet.
 *
 * Safety rules:
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers as authenticated identity.
 * - Must not read service-role secrets.
 * - Must not apply RLS policies.
 * - Must not mutate route authorization behavior.
 * - Must not enable public artifact delivery.
 */
export const createTrustedAuthNotConfiguredMiddleware = (): RequestHandler => {
  return (request, _response, next) => {
    const requesterRequest = request as BackendRequesterContextRequest;

    requesterRequest.backendRequesterContext =
      createUnauthenticatedRequesterContext("auth_not_configured");

    next();
  };
};

export const getRequesterContextFromRequest = (
  request: Request,
): BackendRequesterContext => {
  const requesterRequest = request as BackendRequesterContextRequest;

  return (
    requesterRequest.backendRequesterContext ??
    createUnauthenticatedRequesterContext("auth_not_configured")
  );
};
