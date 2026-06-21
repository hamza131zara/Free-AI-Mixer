import type {
  ProjectLibraryStatusResult,
  ProjectRecordResult,
  ProjectSummary,
} from "../types/projectLibrary";
import { fetchWithOptionalAccountBearer } from "./auth/authenticatedFetch";

interface BackendAuthenticatedProjectLibraryResponse {
  kind: "project_library";
  status: "authenticated";
  message?: string;
  activeWorkspaceId?: string;
  persistence: "durable" | "not_enabled_yet" | "persistence_unavailable";
  projects: ProjectSummary[];
}

interface BackendProjectRecordResponse {
  kind: "project_record";
  status: "created" | "loaded" | "updated";
  project: ProjectSummary;
}

interface BackendInvalidProjectRequestResponse {
  kind: "project_request_invalid";
  status: "invalid_request" | "invalid_project_id" | "invalid_title";
  message?: string;
}

interface BackendProjectNotFoundResponse {
  kind: "project_not_found";
  status: "not_found";
  message?: string;
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
    | "workspace_runtime_not_configured"
    | "persistence_unavailable"
    | "repository_unavailable";
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

type BackendProjectMutationResponse =
  | BackendProjectRecordResponse
  | BackendInvalidProjectRequestResponse
  | BackendProjectNotFoundResponse
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

type ProjectLibraryUnavailableResult = Extract<
  ProjectLibraryStatusResult,
  { kind: "unavailable" }
>;

type ProjectRecordUnavailableResult = Extract<
  ProjectRecordResult,
  { kind: "unavailable" }
>;

type ProjectUnavailableCode = ProjectLibraryUnavailableResult["code"];

const toProjectLibraryUnavailable = (
  message: string,
  code: ProjectLibraryUnavailableResult["code"] =
    "project_library_service_unreachable",
): ProjectLibraryUnavailableResult => ({
  kind: "unavailable",
  status: "unavailable",
  code,
  message,
});

const toProjectRecordUnavailable = (
  message: string,
  code: ProjectRecordUnavailableResult["code"] =
    "project_library_service_unreachable",
): ProjectRecordUnavailableResult => ({
  kind: "unavailable",
  status: "unavailable",
  code,
  message,
});

type ProjectFailureResult = Exclude<
  ProjectLibraryStatusResult,
  { kind: "authenticated" }
>;

const mapSharedProjectFailureResponse = (
  payload:
    | BackendUnauthenticatedProjectLibraryResponse
    | BackendForbiddenProjectLibraryResponse
    | BackendUnavailableProjectLibraryResponse,
): ProjectFailureResult => {
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

  return toProjectLibraryUnavailable(
    payload.message ??
      (payload.status === "auth_not_configured"
        ? "Authentication is not configured on this backend yet."
        : payload.status === "workspace_runtime_not_configured"
          ? "Workspace authority is not configured on this backend yet."
          : payload.status === "persistence_unavailable"
            ? "Durable project persistence is not configured."
            : payload.status === "repository_unavailable"
              ? "Project persistence is temporarily unavailable."
              : "Project library is configured behind auth, but not available in this product phase."),
    payload.status,
  );
};

const mapProjectLibraryResponse = (
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

  return mapSharedProjectFailureResponse(payload);
};

export const getProjectLibraryStatus = async (): Promise<ProjectLibraryStatusResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(projectLibraryEndpoint, {
      method: "GET",
      credentials: "same-origin",
    });
    const payload = await parseJson<BackendProjectLibraryResponse>(response);

    if (!payload) {
      return toProjectLibraryUnavailable("Project library returned an empty response.");
    }

    return mapProjectLibraryResponse(payload);
  } catch {
    return toProjectLibraryUnavailable(
      "Project library is currently unavailable because the backend boundary could not be reached.",
    );
  }
};

export const listProjects = getProjectLibraryStatus;

const mapProjectMutationResponse = (
  payload: BackendProjectMutationResponse,
): ProjectRecordResult => {
  if (payload.kind === "project_record") {
    return {
      kind: "project",
      status: payload.status,
      project: payload.project,
    };
  }

  if (payload.kind === "project_request_invalid") {
    return toProjectRecordUnavailable(
      payload.message ?? "Project request is invalid.",
      payload.status,
    );
  }

  if (payload.kind === "project_not_found") {
    return toProjectRecordUnavailable(
      payload.message ?? "Project was not found.",
      "not_found",
    );
  }

  return mapSharedProjectFailureResponse(payload);
};

const requestProjectRecord = async (
  endpoint: string,
  init: RequestInit,
): Promise<ProjectRecordResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(endpoint, {
      credentials: "same-origin",
      ...init,
    });
    const payload = await parseJson<BackendProjectMutationResponse>(response);

    if (!payload) {
      return toProjectRecordUnavailable("Project request returned an empty response.");
    }

    return mapProjectMutationResponse(payload);
  } catch {
    return toProjectRecordUnavailable(
      "Project request is currently unavailable because the backend boundary could not be reached.",
    );
  }
};

export const createProject = async (
  title: string,
): Promise<ProjectRecordResult> =>
  requestProjectRecord(projectLibraryEndpoint, {
    body: JSON.stringify({ title }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

export const getProject = async (
  projectId: string,
): Promise<ProjectRecordResult> =>
  requestProjectRecord(
    `${projectLibraryEndpoint}/${encodeURIComponent(projectId)}`,
    {
      method: "GET",
    },
  );

export const updateProjectTitle = async (
  projectId: string,
  title: string,
): Promise<ProjectRecordResult> =>
  requestProjectRecord(
    `${projectLibraryEndpoint}/${encodeURIComponent(projectId)}`,
    {
      body: JSON.stringify({ title }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    },
  );
