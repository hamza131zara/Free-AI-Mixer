import { createUnauthenticatedRequesterContext } from "./requesterContext";
import {
  createAuthNotConfiguredTrustedAuthProviderStrategy,
  type TrustedAuthProviderStrategy,
} from "./trustedAuthProviderStrategy";
import type {
  TrustedAuthProviderRuntimeConfig,
} from "./trustedAuthProviderRuntimeConfig";

/**
 * Phase 101 boundary helper.
 *
 * This composes runtime auth provider config into a trusted provider strategy.
 * It intentionally does not implement real token/session verification yet.
 *
 * Safety rules:
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers as authenticated identity.
 * - Must not read service-role secrets.
 * - Must not read token/private-key secrets.
 * - Must not apply RLS policies.
 * - Must not mutate route authorization behavior.
 * - Must not enable public artifact delivery.
 */
export const createTrustedAuthProviderStrategyFromRuntimeConfig = (
  config: TrustedAuthProviderRuntimeConfig,
): TrustedAuthProviderStrategy => {
  if (config.kind === "auth_provider_not_configured") {
    return createAuthNotConfiguredTrustedAuthProviderStrategy();
  }

  return {
    kind: config.provider,
    resolveRequesterContext: async () =>
      createUnauthenticatedRequesterContext("invalid_credentials"),
  };
};
