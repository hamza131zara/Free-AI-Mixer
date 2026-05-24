import { create } from "zustand";
import {
  getProviderCatalog,
  getProviderConnections,
  getProviderRoutingPolicy,
  getProviderSettingsStatus,
} from "../services/providerSettingsService";
import type {
  ProviderCatalogEntry,
  ProviderRoutingPreferences,
  ProviderSettingsStatusResult,
  RedactedProviderConnectionSummary,
} from "../types/providerSettings";

export interface ProviderSettingsStoreState {
  catalogStatus: "unknown" | "ready" | "unavailable";
  catalogMessage: string;
  providers: ProviderCatalogEntry[];
  accessStatus: "unknown" | "authenticated" | "unauthenticated" | "unavailable";
  accessMessage: string;
  accessReasonCode?: string;
  activeWorkspaceId?: string;
  routingPreferences?: ProviderRoutingPreferences;
  connections: RedactedProviderConnectionSummary[];
  pendingAction: "refresh" | null;
  refreshProviderSettings: () => Promise<void>;
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

  return {
    accessStatus: "unavailable",
    accessMessage: result.message,
    accessReasonCode: result.code,
    activeWorkspaceId: undefined,
    routingPreferences: defaultRoutingPreferences,
    connections: [],
  };
};

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
}));
