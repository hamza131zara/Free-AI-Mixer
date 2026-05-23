import { create } from "zustand";
import { getExportHistoryStatus } from "../services/exportHistoryService";
import type { ExportHistorySummary } from "../types/exportHistory";

export interface ExportHistoryStoreState {
  accessStatus: "unknown" | "authenticated" | "unauthenticated" | "unavailable";
  accessMessage: string;
  accessReasonCode?: string;
  activeWorkspaceId?: string;
  historyState: "not_enabled_yet";
  exports: ExportHistorySummary[];
  pendingAction: "refresh" | null;
  refreshExportHistory: () => Promise<void>;
}

const unknownMessage = "Checking export history access.";

export const useExportHistoryStore = create<ExportHistoryStoreState>((set) => ({
  accessStatus: "unknown",
  accessMessage: unknownMessage,
  accessReasonCode: undefined,
  activeWorkspaceId: undefined,
  historyState: "not_enabled_yet",
  exports: [],
  pendingAction: null,
  refreshExportHistory: async () => {
    set({ pendingAction: "refresh" });
    const result = await getExportHistoryStatus();

    if (result.kind === "authenticated") {
      set({
        accessStatus: "authenticated",
        accessMessage: result.message,
        accessReasonCode: undefined,
        activeWorkspaceId: result.activeWorkspaceId,
        historyState: result.historyState,
        exports: result.exports,
        pendingAction: null,
      });
      return;
    }

    if (result.kind === "unauthenticated") {
      set({
        accessStatus: "unauthenticated",
        accessMessage: result.message,
        accessReasonCode: result.reason,
        activeWorkspaceId: undefined,
        historyState: "not_enabled_yet",
        exports: [],
        pendingAction: null,
      });
      return;
    }

    set({
      accessStatus: "unavailable",
      accessMessage: result.message,
      accessReasonCode: result.code,
      activeWorkspaceId: undefined,
      historyState: "not_enabled_yet",
      exports: [],
      pendingAction: null,
    });
  },
}));
