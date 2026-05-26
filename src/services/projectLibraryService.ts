import type {
  ProjectLibraryStatusResult,
  ProjectSummary,
} from "../types/projectLibrary";

interface BackendAuthenticatedProjectLibraryResponse {
  kind: "project_library";
  status: "authenticated";
  message?: string;
  activeWorkspaceId?: string;
  persistence: "not_enabled_yet";
  projects: ProjectSummary[];
}

interface BackendUnauthenticatedProjectLibraryResponse {
  kind: "project_library_sign_in_required";
  status: "unauthenticated";
  reason: "missing_credentials" | "invalid_credentials";
  message?: string;
}

interface BackendUnavailableProjectLibraryResponse {
  kind: "project_library_unavailable";
  status:
    | "auth_not_configured"
    | "auth_provider_unavailable"
    | "workspace_runtime_not_configured";
  message?: string;
}

interface BackendForbiddenProjectLibraryResponse {
  kind: "project_library_forbidden";
  status: "workspace_required";
  message?: string;
}

type BackendProjectLibraryResponse =
  | BackendAuthenticatedProjectLibraryResponse
  | BackendUnauthenticatedProjectLibraryResponse
  | BackendForbiddenProjectLibraryResponse
  | BackendUnavailableProjectLibraryResponse;

const projectLibraryEndpoint = "/project-library/projects";

const parseJson = async <Payload>(response: Response): Promise<Payload | undefined> => {
  const responseText = await response.text();

  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as Payload;
  } catch {
    return undefined;
  }
};

const toUnavailable = (message: string): ProjectLibraryStatusResult => ({
  kind: "unavailable",
  status: "unavailable",
  code: "project_library_service_unreachable",
  message,
});

const mapResponse = (
  payload: BackendProjectLibraryResponse,
): ProjectLibraryStatusResult => {
  if (payload.kind === "project_library") {
    return {
      kind: "authenticated",
      status: "authenticated",
      message:
        payload.message ??
        "Project library is available for this verified session, but durable saved projects are not enabled yet.",
      activeWorkspaceId: payload.activeWorkspaceId,
      persistence: payload.persistence,
      projects: payload.projects,
    };
  }

  if (payload.kind === "project_library_sign_in_required") {
    return {
      kind: "unauthenticated",
      status: "unauthenticated",
      reason: payload.reason,
      message:
        payload.message ??
        "Sign in is required before account-owned saved projects can appear here.",
    };
  }

  if (payload.kind === "project_library_forbidden") {
    return {
      kind: "forbidden",
      status: "forbidden",
      code: "workspace_required",
      message:
        payload.message ??
        "Workspace access is required before account-owned saved projects can appear here.",
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    code: payload.status,
    message:
      payload.message ??
      (payload.status === "auth_not_configured"
        ? "Authentication is not configured on this backend yet."
        : payload.status === "workspace_runtime_not_configured"
          ? "Workspace authority is not configured on this backend yet."
        : "Project library is configured behind auth, but not available in this product phase."),
  };
};

export const getProjectLibraryStatus = async (): Promise<ProjectLibraryStatusResult> => {
  try {
    const response = await fetch(projectLibraryEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProjectLibraryResponse>(response);

    if (!payload) {
      return toUnavailable("Project library returned an empty response.");
    }

    return mapResponse(payload);
  } catch {
    return toUnavailable(
      "Project library is currently unavailable because the backend boundary could not be reached.",
    );
  }
};
