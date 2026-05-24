import {
  resolveProductionJwtAuthReadiness,
  type ProductionJwtAuthReadinessDecision,
} from "./productionJwtAuthReadiness";
import {
  resolveSupabaseAuthRuntimeStrategy,
  type SupabaseAuthRuntimeStrategyDecision,
} from "./supabaseAuthRuntimeStrategy";
import { readTrustedAuthProviderRuntimeConfig } from "./trustedAuthProviderRuntimeConfig";

export interface ProductionAuthReadinessEnv {
  FREE_AI_MIXER_AUTH_PROVIDER?: string;
  FREE_AI_MIXER_AUTH_ISSUER?: string;
  FREE_AI_MIXER_AUTH_AUDIENCE?: string;
  FREE_AI_MIXER_AUTH_JWKS_URI?: string;
  FREE_AI_MIXER_AUTH_JWT_KEY_MODE?: string;
  FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS?: string;
  FREE_AI_MIXER_CORS_ALLOWED_ORIGINS?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export type ProductionAuthReadinessDecision =
  | {
      kind: "not_ready";
      authProviderConfigured: boolean;
      corsConfigured: boolean;
      frontendProjectUrlConfigured: boolean;
      frontendAnonKeyConfigured: boolean;
      jwtReadiness: ProductionJwtAuthReadinessDecision;
      strategy: SupabaseAuthRuntimeStrategyDecision;
      missing: Array<
        | "auth_provider"
        | "auth_issuer"
        | "auth_audience"
        | "auth_jwks_uri"
        | "auth_allowed_algorithms"
        | "cors_allowed_origins"
        | "supabase_project_url"
        | "supabase_frontend_anon_key"
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
      frontendAnonKeyConfigured: boolean;
      jwtReadiness: Extract<ProductionJwtAuthReadinessDecision, { kind: "ready" }>;
      strategy: SupabaseAuthRuntimeStrategyDecision;
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

const hasFrontendAnonKey = (env: ProductionAuthReadinessEnv): boolean =>
  Boolean(
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      env.VITE_SUPABASE_ANON_KEY?.trim() ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );

export const resolveProductionAuthReadiness = (
  env: ProductionAuthReadinessEnv = process.env,
): ProductionAuthReadinessDecision => {
  const runtimeConfig = readTrustedAuthProviderRuntimeConfig(env);
  const jwtReadiness = resolveProductionJwtAuthReadiness(env);
  const strategy = resolveSupabaseAuthRuntimeStrategy();
  const corsConfigured = hasConfiguredOrigins(env.FREE_AI_MIXER_CORS_ALLOWED_ORIGINS);
  const frontendProjectUrlConfigured = hasFrontendProjectUrl(env);
  const frontendAnonKeyConfigured = hasFrontendAnonKey(env);
  const missing = new Set<
    | "auth_provider"
    | "auth_issuer"
    | "auth_audience"
    | "auth_jwks_uri"
    | "auth_allowed_algorithms"
    | "cors_allowed_origins"
    | "supabase_project_url"
    | "supabase_frontend_anon_key"
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

    if (jwtReadiness.reason === "missing_allowed_algorithms") {
      missing.add("auth_allowed_algorithms");
    }
  }

  if (!corsConfigured) {
    missing.add("cors_allowed_origins");
  }

  if (!frontendProjectUrlConfigured) {
    missing.add("supabase_project_url");
  }

  if (!frontendAnonKeyConfigured) {
    missing.add("supabase_frontend_anon_key");
  }

  if (jwtReadiness.kind !== "ready" || runtimeConfig.kind !== "auth_provider_configured") {
    return {
      kind: "not_ready",
      authProviderConfigured: runtimeConfig.kind === "auth_provider_configured",
      corsConfigured,
      frontendProjectUrlConfigured,
      frontendAnonKeyConfigured,
      jwtReadiness,
      strategy,
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
    frontendAnonKeyConfigured,
    jwtReadiness,
    strategy,
    routeRuntimeEnabled: false,
    realVerificationEnabled: false,
  };
};
