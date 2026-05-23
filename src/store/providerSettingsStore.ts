import { create } from "zustand";
import {
  getProviderCatalog,
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
  fallback: {
    enabled: false,
    orderedProviderIds: [],
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
    const [catalogResult, statusResult] = await Promise.all([
      getProviderCatalog(),
      getProviderSettingsStatus(),
    ]);

    set({
      catalogStatus: catalogResult.providers.length > 0 ? "ready" : "unavailable",
      catalogMessage: catalogResult.message,
      providers: catalogResult.providers,
      ...applyStatusResult(statusResult),
      pendingAction: null,
    });
  },
}));
