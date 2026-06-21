import { create } from "zustand";
import {
  createProject as createProjectRecord,
  getProject,
  getProjectLibraryStatus,
  updateProjectTitle,
} from "../services/projectLibraryService";
import type {
  ProjectLibraryOperationStatus,
  ProjectRecordResult,
  ProjectSummary,
} from "../types/projectLibrary";

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
  persistence: "durable" | "not_enabled_yet" | "persistence_unavailable";
  projects: ProjectSummary[];
  selectedProject?: ProjectSummary;
  operationStatus: ProjectLibraryOperationStatus;
  pendingAction: "refresh" | "create" | "open" | "rename" | null;
  refreshProjectLibrary: () => Promise<void>;
  createProject: (title: string) => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, title: string) => Promise<void>;
}

const unknownMessage = "Checking project library access.";

export const useProjectLibraryStore = create<ProjectLibraryStoreState>((set) => ({
  accessStatus: "unknown",
  accessMessage: unknownMessage,
  accessReasonCode: undefined,
  activeWorkspaceId: undefined,
  persistence: "not_enabled_yet",
  projects: [],
  selectedProject: undefined,
  operationStatus: "idle",
  pendingAction: null,
  refreshProjectLibrary: async () => {
    set({ operationStatus: "loading", pendingAction: "refresh" });
    const result = await getProjectLibraryStatus();

    if (result.kind === "authenticated") {
      set((current) => ({
        accessStatus: "authenticated",
        accessMessage: result.message,
        accessReasonCode: undefined,
        activeWorkspaceId: result.activeWorkspaceId,
        persistence: result.persistence,
        projects: result.projects,
        selectedProject: current.selectedProject
          ? result.projects.find(
              (project) =>
                project.projectId === current.selectedProject?.projectId,
            ) ?? current.selectedProject
          : undefined,
        operationStatus: result.projects.length === 0 ? "empty" : "idle",
        pendingAction: null,
      }));
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
        selectedProject: undefined,
        operationStatus: "idle",
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
        selectedProject: undefined,
        operationStatus: "unavailable",
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
      selectedProject: undefined,
      operationStatus: "unavailable",
      pendingAction: null,
    });
  },
  createProject: async (title: string) => {
    set({ operationStatus: "creating", pendingAction: "create" });
    const result = await createProjectRecord(title);

    if (result.kind === "project") {
      set((state) => {
        const projects = [
          result.project,
          ...state.projects.filter(
            (project) => project.projectId !== result.project.projectId,
          ),
        ];

        return {
          accessStatus: "authenticated",
          accessMessage: "Project metadata was persisted for this workspace.",
          accessReasonCode: undefined,
          persistence: "durable",
          projects,
          selectedProject: result.project,
          operationStatus: "idle",
          pendingAction: null,
        };
      });
      return;
    }

    applyProjectFailureResult(result);
  },
  openProject: async (projectId: string) => {
    set({ operationStatus: "opening", pendingAction: "open" });
    const result = await getProject(projectId);

    if (result.kind === "project") {
      set((state) => ({
        projects: state.projects.some(
          (project) => project.projectId === result.project.projectId,
        )
          ? state.projects.map((project) =>
              project.projectId === result.project.projectId
                ? result.project
                : project,
            )
          : [result.project, ...state.projects],
        selectedProject: result.project,
        operationStatus: "idle",
        pendingAction: null,
      }));
      return;
    }

    applyProjectFailureResult(result);
  },
  renameProject: async (projectId: string, title: string) => {
    set({ operationStatus: "renaming", pendingAction: "rename" });
    const result = await updateProjectTitle(projectId, title);

    if (result.kind === "project") {
      set((state) => ({
        accessMessage: "Project title was updated in durable project metadata.",
        projects: state.projects.map((project) =>
          project.projectId === result.project.projectId
            ? result.project
            : project,
        ),
        selectedProject:
          state.selectedProject?.projectId === result.project.projectId
            ? result.project
            : state.selectedProject,
        operationStatus: "idle",
        pendingAction: null,
      }));
      return;
    }

    applyProjectFailureResult(result);
  },
}));

const applyProjectFailureResult = (
  result: Exclude<ProjectRecordResult, { kind: "project" }>,
): void => {
  if (result.kind === "unauthenticated") {
    useProjectLibraryStore.setState({
      accessStatus: "unauthenticated",
      accessMessage: result.message,
      accessReasonCode: result.reason,
      projects: [],
      selectedProject: undefined,
      operationStatus: "idle",
      pendingAction: null,
    });
    return;
  }

  if (result.kind === "forbidden") {
    useProjectLibraryStore.setState({
      accessStatus: "forbidden",
      accessMessage: result.message,
      accessReasonCode: result.code,
      projects: [],
      selectedProject: undefined,
      operationStatus: "unavailable",
      pendingAction: null,
    });
    return;
  }

  useProjectLibraryStore.setState({
    accessStatus:
      result.code === "not_found" ||
      result.code === "invalid_project_id" ||
      result.code === "invalid_title" ||
      result.code === "invalid_request"
        ? useProjectLibraryStore.getState().accessStatus
        : "unavailable",
    accessMessage: result.message,
    accessReasonCode: result.code,
    operationStatus:
      result.code === "not_found"
        ? "not_found"
        : result.code === "invalid_project_id" ||
            result.code === "invalid_title" ||
            result.code === "invalid_request"
          ? "validation_error"
          : "unavailable",
    pendingAction: null,
  });
};
