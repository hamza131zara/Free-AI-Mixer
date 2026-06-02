import { create } from "zustand";
import {
  getProviderCatalog,
  getProviderConnections,
  getProviderRoutingPolicy,
  getProviderSettingsStatus,
  replaceProviderConnectionKey,
  revokeProviderConnectionKey,
  saveProviderConnectionKey,
  testProviderConnectionKey,
} from "../services/providerSettingsService";
import type {
  ProviderCatalogEntry,
  ProviderMutationAvailabilityResult,
  ProviderRoutingPreferences,
  ProviderSettingsStatusResult,
  RedactedProviderConnectionSummary,
  SupportedProviderId,
} from "../types/providerSettings";

export interface ProviderSettingsStoreState {
  catalogStatus: "unknown" | "ready" | "unavailable";
  catalogMessage: string;
  providers: ProviderCatalogEntry[];
  accessStatus:
    | "unknown"
    | "authenticated"
    | "unauthenticated"
    | "forbidden"
    | "unavailable";
  accessMessage: string;
  accessReasonCode?: string;
  activeWorkspaceId?: string;
  routingPreferences?: ProviderRoutingPreferences;
  connections: RedactedProviderConnectionSummary[];
  mutationMessage?: string;
  mutationStatus?: ProviderMutationAvailabilityResult["kind"];
  pendingAction: "refresh" | "save" | "replace" | "revoke" | "test" | null;
  refreshProviderSettings: () => Promise<void>;
  replaceProviderConnection: (
    providerId: SupportedProviderId,
    apiKey: string,
  ) => Promise<ProviderMutationAvailabilityResult>;
  revokeProviderConnection: (
    providerId: SupportedProviderId,
  ) => Promise<ProviderMutationAvailabilityResult>;
  saveProviderConnection: (
    providerId: SupportedProviderId,
    apiKey: string,
  ) => Promise<ProviderMutationAvailabilityResult>;
  testProviderConnection: (
    providerId: SupportedProviderId,
  ) => Promise<ProviderMutationAvailabilityResult>;
}

const unknownAccessMessage = "Checking provider settings access.";
const unknownCatalogMessage = "Loading supported provider catalog.";

const defaultRoutingPreferences: ProviderRoutingPreferences = {
  mode: "auto",
  recommendedVideoPriority: ["runway", "luma", "google", "openai", "replicate"],
  recommendedImagePriority: ["openai", "stability", "google", "replicate"],
  fallback: {
    enabled: false,
    orderedProviderIds: [],
    requiresExplicitOptIn: true,
  },
};

const applyStatusResult = (
  result: ProviderSettingsStatusResult,
): Pick<
  ProviderSettingsStoreState,
  | "accessStatus"
  | "accessMessage"
  | "accessReasonCode"
  | "activeWorkspaceId"
  | "routingPreferences"
  | "connections"
> => {
  if (result.kind === "authenticated") {
    return {
      accessStatus: "authenticated",
      accessMessage: result.message,
      accessReasonCode: undefined,
      activeWorkspaceId: result.activeWorkspaceId,
      routingPreferences: result.routingPreferences,
      connections: result.connections,
    };
  }

  if (result.kind === "unauthenticated") {
    return {
      accessStatus: "unauthenticated",
      accessMessage: result.message,
      accessReasonCode: result.reason,
      activeWorkspaceId: undefined,
      routingPreferences: defaultRoutingPreferences,
      connections: [],
    };
  }

  if (result.kind === "forbidden") {
    return {
      accessStatus: "forbidden",
      accessMessage: result.message,
      accessReasonCode: result.code,
      activeWorkspaceId: undefined,
      routingPreferences: defaultRoutingPreferences,
      connections: [],
    };
  }

  return {
    accessStatus: "unavailable",
    accessMessage: result.message,
    accessReasonCode: result.code,
    activeWorkspaceId: undefined,
    routingPreferences: defaultRoutingPreferences,
    connections: [],
  };
};

const upsertConnection = (
  connections: RedactedProviderConnectionSummary[],
  connection: RedactedProviderConnectionSummary,
): RedactedProviderConnectionSummary[] => {
  const existingIndex = connections.findIndex(
    (existing) => existing.providerId === connection.providerId,
  );

  if (existingIndex === -1) {
    return [...connections, connection];
  }

  return connections.map((existing, index) =>
    index === existingIndex ? connection : existing,
  );
};

const applyMutationResult = (
  result: ProviderMutationAvailabilityResult,
  currentConnections: RedactedProviderConnectionSummary[],
): Pick<
  ProviderSettingsStoreState,
  "connections" | "mutationMessage" | "mutationStatus"
> => ({
  connections:
    result.kind === "mutation_success"
      ? upsertConnection(
          currentConnections,
          result.status === "revoked"
            ? {
                ...result.connection,
                canManage: false,
                createdAt: undefined,
                keyFingerprintSuffix: undefined,
                maskedFingerprint: undefined,
              }
            : result.connection,
        )
      : result.kind === "validation_result" && result.connection
        ? upsertConnection(currentConnections, result.connection)
      : currentConnections,
  mutationMessage: result.message,
  mutationStatus: result.kind,
});

export const useProviderSettingsStore = create<ProviderSettingsStoreState>((set) => ({
  catalogStatus: "unknown",
  catalogMessage: unknownCatalogMessage,
  providers: [],
  accessStatus: "unknown",
  accessMessage: unknownAccessMessage,
  accessReasonCode: undefined,
  activeWorkspaceId: undefined,
  routingPreferences: defaultRoutingPreferences,
  connections: [],
  mutationMessage: undefined,
  mutationStatus: undefined,
  pendingAction: null,
  refreshProviderSettings: async () => {
    set({ pendingAction: "refresh" });
    const [catalogResult, statusResult, connectionsResult, routingPolicyResult] = await Promise.all([
      getProviderCatalog(),
      getProviderSettingsStatus(),
      getProviderConnections(),
      getProviderRoutingPolicy(),
    ]);

    const statusProjection = applyStatusResult(statusResult);
    const resolvedConnections =
      connectionsResult.connections.length > 0
        ? connectionsResult.connections
        : statusProjection.connections;
    const resolvedRoutingPreferences =
      routingPolicyResult.routingPreferences ?? statusProjection.routingPreferences;

    set({
      catalogStatus: catalogResult.providers.length > 0 ? "ready" : "unavailable",
      catalogMessage: catalogResult.message,
      providers: catalogResult.providers,
      ...statusProjection,
      routingPreferences: resolvedRoutingPreferences,
      connections: resolvedConnections,
      pendingAction: null,
    });
  },
  replaceProviderConnection: async (providerId, apiKey) => {
    set({
      mutationMessage: undefined,
      mutationStatus: undefined,
      pendingAction: "replace",
    });
    const result = await replaceProviderConnectionKey(providerId, apiKey);
    set((state) => ({
      ...applyMutationResult(result, state.connections),
      pendingAction: null,
    }));
    return result;
  },
  revokeProviderConnection: async (providerId) => {
    set({
      mutationMessage: undefined,
      mutationStatus: undefined,
      pendingAction: "revoke",
    });
    const result = await revokeProviderConnectionKey(providerId);
    set((state) => ({
      ...applyMutationResult(result, state.connections),
      pendingAction: null,
    }));
    return result;
  },
  saveProviderConnection: async (providerId, apiKey) => {
    set({
      mutationMessage: undefined,
      mutationStatus: undefined,
      pendingAction: "save",
    });
    const result = await saveProviderConnectionKey(providerId, apiKey);
    set((state) => ({
      ...applyMutationResult(result, state.connections),
      pendingAction: null,
    }));
    return result;
  },
  testProviderConnection: async (providerId) => {
    set({
      mutationMessage: undefined,
      mutationStatus: undefined,
      pendingAction: "test",
    });
    const result = await testProviderConnectionKey(providerId);
    set((state) => ({
      ...applyMutationResult(result, state.connections),
      pendingAction: null,
    }));
    return result;
  },
}));
