import { generationRuntimeEnvNames } from "./generationProviderAdapter";

export type BackendGenerationProviderAdapterSelection =
  | "not_configured"
  | "openai_image_minimal";

export type BackendGenerationRouteExecutionMode =
  | "disabled"
  | "preconditions_only"
  | "adapter_mock_only"
  | "real_provider_local_only";

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

export type BackendGenerationRuntimeEnv = Record<string, string | undefined>;

export const generationRouteExecutionModeEnvName =
  "FREE_AI_MIXER_GENERATION_ROUTE_EXECUTION_MODE";

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
    value === "real_provider_local_only"
  ) {
    return value;
  }

  return "disabled";
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
