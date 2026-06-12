import { readTrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { readSupabaseConfigFromEnv, supabaseEnvKeys } from "./supabaseConfig";

export type ProductionDeploymentReadinessStatus =
  | "ready"
  | "configured"
  | "disabled"
  | "not_configured"
  | "blocked"
  | "requires_manual_setup";

export interface ProductionDeploymentReadinessCheck {
  name: string;
  status: ProductionDeploymentReadinessStatus;
  message: string;
}

export interface ProductionDeploymentReadinessSummary {
  kind: "production_deployment_readiness";
  status: "ready" | "blocked";
  checks: ProductionDeploymentReadinessCheck[];
  safeForPublicLaunch: false;
  secretsExposed: false;
  externalProviderCallsEnabled: boolean;
  platformPaidGenerationEnabled: false;
  videoProvidersEnabled: false;
  publicArtifactDeliveryEnabled: false;
}

export type ProductionDeploymentEnv = Record<string, string | undefined>;

const hasValue = (env: ProductionDeploymentEnv, key: string): boolean =>
  typeof env[key] === "string" && env[key]?.trim().length > 0;

const flagEnabled = (env: ProductionDeploymentEnv, key: string): boolean =>
  env[key] === "1" || env[key] === "true";

const check = (
  name: string,
  status: ProductionDeploymentReadinessStatus,
  message: string,
): ProductionDeploymentReadinessCheck => ({
  message,
  name,
  status,
});

export const getFrontendEnvSafetyChecks = (
  env: ProductionDeploymentEnv = process.env,
): ProductionDeploymentReadinessCheck[] => {
  const forbiddenFrontendKeys = [
    "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "VITE_OPENAI_API_KEY",
    "VITE_GEMINI_API_KEY",
    "VITE_STRIPE_SECRET_KEY",
    "VITE_PROVIDER_API_KEY",
  ];
  const exposed = forbiddenFrontendKeys.filter((key) => hasValue(env, key));

  return [
    check(
      "frontend_env_allowlist",
      exposed.length === 0 ? "ready" : "blocked",
      exposed.length === 0
        ? "Frontend env is limited to public client configuration by policy."
        : "Frontend env includes forbidden server-only secret variable names.",
    ),
  ];
};

export const getProductionDeploymentReadinessSummary = (
  env: ProductionDeploymentEnv = process.env,
): ProductionDeploymentReadinessSummary => {
  const authConfig = readTrustedAuthProviderRuntimeConfig(env);
  const supabaseConfig = readSupabaseConfigFromEnv(env);
  const realProviderCallsEnabled =
    flagEnabled(env, "FREE_AI_MIXER_GENERATION_ALLOW_REAL_PROVIDER_CALLS") &&
    env.FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE === "real_provider_local_only" &&
    flagEnabled(env, "FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED");
  const productionArtifactDeliveryEnabled =
    env.FREE_AI_MIXER_PRODUCTION_ARTIFACT_DELIVERY_MODE ===
    "backend_mediated_stream";
  const allowedOriginsConfigured = hasValue(
    env,
    "FREE_AI_MIXER_ALLOWED_ORIGINS",
  );
  const checks: ProductionDeploymentReadinessCheck[] = [
    check(
      "auth_config",
      authConfig.kind === "auth_provider_configured"
        ? "configured"
        : "not_configured",
      authConfig.kind === "auth_provider_configured"
        ? "Trusted auth provider configuration is present."
        : "Trusted auth provider configuration is missing; protected production routes must fail closed.",
    ),
    check(
      "supabase_db_config",
      supabaseConfig.enabled && supabaseConfig.valid
        ? "configured"
        : supabaseConfig.enabled
          ? "blocked"
          : "not_configured",
      supabaseConfig.enabled && supabaseConfig.valid
        ? "Supabase DB backend configuration is present."
        : "Supabase DB backend configuration is unavailable or invalid.",
    ),
    check(
      "supabase_service_role_backend_only",
      hasValue(env, supabaseEnvKeys.viteServiceRoleKey) ? "blocked" : "ready",
      hasValue(env, supabaseEnvKeys.viteServiceRoleKey)
        ? "Service-role key is present in frontend env namespace."
        : "Service-role key is restricted to backend env names by policy.",
    ),
    check(
      "storage_bucket_config",
      hasValue(env, supabaseEnvKeys.storageBucketArtifacts)
        ? "configured"
        : "not_configured",
      hasValue(env, supabaseEnvKeys.storageBucketArtifacts)
        ? "Artifact storage bucket name is configured."
        : "Artifact storage bucket name is missing.",
    ),
    check(
      "artifact_delivery_mode",
      productionArtifactDeliveryEnabled ? "configured" : "disabled",
      productionArtifactDeliveryEnabled
        ? "Artifact delivery uses backend-mediated stream mode."
        : "Production artifact delivery is disabled by default.",
    ),
    check(
      "credits_billing",
      flagEnabled(env, "FREE_AI_MIXER_CREDITS_RUNTIME_ENABLED")
        ? "requires_manual_setup"
        : "disabled",
      "Credits and billing remain disabled unless a separately audited runtime is configured.",
    ),
    check(
      "generation_route_gates",
      hasValue(env, "FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE")
        ? "configured"
        : "disabled",
      "Generation route mode is explicit; production defaults must not use mock/local-only modes.",
    ),
    check(
      "real_provider_calls",
      realProviderCallsEnabled ? "requires_manual_setup" : "disabled",
      realProviderCallsEnabled
        ? "Real provider calls are gated for a manual local/staging smoke only."
        : "Real provider calls are disabled.",
    ),
    check(
      "platform_paid_provider",
      "disabled",
      "Platform-paid provider generation remains disabled until billing and provider credentials are separately audited.",
    ),
    check(
      "video_providers",
      "disabled",
      "Real video providers remain unavailable/not configured.",
    ),
    check(
      "cors_origin_config",
      allowedOriginsConfigured ? "configured" : "not_configured",
      allowedOriginsConfigured
        ? "Allowed origins are configured explicitly."
        : "Production allowed origins are not configured; production CORS must fail closed.",
    ),
    check(
      "monitoring_log_redaction",
      "ready",
      "Monitoring readiness reports safe statuses only and must not expose secrets or raw env values.",
    ),
    ...getFrontendEnvSafetyChecks(env),
  ];
  const blocked = checks.some((item) => item.status === "blocked");

  return {
    checks,
    externalProviderCallsEnabled: realProviderCallsEnabled,
    kind: "production_deployment_readiness",
    platformPaidGenerationEnabled: false,
    publicArtifactDeliveryEnabled: false,
    safeForPublicLaunch: false,
    secretsExposed: false,
    status: blocked ? "blocked" : "ready",
    videoProvidersEnabled: false,
  };
};
