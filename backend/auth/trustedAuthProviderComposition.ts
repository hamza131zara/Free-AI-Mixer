import { createUnauthenticatedRequesterContext } from "./requesterContext";
import {
  createAuthNotConfiguredTrustedAuthProviderStrategy,
  type TrustedAuthProviderStrategy,
} from "./trustedAuthProviderStrategy";
import type {
  TrustedAuthProviderRuntimeConfig,
} from "./trustedAuthProviderRuntimeConfig";
import {
  createFailClosedFutureJwtVerificationStrategy,
  mapJwtVerificationResultToRequesterContext,
} from "./jwtProviderVerificationStrategy";

/**
 * Phase 113 boundary helper.
 *
 * This composes runtime auth provider config into a trusted provider strategy.
 * JWT provider mode now delegates to the fail-closed JWT verification boundary.
 * It intentionally does not implement real JWT verification yet.
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

  if (config.provider === "future_jwt_provider") {
    const jwtVerificationStrategy = createFailClosedFutureJwtVerificationStrategy();

    return {
      kind: config.provider,
      resolveRequesterContext: async (input) => {
        const jwtResult = await jwtVerificationStrategy.verify({
          headers: input?.headers,
          issuer: config.issuer,
          audience: config.audience,
        });

        return mapJwtVerificationResultToRequesterContext(jwtResult);
      },
    };
  }

  return {
    kind: config.provider,
    resolveRequesterContext: async () =>
      createUnauthenticatedRequesterContext("invalid_credentials"),
  };
};
