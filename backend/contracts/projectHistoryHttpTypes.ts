export interface BackendProjectSummary {
  id: string;
  name: string;
  timelineCount: number;
  sceneCount: number;
  updatedAt?: string;
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
      persistence: "not_enabled_yet" | "persistence_unavailable";
      projects: BackendProjectSummary[];
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
