import type { IncomingHttpHeaders } from "node:http";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";

export interface BackendRequesterContextResolverInput {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
}

export interface BackendRequesterContextResolver {
  resolve(input?: BackendRequesterContextResolverInput): BackendRequesterContext;
}

/**
 * Phase 81 boundary resolver.
 *
 * This intentionally does not authenticate users yet.
 * It provides a safe, explicit requester-context seam for future auth integration.
 *
 * Safety rules:
 * - Must not fabricate a user identity.
 * - Must not trust arbitrary headers as authenticated identity.
 * - Must not read service-role secrets.
 * - Must not apply RLS policies.
 * - Must not change route authorization behavior.
 */
export const createAuthNotConfiguredRequesterContextResolver =
  (): BackendRequesterContextResolver => ({
    resolve: () => createUnauthenticatedRequesterContext("auth_not_configured"),
  });

export const resolveRequesterContext = (
  input?: BackendRequesterContextResolverInput,
): BackendRequesterContext => {
  void input;

  return createUnauthenticatedRequesterContext("auth_not_configured");
};
