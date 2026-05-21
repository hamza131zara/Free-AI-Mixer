import type { Request, RequestHandler } from "express";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";
import {
  createAuthNotConfiguredTrustedAuthProviderStrategy,
  resolveTrustedAuthProviderRequesterContext,
  type TrustedAuthProviderStrategy,
} from "./trustedAuthProviderStrategy";

export interface BackendRequesterContextRequest extends Request {
  backendRequesterContext?: BackendRequesterContext;
}

export interface TrustedAuthMiddlewareOptions {
  providerStrategy?: TrustedAuthProviderStrategy;
}

/**
 * Phase 97 boundary middleware.
 *
 * This middleware can consume a trusted auth provider strategy, but remains
 * non-enforcing. The default provider remains auth-not-configured.
 *
 * Safety rules:
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers as authenticated identity.
 * - Must not read service-role secrets.
 * - Must not apply RLS policies.
 * - Must not mutate route authorization behavior.
 * - Must not enable public artifact delivery.
 */
export const createTrustedAuthMiddleware = (
  options: TrustedAuthMiddlewareOptions = {},
): RequestHandler => {
  const providerStrategy =
    options.providerStrategy ?? createAuthNotConfiguredTrustedAuthProviderStrategy();

  return (request, _response, next): void => {
    void resolveTrustedAuthProviderRequesterContext(providerStrategy, {
      headers: request.headers,
    })
      .then((requesterContext) => {
        const requesterRequest = request as BackendRequesterContextRequest;

        requesterRequest.backendRequesterContext = requesterContext;

        next();
      })
      .catch(next);
  };
};

export const createTrustedAuthNotConfiguredMiddleware = (): RequestHandler =>
  createTrustedAuthMiddleware({
    providerStrategy: createAuthNotConfiguredTrustedAuthProviderStrategy(),
  });

export const getRequesterContextFromRequest = (
  request: Request,
): BackendRequesterContext => {
  const requesterRequest = request as BackendRequesterContextRequest;

  return (
    requesterRequest.backendRequesterContext ??
    createUnauthenticatedRequesterContext("auth_not_configured")
  );
};
