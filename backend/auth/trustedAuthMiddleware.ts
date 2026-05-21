import type { Request, RequestHandler } from "express";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";
import {
  createAuthNotConfiguredTrustedAuthProviderStrategy,
  resolveTrustedAuthProviderRequesterContext,
  type TrustedAuthProviderStrategy,
} from "./trustedAuthProviderStrategy";
import type { TrustedAuthProviderRuntimeConfig } from "./trustedAuthProviderRuntimeConfig";
import { readTrustedAuthProviderRuntimeConfig } from "./trustedAuthProviderRuntimeConfig";
import { createTrustedAuthProviderStrategyFromRuntimeConfig } from "./trustedAuthProviderComposition";

export interface BackendRequesterContextRequest extends Request {
  backendRequesterContext?: BackendRequesterContext;
}

export interface TrustedAuthMiddlewareOptions {
  providerStrategy?: TrustedAuthProviderStrategy;
  runtimeConfig?: TrustedAuthProviderRuntimeConfig;
}

const resolveProviderStrategyForTrustedAuthMiddleware = (
  options: TrustedAuthMiddlewareOptions,
): TrustedAuthProviderStrategy => {
  if (options.providerStrategy) {
    return options.providerStrategy;
  }

  return createTrustedAuthProviderStrategyFromRuntimeConfig(
    options.runtimeConfig ?? readTrustedAuthProviderRuntimeConfig(),
  );
};

/**
 * Phase 104 boundary middleware.
 *
 * This middleware can consume runtime auth provider composition, but remains
 * non-enforcing. App composition still uses the auth-not-configured wrapper
 * until a later audited phase intentionally wires real provider config.
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
  const providerStrategy = resolveProviderStrategyForTrustedAuthMiddleware(options);

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
