import type { IncomingHttpHeaders } from "node:http";
import type { BackendRequesterContext } from "./requesterContext";
import { createUnauthenticatedRequesterContext } from "./requesterContext";

export interface TrustedAuthProviderResolveInput {
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
}

export type TrustedAuthProviderKind =
  | "auth_not_configured_provider"
  | "future_jwt_provider"
  | "future_session_provider";

export interface TrustedAuthProviderStrategy {
  kind: TrustedAuthProviderKind;
  resolveRequesterContext(
    input?: TrustedAuthProviderResolveInput,
  ): Promise<BackendRequesterContext>;
}

/**
 * Phase 96 boundary provider.
 *
 * This is a real-auth integration strategy seam only.
 * It intentionally does not authenticate users yet.
 *
 * Safety rules:
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers as authenticated identity.
 * - Must not read privileged database secrets.
 * - Must not apply RLS policies.
 * - Must not mutate route authorization behavior.
 * - Must not enable public artifact delivery.
 */
export const createAuthNotConfiguredTrustedAuthProviderStrategy =
  (): TrustedAuthProviderStrategy => ({
    kind: "auth_not_configured_provider",
    resolveRequesterContext: async (_input) =>
      createUnauthenticatedRequesterContext("auth_not_configured"),
  });

export const resolveTrustedAuthProviderRequesterContext = async (
  strategy: TrustedAuthProviderStrategy,
  input?: TrustedAuthProviderResolveInput,
): Promise<BackendRequesterContext> => strategy.resolveRequesterContext(input);
