import { create } from "zustand";
import { getProjectLibraryStatus } from "../services/projectLibraryService";
import type { ProjectSummary } from "../types/projectLibrary";

export interface ProjectLibraryStoreState {
  accessStatus:
    | "unknown"
    | "authenticated"
    | "unauthenticated"
    | "forbidden"
    | "unavailable";
  accessMessage: string;
  accessReasonCode?: string;
  activeWorkspaceId?: string;
  persistence: "not_enabled_yet" | "persistence_unavailable";
  projects: ProjectSummary[];
  pendingAction: "refresh" | null;
  refreshProjectLibrary: () => Promise<void>;
}

const unknownMessage = "Checking project library access.";

export const useProjectLibraryStore = create<ProjectLibraryStoreState>((set) => ({
  accessStatus: "unknown",
  accessMessage: unknownMessage,
  accessReasonCode: undefined,
  activeWorkspaceId: undefined,
  persistence: "not_enabled_yet",
  projects: [],
  pendingAction: null,
  refreshProjectLibrary: async () => {
    set({ pendingAction: "refresh" });
    const result = await getProjectLibraryStatus();

    if (result.kind === "authenticated") {
      set({
        accessStatus: "authenticated",
        accessMessage: result.message,
        accessReasonCode: undefined,
        activeWorkspaceId: result.activeWorkspaceId,
        persistence: result.persistence,
        projects: result.projects,
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
        persistence: "not_enabled_yet",
        projects: [],
        pendingAction: null,
      });
      return;
    }

    if (result.kind === "forbidden") {
      set({
        accessStatus: "forbidden",
        accessMessage: result.message,
        accessReasonCode: result.code,
        activeWorkspaceId: undefined,
        persistence: "not_enabled_yet",
        projects: [],
        pendingAction: null,
      });
      return;
    }

    set({
      accessStatus: "unavailable",
      accessMessage: result.message,
      accessReasonCode: result.code,
      activeWorkspaceId: undefined,
      persistence: "not_enabled_yet",
      projects: [],
      pendingAction: null,
    });
  },
}));
