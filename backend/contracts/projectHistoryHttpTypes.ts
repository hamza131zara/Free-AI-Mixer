export interface BackendProjectRecord {
  projectId: string;
  title: string;
  status: "active" | "archived" | "deleted";
  createdAt: string;
  updatedAt: string;
}

export type BackendExportHistoryStatus =
  | "submitted"
  | "rendering"
  | "finalizing"
  | "success"
  | "error"
  | "expired";

export interface BackendExportHistorySummary {
  jobId: string;
  timelineId: string;
  status: BackendExportHistoryStatus;
  requestedAt: string;
  completedAt?: string;
}

export type BackendProjectLibraryResponse =
  | {
      kind: "project_library";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      persistence: "durable" | "not_enabled_yet" | "persistence_unavailable";
      projects: BackendProjectRecord[];
    }
  | {
      kind: "project_library_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "project_library_forbidden";
      status: "workspace_required";
      message: string;
    }
  | {
      kind: "project_library_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured";
      message: string;
    };

export type BackendProjectMutationResponse =
  | {
      kind: "project_record";
      status: "created" | "loaded" | "updated";
      project: BackendProjectRecord;
    }
  | {
      kind: "project_request_invalid";
      status: "invalid_request" | "invalid_project_id" | "invalid_title";
      message: string;
    }
  | {
      kind: "project_not_found";
      status: "not_found";
      message: string;
    }
  | {
      kind: "project_library_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "project_library_forbidden";
      status: "workspace_required";
      message: string;
    }
  | {
      kind: "project_library_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured"
        | "persistence_unavailable"
        | "repository_unavailable";
      message: string;
    };

export type BackendExportHistoryResponse =
  | {
      kind: "export_history";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      historyState: "not_enabled_yet" | "persistence_unavailable";
      exports: BackendExportHistorySummary[];
    }
  | {
      kind: "export_history_sign_in_required";
      status: "unauthenticated";
      reason: "missing_credentials" | "invalid_credentials";
      message: string;
    }
  | {
      kind: "export_history_forbidden";
      status: "workspace_required";
      message: string;
    }
  | {
      kind: "export_history_unavailable";
      status:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured";
      message: string;
    };
