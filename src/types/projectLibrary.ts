export interface ProjectSummary {
  id: string;
  name: string;
  timelineCount: number;
  sceneCount: number;
  updatedAt?: string;
}

export type ProjectLibraryStatusResult =
  | {
      kind: "authenticated";
      status: "authenticated";
      message: string;
      activeWorkspaceId?: string;
      persistence: "not_enabled_yet";
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
        | "project_library_service_unreachable";
      message: string;
    };
