export type TrustedAuthProviderRuntimeProvider =
  | "future_jwt_provider"
  | "future_session_provider";

export type TrustedAuthProviderRuntimeConfig =
  | {
      kind: "auth_provider_not_configured";
      reason: "disabled" | "missing_provider" | "unsupported_provider";
    }
  | {
      kind: "auth_provider_configured";
      provider: TrustedAuthProviderRuntimeProvider;
      issuer?: string;
      audience?: string;
    };

export interface TrustedAuthProviderRuntimeEnv {
  FREE_AI_MIXER_AUTH_PROVIDER?: string;
  FREE_AI_MIXER_AUTH_ISSUER?: string;
  FREE_AI_MIXER_AUTH_AUDIENCE?: string;
}

/**
 * Phase 99 boundary helper.
 *
 * This reads non-secret auth provider runtime configuration only.
 * It intentionally does not create or wire a real auth provider.
 *
 * Safety rules:
 * - Must not read service-role secrets.
 * - Must not read token secrets.
 * - Must not fabricate authenticated identity.
 * - Must not trust arbitrary headers.
 * - Must not apply RLS policies.
 * - Must not mutate route authorization behavior.
 * - Must not enable public artifact delivery.
 */
export const readTrustedAuthProviderRuntimeConfig = (
  env: TrustedAuthProviderRuntimeEnv = process.env,
): TrustedAuthProviderRuntimeConfig => {
  const provider = env.FREE_AI_MIXER_AUTH_PROVIDER?.trim().toLowerCase();

  if (!provider || provider === "disabled" || provider === "none") {
    return {
      kind: "auth_provider_not_configured",
      reason: provider ? "disabled" : "missing_provider",
    };
  }

  if (provider === "jwt") {
    return {
      kind: "auth_provider_configured",
      provider: "future_jwt_provider",
      issuer: env.FREE_AI_MIXER_AUTH_ISSUER,
      audience: env.FREE_AI_MIXER_AUTH_AUDIENCE,
    };
  }

  if (provider === "session") {
    return {
      kind: "auth_provider_configured",
      provider: "future_session_provider",
      issuer: env.FREE_AI_MIXER_AUTH_ISSUER,
      audience: env.FREE_AI_MIXER_AUTH_AUDIENCE,
    };
  }

  return {
    kind: "auth_provider_not_configured",
    reason: "unsupported_provider",
  };
};

export const isTrustedAuthProviderRuntimeConfigured = (
  config: TrustedAuthProviderRuntimeConfig,
): config is Extract<
  TrustedAuthProviderRuntimeConfig,
  { kind: "auth_provider_configured" }
> => config.kind === "auth_provider_configured";
