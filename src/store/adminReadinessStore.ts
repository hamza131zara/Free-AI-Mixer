import { create } from "zustand";
import { getAdminReadinessStatus } from "../services/adminReadinessService";
import type { AdminStatusSummary } from "../types/adminRoles";

export interface AdminReadinessStoreState {
  status: AdminStatusSummary["status"] | "unknown";
  message: string;
  summary?: AdminStatusSummary;
  pendingAction: "refresh" | null;
  refreshStatus: () => Promise<void>;
}

const unknownMessage = "Checking admin readiness status.";

export const useAdminReadinessStore = create<AdminReadinessStoreState>((set) => ({
  status: "unknown",
  message: unknownMessage,
  summary: undefined,
  pendingAction: null,
  refreshStatus: async () => {
    set({ pendingAction: "refresh" });
    const result = await getAdminReadinessStatus();
    set({
      status: result.status,
      message: result.message,
      summary: result,
      pendingAction: null,
    });
  },
}));
