export type JwtVerificationKeyMode =
  | "remote_jwks"
  | "static_public_key"
  | "not_configured";

export type JwtVerificationConfiguration =
  | {
      kind: "jwt_verification_not_configured";
      reason:
        | "missing_provider"
        | "missing_issuer"
        | "missing_audience"
        | "missing_jwks_uri"
        | "unsupported_key_mode";
    }
  | {
      kind: "jwt_verification_configured";
      keyMode: "remote_jwks";
      issuer: string;
      audience: string;
      jwksUri: string;
    };

export interface JwtVerificationConfigurationEnv {
  FREE_AI_MIXER_AUTH_PROVIDER?: string;
  FREE_AI_MIXER_AUTH_ISSUER?: string;
  FREE_AI_MIXER_AUTH_AUDIENCE?: string;
  FREE_AI_MIXER_AUTH_JWKS_URI?: string;
  FREE_AI_MIXER_AUTH_JWT_KEY_MODE?: string;
}

/**
 * Phase 121 configuration boundary.
 *
 * This reads non-secret JWT verification configuration only.
 * It intentionally does not construct JWKS, import jose, verify tokens,
 * trust headers, enforce routes, or enable public artifact delivery.
 */
export const readJwtVerificationConfiguration = (
  env: JwtVerificationConfigurationEnv = process.env,
): JwtVerificationConfiguration => {
  const provider = env.FREE_AI_MIXER_AUTH_PROVIDER?.trim().toLowerCase();

  if (provider !== "jwt") {
    return {
      kind: "jwt_verification_not_configured",
      reason: "missing_provider",
    };
  }

  const issuer = env.FREE_AI_MIXER_AUTH_ISSUER?.trim();
  const audience = env.FREE_AI_MIXER_AUTH_AUDIENCE?.trim();
  const jwksUri = env.FREE_AI_MIXER_AUTH_JWKS_URI?.trim();
  const keyMode =
    env.FREE_AI_MIXER_AUTH_JWT_KEY_MODE?.trim().toLowerCase() || "remote_jwks";

  if (!issuer) {
    return {
      kind: "jwt_verification_not_configured",
      reason: "missing_issuer",
    };
  }

  if (!audience) {
    return {
      kind: "jwt_verification_not_configured",
      reason: "missing_audience",
    };
  }

  if (keyMode !== "remote_jwks") {
    return {
      kind: "jwt_verification_not_configured",
      reason: "unsupported_key_mode",
    };
  }

  if (!jwksUri) {
    return {
      kind: "jwt_verification_not_configured",
      reason: "missing_jwks_uri",
    };
  }

  return {
    kind: "jwt_verification_configured",
    keyMode: "remote_jwks",
    issuer,
    audience,
    jwksUri,
  };
};

export const isJwtVerificationConfigured = (
  config: JwtVerificationConfiguration,
): config is Extract<
  JwtVerificationConfiguration,
  { kind: "jwt_verification_configured" }
> => config.kind === "jwt_verification_configured";
