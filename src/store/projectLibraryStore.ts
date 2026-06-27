import { create } from "zustand";
import {
  clearActiveProject as clearActiveProjectPreference,
  createProject as createProjectRecord,
  deleteProject as deleteProjectRecord,
  getProjectLibraryStatus,
  setActiveProject as persistActiveProject,
  updateProjectTitle,
} from "../services/projectLibraryService";
import type {
  ActiveProjectMutationResult,
  ProjectLibraryOperationStatus,
  ProjectDeletionResult,
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
  preferenceStatus: "unknown" | "ready" | "persistence_unavailable";
  capabilities: {
    canDeleteProjects: boolean;
  };
  projects: ProjectSummary[];
  activeProject?: ProjectSummary;
  operationStatus: ProjectLibraryOperationStatus;
  pendingAction: "refresh" | "create" | "open" | "rename" | "delete" | "clear" | null;
  pendingProjectId?: string;
  refreshProjectLibrary: (
    requestedProjectId?: string,
    suppressServerPreference?: boolean,
  ) => Promise<void>;
  createProject: (title: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<boolean>;
  selectActiveProject: (projectId: string) => Promise<void>;
  clearActiveProject: () => Promise<void>;
  clearRuntimeProjectContext: () => void;
  renameProject: (projectId: string, title: string) => Promise<void>;
}

const unknownMessage = "Checking project library access.";
let requestEpoch = 0;

const nextRequestEpoch = (): number => {
  requestEpoch += 1;
  return requestEpoch;
};

const isCurrentRequest = (epoch: number): boolean => epoch === requestEpoch;

const runtimeClearedState = {
  accessStatus: "unknown" as const,
  accessMessage: unknownMessage,
  accessReasonCode: undefined,
  activeWorkspaceId: undefined,
  persistence: "not_enabled_yet" as const,
  preferenceStatus: "unknown" as const,
  capabilities: { canDeleteProjects: false },
  projects: [],
  activeProject: undefined,
  operationStatus: "idle" as const,
  pendingAction: null,
  pendingProjectId: undefined,
};

export const useProjectLibraryStore = create<ProjectLibraryStoreState>((set) => ({
  ...runtimeClearedState,
  refreshProjectLibrary: async (
    requestedProjectId,
    suppressServerPreference = false,
  ) => {
    const epoch = nextRequestEpoch();
    set({
      operationStatus: "loading",
      pendingAction: "refresh",
      pendingProjectId: requestedProjectId,
    });
    const result = await getProjectLibraryStatus();

    if (!isCurrentRequest(epoch)) {
      return;
    }

    if (result.kind === "authenticated") {
      const requestedProject = requestedProjectId
        ? result.projects.find((project) => project.projectId === requestedProjectId)
        : undefined;
      const preferredProject =
        !requestedProjectId &&
        !suppressServerPreference &&
        result.activeProjectPreference.status === "ready"
          ? result.projects.find(
              (project) =>
                project.projectId === result.activeProjectPreference.projectId,
            )
          : undefined;

      if (requestedProject) {
        const preferenceResult = await persistActiveProject(
          requestedProject.projectId,
        );

        if (!isCurrentRequest(epoch)) {
          return;
        }

        if (
          preferenceResult.kind !== "active_project" ||
          preferenceResult.status !== "selected"
        ) {
          set({
            accessStatus: "authenticated",
            accessMessage:
              "message" in preferenceResult
                ? preferenceResult.message
                : "Active project preference was not confirmed.",
            accessReasonCode:
              "code" in preferenceResult ? preferenceResult.code : undefined,
            activeWorkspaceId: result.activeWorkspaceId,
            persistence: result.persistence,
            preferenceStatus: result.activeProjectPreference.status,
            capabilities: result.capabilities,
            projects: result.projects,
            activeProject: undefined,
            operationStatus: "unavailable",
            pendingAction: null,
            pendingProjectId: undefined,
          });
          return;
        }

        set({
          accessStatus: "authenticated",
          accessMessage: result.message,
          accessReasonCode: undefined,
          activeWorkspaceId: result.activeWorkspaceId,
          persistence: result.persistence,
          preferenceStatus: "ready",
          capabilities: result.capabilities,
          projects: result.projects,
          activeProject: preferenceResult.activeProject,
          operationStatus: result.projects.length === 0 ? "empty" : "idle",
          pendingAction: null,
          pendingProjectId: undefined,
        });
        return;
      }

      set({
        accessStatus: "authenticated",
        accessMessage: result.message,
        accessReasonCode: undefined,
        activeWorkspaceId: result.activeWorkspaceId,
        persistence: result.persistence,
        preferenceStatus: result.activeProjectPreference.status,
        capabilities: result.capabilities,
        projects: result.projects,
        activeProject: preferredProject,
        operationStatus: result.projects.length === 0 ? "empty" : "idle",
        pendingAction: null,
        pendingProjectId: undefined,
      });
      return;
    }

    applyLibraryFailure(result);
  },
  createProject: async (title) => {
    const epoch = nextRequestEpoch();
    set({ operationStatus: "creating", pendingAction: "create" });
    const result = await createProjectRecord(title);

    if (!isCurrentRequest(epoch)) {
      return;
    }

    if (result.kind === "project") {
      const preferenceResult = await persistActiveProject(result.project.projectId);

      if (!isCurrentRequest(epoch)) {
        return;
      }

      set((state) => ({
        accessStatus: "authenticated",
        accessMessage:
          preferenceResult.kind === "active_project" &&
          preferenceResult.status === "selected"
            ? "Project metadata and active-project preference were persisted."
            : "Project metadata was persisted, but active-project preference is unavailable.",
        accessReasonCode:
          "code" in preferenceResult ? preferenceResult.code : undefined,
        persistence: "durable",
        preferenceStatus:
          preferenceResult.kind === "active_project" &&
          preferenceResult.status === "selected"
            ? "ready"
            : "persistence_unavailable",
        projects: [
          result.project,
          ...state.projects.filter(
            (project) => project.projectId !== result.project.projectId,
          ),
        ],
        activeProject:
          preferenceResult.kind === "active_project" &&
          preferenceResult.status === "selected"
            ? preferenceResult.activeProject
            : undefined,
        operationStatus:
          preferenceResult.kind === "active_project" &&
          preferenceResult.status === "selected"
            ? "idle"
            : "unavailable",
        pendingAction: null,
        pendingProjectId: undefined,
      }));
      return;
    }

    applyProjectFailureResult(result);
  },
  deleteProject: async (projectId) => {
    const epoch = nextRequestEpoch();
    set({
      operationStatus: "deleting",
      pendingAction: "delete",
      pendingProjectId: projectId,
    });
    const result = await deleteProjectRecord(projectId);

    if (!isCurrentRequest(epoch)) {
      return false;
    }

    if (result.kind === "project_deleted") {
      set((state) => ({
        accessMessage: "Project was deleted. Existing generated records remain preserved.",
        accessReasonCode: undefined,
        projects: state.projects.filter(
          (project) => project.projectId !== projectId,
        ),
        activeProject:
          state.activeProject?.projectId === projectId
            ? undefined
            : state.activeProject,
        operationStatus: "deleted",
        pendingAction: null,
        pendingProjectId: undefined,
      }));
      return true;
    }

    applyProjectDeletionFailure(result);
    return false;
  },
  selectActiveProject: async (projectId) => {
    const epoch = nextRequestEpoch();
    set({
      operationStatus: "opening",
      pendingAction: "open",
      pendingProjectId: projectId,
    });
    const result = await persistActiveProject(projectId);

    if (!isCurrentRequest(epoch)) {
      return;
    }

    if (result.kind === "active_project" && result.status === "selected") {
      set((state) => ({
        accessMessage: `Active project: ${result.activeProject.title}`,
        accessReasonCode: undefined,
        preferenceStatus: "ready",
        projects: state.projects.map((project) =>
          project.projectId === result.activeProject.projectId
            ? result.activeProject
            : project,
        ),
        activeProject: result.activeProject,
        operationStatus: "idle",
        pendingAction: null,
        pendingProjectId: undefined,
      }));
      return;
    }

    if (result.kind === "active_project") {
      set({
        accessMessage: "Active project preference was not confirmed.",
        preferenceStatus: "persistence_unavailable",
        operationStatus: "unavailable",
        pendingAction: null,
        pendingProjectId: undefined,
      });
      return;
    }

    applyActiveProjectFailure(result);
  },
  clearActiveProject: async () => {
    const epoch = nextRequestEpoch();
    set({ operationStatus: "loading", pendingAction: "clear" });
    const result = await clearActiveProjectPreference();

    if (!isCurrentRequest(epoch)) {
      return;
    }

    if (result.kind === "active_project" && result.status === "cleared") {
      set({
        activeProject: undefined,
        preferenceStatus: "ready",
        operationStatus: "idle",
        pendingAction: null,
        pendingProjectId: undefined,
      });
      return;
    }

    if (result.kind === "active_project") {
      set({
        accessMessage: "Active project preference clear was not confirmed.",
        preferenceStatus: "persistence_unavailable",
        operationStatus: "unavailable",
        pendingAction: null,
      });
      return;
    }

    applyActiveProjectFailure(result);
  },
  clearRuntimeProjectContext: () => {
    nextRequestEpoch();
    set(runtimeClearedState);
  },
  renameProject: async (projectId, title) => {
    const epoch = nextRequestEpoch();
    set({ operationStatus: "renaming", pendingAction: "rename" });
    const result = await updateProjectTitle(projectId, title);

    if (!isCurrentRequest(epoch)) {
      return;
    }

    if (result.kind === "project") {
      set((state) => ({
        accessMessage: "Project title was updated in durable project metadata.",
        projects: state.projects.map((project) =>
          project.projectId === result.project.projectId
            ? result.project
            : project,
        ),
        activeProject:
          state.activeProject?.projectId === result.project.projectId
            ? result.project
            : state.activeProject,
        operationStatus: "idle",
        pendingAction: null,
      }));
      return;
    }

    applyProjectFailureResult(result);
  },
}));

const applyLibraryFailure = (
  result: Exclude<
    Awaited<ReturnType<typeof getProjectLibraryStatus>>,
    { kind: "authenticated" }
  >,
): void => {
  useProjectLibraryStore.setState({
    accessStatus:
      result.kind === "unauthenticated"
        ? "unauthenticated"
        : result.kind === "forbidden"
          ? "forbidden"
          : "unavailable",
    accessMessage: result.message,
    accessReasonCode:
      result.kind === "unauthenticated" ? result.reason : result.code,
    activeWorkspaceId: undefined,
    persistence: "not_enabled_yet",
    preferenceStatus: "unknown",
    capabilities: { canDeleteProjects: false },
    projects: [],
    activeProject: undefined,
    operationStatus: result.kind === "unauthenticated" ? "idle" : "unavailable",
    pendingAction: null,
    pendingProjectId: undefined,
  });
};

const applyProjectDeletionFailure = (
  result: Exclude<ProjectDeletionResult, { kind: "project_deleted" }>,
): void => {
  if (result.kind === "unauthenticated") {
    applyLibraryFailure(result);
    return;
  }

  useProjectLibraryStore.setState({
    accessMessage: result.message,
    accessReasonCode: result.code,
    operationStatus:
      result.kind === "unavailable" && result.code === "not_found"
        ? "not_found"
        : "unavailable",
    pendingAction: null,
    pendingProjectId: undefined,
  });
};

const applyProjectFailureResult = (
  result: Exclude<ProjectRecordResult, { kind: "project" }>,
): void => {
  if (result.kind === "unauthenticated" || result.kind === "forbidden") {
    applyLibraryFailure(result);
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
    pendingProjectId: undefined,
  });
};

const applyActiveProjectFailure = (
  result: Exclude<ActiveProjectMutationResult, { kind: "active_project" }>,
): void => {
  if (result.kind === "unauthenticated" || result.kind === "forbidden") {
    applyLibraryFailure(result);
    return;
  }

  useProjectLibraryStore.setState({
    accessMessage: result.message,
    accessReasonCode: result.code,
    preferenceStatus: "persistence_unavailable",
    operationStatus:
      result.code === "not_found" || result.code === "invalid_project_id"
        ? "not_found"
        : "unavailable",
    pendingAction: null,
    pendingProjectId: undefined,
  });
};
