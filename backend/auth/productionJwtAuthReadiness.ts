import {
  readJwtVerificationConfiguration,
  type JwtVerificationConfigurationEnv,
} from "./jwtVerificationConfiguration";
import {
  constructRemoteJwksForJwtVerification,
  getJwtVerificationExecutionReadiness,
} from "./jwtProviderVerificationStrategy";

export type ProductionJwtAuthReadinessUnavailableReason =
  | "missing_provider"
  | "missing_issuer"
  | "missing_audience"
  | "missing_jwks_uri"
  | "missing_allowed_algorithms"
  | "unsupported_key_mode"
  | "invalid_jwks_uri"
  | "jwks_not_constructed";

export type ProductionJwtAuthReadinessDecision =
  | {
      kind: "unavailable";
      reason: ProductionJwtAuthReadinessUnavailableReason;
      providerConfigured: false;
      jwksConfigured: false;
      routeRuntimeEnabled: false;
      realVerificationEnabled: false;
    }
  | {
      kind: "ready";
      provider: "jwt";
      issuer: string;
      audience: string;
      jwksUri: string;
      keyMode: "remote_jwks";
      allowedAlgorithms: string[];
      providerConfigured: true;
      jwksConfigured: true;
      routeRuntimeEnabled: false;
      realVerificationEnabled: false;
    };

const mapJwksConstructionFailureReason = (
  reason: "missing_config" | "not_configured" | "unsupported_key_mode" | "invalid_jwks_uri",
): ProductionJwtAuthReadinessUnavailableReason => {
  if (reason === "invalid_jwks_uri") {
    return "invalid_jwks_uri";
  }

  if (reason === "unsupported_key_mode") {
    return "unsupported_key_mode";
  }

  return "jwks_not_constructed";
};

/**
 * Phase 175-B production JWT configuration finalization boundary.
 *
 * This validates production JWT configuration readiness without enabling route
 * runtime auth rollout.
 *
 * Safety rules:
 * - no trusted header shortcut
 * - no route behavior change
 * - no frontend auth/storage behavior
 * - no service-role secret usage
 * - no remote Supabase dependency by default
 * - no public artifact delivery enablement
 */
export const resolveProductionJwtAuthReadiness = (
  env: JwtVerificationConfigurationEnv = process.env,
): ProductionJwtAuthReadinessDecision => {
  const config = readJwtVerificationConfiguration(env);

  if (config.kind === "jwt_verification_not_configured") {
    return {
      kind: "unavailable",
      reason: config.reason,
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    };
  }

  const executionReadiness = getJwtVerificationExecutionReadiness(config);

  if (
    executionReadiness.realVerificationEnabled !== false ||
    executionReadiness.verificationConfigured !== true ||
    executionReadiness.keyMode !== "remote_jwks"
  ) {
    return {
      kind: "unavailable",
      reason: "jwks_not_constructed",
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    };
  }

  const jwksConstruction = constructRemoteJwksForJwtVerification(config);

  if (jwksConstruction.kind !== "constructed") {
    return {
      kind: "unavailable",
      reason: mapJwksConstructionFailureReason(jwksConstruction.reason),
      providerConfigured: false,
      jwksConfigured: false,
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    };
  }

  return {
    kind: "ready",
    provider: "jwt",
    issuer: config.issuer,
    audience: config.audience,
    jwksUri: jwksConstruction.jwksUri,
    keyMode: config.keyMode,
    allowedAlgorithms: config.allowedAlgorithms,
    providerConfigured: true,
    jwksConfigured: true,
    routeRuntimeEnabled: false,
    realVerificationEnabled: false,
  };
};
