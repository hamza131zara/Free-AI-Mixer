export type ExportHistoryStatus =
  | "submitted"
  | "rendering"
  | "finalizing"
  | "success"
  | "error"
  | "expired";

export interface ExportHistorySummary {
  jobId: string;
  timelineId: string;
  status: ExportHistoryStatus;
  requestedAt: string;
  completedAt?: string;
}

export type ExportHistoryStatusResult =
  | {
      kind: "authenticated";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      historyState: "not_enabled_yet" | "persistence_unavailable";
      exports: ExportHistorySummary[];
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
      code: "workspace_required";
      message: string;
    }
  | {
      kind: "unavailable";
      status: "unavailable";
      code:
        | "auth_not_configured"
        | "auth_provider_unavailable"
        | "workspace_runtime_not_configured"
        | "export_history_service_unreachable";
      message: string;
    };
