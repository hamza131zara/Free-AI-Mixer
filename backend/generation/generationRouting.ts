import { getProviderCatalog } from "../providers/providerCatalog";
import type {
  BackendGenerationProviderId,
  BackendGenerationRoutingPreferences,
} from "./generationProviderTypes";

export interface BackendGenerationRoutingDecisionInput {
  availableProviderIds: BackendGenerationProviderId[];
  preferences: BackendGenerationRoutingPreferences;
}

export interface BackendGenerationRoutingDecision {
  selectedProviderId: BackendGenerationProviderId;
  mode: BackendGenerationRoutingPreferences["mode"];
  fallbackEnabled: boolean;
  orderedFallbackProviderIds: BackendGenerationProviderId[];
  selectsSingleProviderPerAttempt: true;
}

const catalogOrder = getProviderCatalog().map((provider) => provider.id);

const sortProviderIds = (
  providerIds: BackendGenerationProviderId[],
): BackendGenerationProviderId[] => {
  const order = new Map(catalogOrder.map((providerId, index) => [providerId, index]));

  return [...providerIds].sort((left, right) => {
    const leftOrder = order.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
};

export const chooseGenerationProvider = ({
  availableProviderIds,
  preferences,
}: BackendGenerationRoutingDecisionInput): BackendGenerationRoutingDecision => {
  const orderedAvailableProviders = sortProviderIds(
    Array.from(new Set(availableProviderIds)),
  );

  if (orderedAvailableProviders.length === 0) {
    throw new Error("At least one generation provider must be available.");
  }

  const selectedProviderId =
    preferences.mode === "manual" && preferences.manualProviderId
      ? orderedAvailableProviders.includes(preferences.manualProviderId)
        ? preferences.manualProviderId
        : orderedAvailableProviders[0]
      : orderedAvailableProviders[0];

  const orderedFallbackProviderIds = preferences.fallback.enabled
    ? preferences.fallback.orderedProviderIds.filter(
        (providerId) =>
          providerId !== selectedProviderId &&
          orderedAvailableProviders.includes(providerId),
      )
    : [];

  return {
    selectedProviderId,
    mode: preferences.mode,
    fallbackEnabled: preferences.fallback.enabled,
    orderedFallbackProviderIds,
    selectsSingleProviderPerAttempt: true,
  };
};
