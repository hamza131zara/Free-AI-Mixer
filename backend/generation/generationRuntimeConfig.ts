import { generationRuntimeEnvNames } from "./generationProviderAdapter";

export type BackendGenerationProviderAdapterSelection =
  | "not_configured"
  | "openai_image_minimal";

export type BackendGenerationRouteExecutionMode =
  | "disabled"
  | "preconditions_only"
  | "adapter_mock_only"
  | "openai_adapter_mock_only"
  | "openai_adapter_mock_storage_only"
  | "real_provider_local_only";

export type BackendGenerationMockExecutionAdapterSelection =
  | "not_configured"
  | "mock_local";

export type BackendGenerationOpenAiAdapterFetchMode =
  | "not_configured"
  | "mock_only";

export type BackendGenerationGeneratedImageStorageMode =
  | "not_configured"
  | "local_staging";

export interface BackendGenerationRuntimeConfig {
  kind: "generation_runtime_config";
  runtimeEnabled: boolean;
  providerAdapter: BackendGenerationProviderAdapterSelection;
  allowRealProviderCalls: boolean;
}

export interface BackendGenerationRuntimeCompositionReadiness {
  kind: "generation_runtime_composition_readiness";
  runtimeEnabled: boolean;
  providerAdapter: BackendGenerationProviderAdapterSelection;
  allowRealProviderCalls: boolean;
  adapterSelectableForReadinessOnly: boolean;
  routeExecutionEnabled: false;
  vendorCallsEnabled: false;
  generatedImageDeliveryEnabled: false;
  generatedImageStorageReadiness: "not_configured";
  message: string;
}

export type BackendGenerationRealProviderLocalGateReadinessReason =
  | "ready"
  | "runtime_disabled"
  | "provider_adapter_not_openai_image_minimal"
  | "real_provider_calls_disabled"
  | "route_mode_not_real_provider_local_only"
  | "preflight_controls_not_ready"
  | "generated_image_storage_mode_not_local_staging"
  | "generated_image_storage_root_missing"
  | "real_provider_smoke_gate_disabled"
  | "openai_real_provider_fetch_missing"
  | "provider_key_repository_missing"
  | "provider_secret_vault_missing";

export interface BackendGenerationRealProviderLocalGateReadinessInput {
  runtimeConfig: BackendGenerationRuntimeConfig;
  routeExecutionMode: BackendGenerationRouteExecutionMode;
  preflightControlsReady: boolean;
  generatedImageStorageMode: BackendGenerationGeneratedImageStorageMode;
  generatedImageStorageRoot?: string;
  openAiImageRealLocalSmokeEnabled: boolean;
  dependencies: {
    openAiRealProviderFetchAvailable: boolean;
    providerKeyRepositoryAvailable: boolean;
    providerSecretVaultAvailable: boolean;
  };
}

export interface BackendGenerationRealProviderLocalGateReadiness {
  kind: "generation_real_provider_local_gate_readiness";
  ready: boolean;
  reason: BackendGenerationRealProviderLocalGateReadinessReason;
  checks: {
    runtimeEnabled: boolean;
    providerAdapterOpenAiImageMinimal: boolean;
    allowRealProviderCalls: boolean;
    routeModeRealProviderLocalOnly: boolean;
    preflightControlsReady: boolean;
    generatedImageStorageLocalStaging: boolean;
    generatedImageStorageRootPresent: boolean;
    openAiImageRealLocalSmokeEnabled: boolean;
    openAiRealProviderFetchAvailable: boolean;
    providerKeyRepositoryAvailable: boolean;
    providerSecretVaultAvailable: boolean;
  };
}

export type BackendGenerationRuntimeEnv = Record<string, string | undefined>;

export const generationRouteExecutionModeEnvName =
  "FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE";
export const generationMockExecutionAdapterEnvName =
  "FREE_AI_MIXER_GENERATION_MOCK_EXECUTION_ADAPTER";
export const generationOpenAiAdapterFetchModeEnvName =
  "FREE_AI_MIXER_GENERATION_OPENAI_ADAPTER_FETCH_MODE";
export const generationByokDecryptForMockExecutionEnvName =
  "FREE_AI_MIXER_GENERATION_BYOK_DECRYPT_FOR_MOCK_EXECUTION";
export const generationGeneratedImageStorageModeEnvName =
  "FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_MODE";
export const generationGeneratedImageStorageRootEnvName =
  "FREE_AI_MIXER_GENERATION_GENERATED_IMAGE_STORAGE_ROOT";
export const generationOpenAiImageRealLocalSmokeEnabledEnvName =
  "FREE_AI_MIXER_GENERATION_OPENAI_IMAGE_REAL_LOCAL_SMOKE_ENABLED";

export const parseGenerationRuntimeConfig = (
  env: BackendGenerationRuntimeEnv = process.env,
): BackendGenerationRuntimeConfig => ({
  kind: "generation_runtime_config",
  runtimeEnabled: env[generationRuntimeEnvNames.runtimeEnabled] === "1",
  providerAdapter:
    env[generationRuntimeEnvNames.providerAdapter] === "openai_image_minimal"
      ? "openai_image_minimal"
      : "not_configured",
  allowRealProviderCalls:
    env[generationRuntimeEnvNames.allowRealProviderCalls] === "1",
});

export const parseGenerationRouteExecutionMode = (
  env: BackendGenerationRuntimeEnv = process.env,
): BackendGenerationRouteExecutionMode => {
  const value = env[generationRouteExecutionModeEnvName];

  if (
    value === "preconditions_only" ||
    value === "adapter_mock_only" ||
    value === "openai_adapter_mock_only" ||
    value === "openai_adapter_mock_storage_only" ||
    value === "real_provider_local_only"
  ) {
    return value;
  }

  return "disabled";
};

export const parseGenerationMockExecutionAdapterSelection = (
  env: BackendGenerationRuntimeEnv = process.env,
): BackendGenerationMockExecutionAdapterSelection =>
  env[generationMockExecutionAdapterEnvName] === "mock_local"
    ? "mock_local"
    : "not_configured";

export const parseGenerationOpenAiAdapterFetchMode = (
  env: BackendGenerationRuntimeEnv = process.env,
): BackendGenerationOpenAiAdapterFetchMode =>
  env[generationOpenAiAdapterFetchModeEnvName] === "mock_only"
    ? "mock_only"
    : "not_configured";

export const parseGenerationByokDecryptForMockExecutionEnabled = (
  env: BackendGenerationRuntimeEnv = process.env,
): boolean => env[generationByokDecryptForMockExecutionEnvName] === "1";

export const parseGenerationGeneratedImageStorageMode = (
  env: BackendGenerationRuntimeEnv = process.env,
): BackendGenerationGeneratedImageStorageMode =>
  env[generationGeneratedImageStorageModeEnvName] === "local_staging"
    ? "local_staging"
    : "not_configured";

export const parseGenerationGeneratedImageStorageRoot = (
  env: BackendGenerationRuntimeEnv = process.env,
): string | undefined => {
  const value = env[generationGeneratedImageStorageRootEnvName]?.trim();

  return value ? value : undefined;
};

export const parseGenerationOpenAiImageRealLocalSmokeEnabled = (
  env: BackendGenerationRuntimeEnv = process.env,
): boolean => env[generationOpenAiImageRealLocalSmokeEnabledEnvName] === "1";

export const evaluateGenerationRealProviderLocalGateReadiness = ({
  dependencies,
  generatedImageStorageMode,
  generatedImageStorageRoot,
  openAiImageRealLocalSmokeEnabled,
  preflightControlsReady,
  routeExecutionMode,
  runtimeConfig,
}: BackendGenerationRealProviderLocalGateReadinessInput): BackendGenerationRealProviderLocalGateReadiness => {
  const checks = {
    runtimeEnabled: runtimeConfig.runtimeEnabled,
    providerAdapterOpenAiImageMinimal:
      runtimeConfig.providerAdapter === "openai_image_minimal",
    allowRealProviderCalls: runtimeConfig.allowRealProviderCalls,
    routeModeRealProviderLocalOnly: routeExecutionMode === "real_provider_local_only",
    preflightControlsReady,
    generatedImageStorageLocalStaging:
      generatedImageStorageMode === "local_staging",
    generatedImageStorageRootPresent:
      typeof generatedImageStorageRoot === "string" &&
      generatedImageStorageRoot.trim().length > 0,
    openAiImageRealLocalSmokeEnabled,
    openAiRealProviderFetchAvailable:
      dependencies.openAiRealProviderFetchAvailable,
    providerKeyRepositoryAvailable:
      dependencies.providerKeyRepositoryAvailable,
    providerSecretVaultAvailable:
      dependencies.providerSecretVaultAvailable,
  };

  const reason: BackendGenerationRealProviderLocalGateReadinessReason =
    !checks.runtimeEnabled
      ? "runtime_disabled"
      : !checks.providerAdapterOpenAiImageMinimal
        ? "provider_adapter_not_openai_image_minimal"
        : !checks.allowRealProviderCalls
          ? "real_provider_calls_disabled"
          : !checks.routeModeRealProviderLocalOnly
            ? "route_mode_not_real_provider_local_only"
            : !checks.preflightControlsReady
              ? "preflight_controls_not_ready"
              : !checks.generatedImageStorageLocalStaging
                ? "generated_image_storage_mode_not_local_staging"
                : !checks.generatedImageStorageRootPresent
                  ? "generated_image_storage_root_missing"
                  : !checks.openAiImageRealLocalSmokeEnabled
                    ? "real_provider_smoke_gate_disabled"
                    : !checks.openAiRealProviderFetchAvailable
                      ? "openai_real_provider_fetch_missing"
                      : !checks.providerKeyRepositoryAvailable
                        ? "provider_key_repository_missing"
                        : !checks.providerSecretVaultAvailable
                          ? "provider_secret_vault_missing"
                          : "ready";

  return {
    kind: "generation_real_provider_local_gate_readiness",
    ready: reason === "ready",
    reason,
    checks,
  };
};

export const getGenerationRuntimeCompositionReadiness = (
  config: BackendGenerationRuntimeConfig,
): BackendGenerationRuntimeCompositionReadiness => {
  const adapterSelectableForReadinessOnly =
    config.runtimeEnabled &&
    config.providerAdapter === "openai_image_minimal" &&
    config.allowRealProviderCalls;

  return {
    kind: "generation_runtime_composition_readiness",
    runtimeEnabled: config.runtimeEnabled,
    providerAdapter: config.providerAdapter,
    allowRealProviderCalls: config.allowRealProviderCalls,
    adapterSelectableForReadinessOnly,
    routeExecutionEnabled: false,
    vendorCallsEnabled: false,
    generatedImageDeliveryEnabled: false,
    generatedImageStorageReadiness: "not_configured",
    message: adapterSelectableForReadinessOnly
      ? "Generation adapter configuration is recognized for readiness metadata only; route execution remains disabled."
      : "Generation runtime remains disabled and fail-closed.",
  };
};
