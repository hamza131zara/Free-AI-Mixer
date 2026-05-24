import {
  resolveProductionJwtAuthReadiness,
  type ProductionJwtAuthReadinessDecision,
} from "./productionJwtAuthReadiness";
import { readTrustedAuthProviderRuntimeConfig } from "./trustedAuthProviderRuntimeConfig";

export interface ProductionAuthReadinessEnv {
  FREE_AI_MIXER_AUTH_PROVIDER?: string;
  FREE_AI_MIXER_AUTH_ISSUER?: string;
  FREE_AI_MIXER_AUTH_AUDIENCE?: string;
  FREE_AI_MIXER_AUTH_JWKS_URI?: string;
  FREE_AI_MIXER_AUTH_JWT_KEY_MODE?: string;
  FREE_AI_MIXER_CORS_ALLOWED_ORIGINS?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
}

export type ProductionAuthReadinessDecision =
  | {
      kind: "not_ready";
      authProviderConfigured: boolean;
      corsConfigured: boolean;
      frontendProjectUrlConfigured: boolean;
      jwtReadiness: ProductionJwtAuthReadinessDecision;
      missing: Array<
        | "auth_provider"
        | "auth_issuer"
        | "auth_audience"
        | "auth_jwks_uri"
        | "cors_allowed_origins"
      >;
      routeRuntimeEnabled: false;
      realVerificationEnabled: false;
    }
  | {
      kind: "ready";
      provider: "jwt";
      authProviderConfigured: true;
      corsConfigured: boolean;
      frontendProjectUrlConfigured: boolean;
      jwtReadiness: Extract<ProductionJwtAuthReadinessDecision, { kind: "ready" }>;
      routeRuntimeEnabled: false;
      realVerificationEnabled: false;
    };

const hasConfiguredOrigins = (value?: string): boolean =>
  Boolean(value && value.trim().length > 0);

const hasFrontendProjectUrl = (env: ProductionAuthReadinessEnv): boolean =>
  Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      env.VITE_SUPABASE_URL?.trim(),
  );

export const resolveProductionAuthReadiness = (
  env: ProductionAuthReadinessEnv = process.env,
): ProductionAuthReadinessDecision => {
  const runtimeConfig = readTrustedAuthProviderRuntimeConfig(env);
  const jwtReadiness = resolveProductionJwtAuthReadiness(env);
  const corsConfigured = hasConfiguredOrigins(env.FREE_AI_MIXER_CORS_ALLOWED_ORIGINS);
  const frontendProjectUrlConfigured = hasFrontendProjectUrl(env);
  const missing = new Set<
    | "auth_provider"
    | "auth_issuer"
    | "auth_audience"
    | "auth_jwks_uri"
    | "cors_allowed_origins"
  >();

  if (runtimeConfig.kind === "auth_provider_not_configured") {
    missing.add("auth_provider");
  }

  if (jwtReadiness.kind === "unavailable") {
    if (jwtReadiness.reason === "missing_issuer") {
      missing.add("auth_issuer");
    }

    if (jwtReadiness.reason === "missing_audience") {
      missing.add("auth_audience");
    }

    if (jwtReadiness.reason === "missing_jwks_uri") {
      missing.add("auth_jwks_uri");
    }
  }

  if (!corsConfigured) {
    missing.add("cors_allowed_origins");
  }

  if (jwtReadiness.kind !== "ready" || runtimeConfig.kind !== "auth_provider_configured") {
    return {
      kind: "not_ready",
      authProviderConfigured: runtimeConfig.kind === "auth_provider_configured",
      corsConfigured,
      frontendProjectUrlConfigured,
      jwtReadiness,
      missing: Array.from(missing),
      routeRuntimeEnabled: false,
      realVerificationEnabled: false,
    };
  }

  return {
    kind: "ready",
    provider: "jwt",
    authProviderConfigured: true,
    corsConfigured,
    frontendProjectUrlConfigured,
    jwtReadiness,
    routeRuntimeEnabled: false,
    realVerificationEnabled: false,
  };
};
