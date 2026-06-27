export interface ProjectSummary {
  projectId: string;
  title: string;
  status: "active" | "archived" | "deleted";
  createdAt: string;
  updatedAt: string;
}

export type ActiveProjectPreference =
  | {
      status: "ready";
      projectId: string | null;
    }
  | {
      status: "persistence_unavailable";
      projectId: null;
    };

export type ProjectLibraryOperationStatus =
  | "idle"
  | "loading"
  | "creating"
  | "opening"
  | "renaming"
  | "deleting"
  | "deleted"
  | "empty"
  | "not_found"
  | "validation_error"
  | "unavailable";

export type ProjectLibraryStatusResult =
  | {
      kind: "authenticated";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      persistence: "durable" | "not_enabled_yet" | "persistence_unavailable";
      capabilities: {
        canDeleteProjects: boolean;
      };
      activeProjectPreference: ActiveProjectPreference;
      projects: ProjectSummary[];
    }
  | {
      kind: "unauthenticated";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "forbidden";
      status: "forbidden";
      code: "workspace_required" | "workspace_owner_or_admin_required";
      message: string;
    }
  | {
      kind: "unavailable";
      status: "unavailable";
      code:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured"
        | "persistence_unavailable"
        | "repository_unavailable"
        | "invalid_request"
        | "invalid_project_id"
        | "invalid_title"
        | "not_found"
        | "project_library_service_unreachable";
      message: string;
    };

export type ProjectRecordResult =
  | {
      kind: "project";
      status: "created" | "loaded" | "updated";
      project: ProjectSummary;
    }
  | Extract<ProjectLibraryStatusResult, { kind: "unauthenticated" }>
  | Extract<ProjectLibraryStatusResult, { kind: "forbidden" }>
  | Extract<ProjectLibraryStatusResult, { kind: "unavailable" }>;

export type ActiveProjectMutationResult =
  | {
      kind: "active_project";
      status: "selected";
      activeProject: ProjectSummary;
    }
  | {
      kind: "active_project";
      status: "cleared";
      activeProject: null;
    }
  | Extract<ProjectLibraryStatusResult, { kind: "unauthenticated" }>
  | Extract<ProjectLibraryStatusResult, { kind: "forbidden" }>
  | Extract<ProjectLibraryStatusResult, { kind: "unavailable" }>;

export type ProjectDeletionResult =
  | {
      kind: "project_deleted";
      status: "deleted";
      projectId: string;
    }
  | Extract<ProjectLibraryStatusResult, { kind: "unauthenticated" }>
  | Extract<ProjectLibraryStatusResult, { kind: "forbidden" }>
  | Extract<ProjectLibraryStatusResult, { kind: "unavailable" }>;
