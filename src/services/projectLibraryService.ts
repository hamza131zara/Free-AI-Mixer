import type {
  ActiveProjectMutationResult,
  ProjectDeletionResult,
  ProjectLibraryStatusResult,
  ProjectRecordResult,
  ProjectSummary,
} from "../types/projectLibrary";
import { fetchWithOptionalAccountBearer } from "./auth/authenticatedFetch";
import {
  BackendRequestAbortedError,
  BackendRequestPolicyError,
  createBackendRequestPolicy,
  type BackendRequestRetryReason,
} from "./backendRequestPolicy";

interface BackendAuthenticatedProjectLibraryResponse {
  kind: "project_library";
  status: "authenticated";
  message?: string;
  activeWorkspaceId?: string;
  persistence: "durable" | "not_enabled_yet" | "persistence_unavailable";
  capabilities?: {
    canDeleteProjects: boolean;
  };
  activeProjectPreference:
    | { status: "ready"; projectId: string | null }
    | { status: "persistence_unavailable"; projectId: null };
  projects: ProjectSummary[];
}

interface BackendProjectRecordResponse {
  kind: "project_record";
  status: "created" | "loaded" | "updated";
  project: ProjectSummary;
}

type BackendActiveProjectResponse =
  | {
      kind: "active_project";
      status: "selected";
      activeProject: ProjectSummary;
    }
  | {
      kind: "active_project";
      status: "cleared";
      activeProject: null;
    };

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

interface BackendProjectDeletedResponse {
  kind: "project_deleted";
  status: "deleted";
  projectId: string;
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

interface BackendProjectDeleteForbiddenResponse {
  kind: "project_delete_forbidden";
  status: "workspace_owner_or_admin_required";
  message?: string;
}

type BackendProjectLibraryResponse =
  | BackendAuthenticatedProjectLibraryResponse
  | BackendUnauthenticatedProjectLibraryResponse
  | BackendForbiddenProjectLibraryResponse
  | BackendUnavailableProjectLibraryResponse;

type BackendProjectMutationResponse =
  | BackendProjectRecordResponse
  | BackendActiveProjectResponse
  | BackendInvalidProjectRequestResponse
  | BackendProjectNotFoundResponse
  | BackendProjectDeletedResponse
  | BackendUnauthenticatedProjectLibraryResponse
  | BackendForbiddenProjectLibraryResponse
  | BackendProjectDeleteForbiddenResponse
  | BackendUnavailableProjectLibraryResponse;

type BackendProjectRecordMutationResponse = Exclude<
  BackendProjectMutationResponse,
  BackendActiveProjectResponse | BackendProjectDeletedResponse | BackendProjectDeleteForbiddenResponse
>;

const projectLibraryEndpoint = "/project-library/projects";
const activeProjectEndpoint = "/project-library/active-project";
const fetchProjectBootstrapRead = createBackendRequestPolicy({
  fetch: (input, init) =>
    fetchWithOptionalAccountBearer(String(input), init),
});

export interface ProjectLibraryRequestOptions {
  onRetry?: (reason: BackendRequestRetryReason) => void;
}

interface ProjectLibraryFlight {
  controller: AbortController;
  promise: Promise<ProjectLibraryStatusResult>;
  retryListeners: Set<(reason: BackendRequestRetryReason) => void>;
  revision: number;
}

let projectRequestRevision = 0;
let projectLibraryFlight: ProjectLibraryFlight | undefined;
const activeProjectFlights = new Map<
  string,
  Promise<ActiveProjectMutationResult>
>();

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
    | BackendProjectDeleteForbiddenResponse
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

  if (payload.kind === "project_delete_forbidden") {
    return {
      kind: "forbidden",
      status: "forbidden",
      code: "workspace_owner_or_admin_required",
      message:
        payload.message ??
        "Workspace owner or admin permission is required to delete a project.",
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
      capabilities: payload.capabilities ?? { canDeleteProjects: false },
      activeProjectPreference: payload.activeProjectPreference ?? {
        status: "persistence_unavailable",
        projectId: null,
      },
      projects: payload.projects,
    };
  }

  return mapSharedProjectFailureResponse(payload);
};

const requestProjectLibraryStatus = async (
  controller: AbortController,
  onRetry: (reason: BackendRequestRetryReason) => void,
): Promise<ProjectLibraryStatusResult> => {
  try {
    const response = await fetchProjectBootstrapRead(
      projectLibraryEndpoint,
      {
        method: "GET",
        credentials: "same-origin",
      },
      {
        mode: "bootstrap_read_once",
        onRetry,
        signal: controller.signal,
      },
    );
    const payload = await parseJson<BackendProjectLibraryResponse>(response);

    if (!payload) {
      return toProjectLibraryUnavailable("Project library returned an empty response.");
    }

    return mapProjectLibraryResponse(payload);
  } catch (error) {
    if (error instanceof BackendRequestAbortedError) {
      throw error;
    }

    return toProjectLibraryUnavailable(
      error instanceof BackendRequestPolicyError &&
        error.code === "backend_wake_timeout"
        ? "The backend did not become ready in time. Project context was not changed."
        : "Project restoration is temporarily unavailable. Project context was not changed.",
    );
  }
};

export const invalidateProjectLibraryRequests = (): void => {
  projectRequestRevision += 1;
  projectLibraryFlight?.controller.abort();
  projectLibraryFlight = undefined;
  activeProjectFlights.clear();
};

export const getProjectLibraryStatus = (
  options: ProjectLibraryRequestOptions = {},
): Promise<ProjectLibraryStatusResult> => {
  if (projectLibraryFlight?.revision === projectRequestRevision) {
    if (options.onRetry) {
      projectLibraryFlight.retryListeners.add(options.onRetry);
    }
    return projectLibraryFlight.promise;
  }

  const controller = new AbortController();
  const retryListeners = new Set<(reason: BackendRequestRetryReason) => void>();
  if (options.onRetry) {
    retryListeners.add(options.onRetry);
  }
  const revision = projectRequestRevision;
  let flight: ProjectLibraryFlight;
  const promise = requestProjectLibraryStatus(controller, (reason) => {
    flight.retryListeners.forEach((listener) => listener(reason));
  }).finally(() => {
    if (projectLibraryFlight === flight) {
      projectLibraryFlight = undefined;
    }
  });
  flight = { controller, promise, retryListeners, revision };
  projectLibraryFlight = flight;
  return promise;
};

export const listProjects = getProjectLibraryStatus;

const mapProjectMutationResponse = (
  payload: BackendProjectRecordMutationResponse,
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
    const payload = await parseJson<BackendProjectRecordMutationResponse>(response);

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

const requestActiveProjectMutation = async (
  init: RequestInit,
): Promise<ActiveProjectMutationResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(activeProjectEndpoint, {
      credentials: "same-origin",
      ...init,
    });
    const payload = await parseJson<BackendProjectMutationResponse>(response);

    if (!payload) {
      return toProjectRecordUnavailable(
        "Active project request returned an empty response.",
      );
    }

    if (payload.kind === "active_project") {
      if (payload.status === "selected") {
        return {
          kind: "active_project",
          status: "selected",
          activeProject: payload.activeProject,
        };
      }

      return {
        kind: "active_project",
        status: "cleared",
        activeProject: null,
      };
    }

    if (payload.kind === "project_request_invalid") {
      return toProjectRecordUnavailable(
        payload.message ?? "Active project request is invalid.",
        payload.status,
      );
    }

    if (payload.kind === "project_not_found") {
      return toProjectRecordUnavailable(
        payload.message ?? "Project was not found.",
        "not_found",
      );
    }

    if (payload.kind === "project_record") {
      return toProjectRecordUnavailable(
        "Active project response was not recognized.",
      );
    }

    if (payload.kind === "project_deleted") {
      return toProjectRecordUnavailable(
        "Active project response was not recognized.",
      );
    }

    return mapSharedProjectFailureResponse(payload);
  } catch {
    return toProjectRecordUnavailable(
      "Active project preference is currently unavailable.",
    );
  }
};

export const setActiveProject = async (
  projectId: string,
): Promise<ActiveProjectMutationResult> => {
  const key = `${projectRequestRevision}:${projectId}`;
  const existing = activeProjectFlights.get(key);
  if (existing) {
    return existing;
  }

  const revision = projectRequestRevision;
  let flight: Promise<ActiveProjectMutationResult>;
  flight = requestActiveProjectMutation({
    body: JSON.stringify({ projectId }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  }).finally(() => {
    if (
      revision === projectRequestRevision &&
      activeProjectFlights.get(key) === flight
    ) {
      activeProjectFlights.delete(key);
    }
  });
  activeProjectFlights.set(key, flight);
  return flight;
};

export const clearActiveProject = async (): Promise<ActiveProjectMutationResult> =>
  requestActiveProjectMutation({ method: "DELETE" });

export const deleteProject = async (
  projectId: string,
): Promise<ProjectDeletionResult> => {
  try {
    const response = await fetchWithOptionalAccountBearer(
      `${projectLibraryEndpoint}/${encodeURIComponent(projectId)}`,
      {
        credentials: "same-origin",
        method: "DELETE",
      },
    );
    const payload = await parseJson<BackendProjectMutationResponse>(response);

    if (!payload) {
      return toProjectRecordUnavailable(
        "Project deletion returned an empty response.",
      );
    }

    if (
      payload.kind === "project_deleted" &&
      payload.projectId === projectId
    ) {
      return {
        kind: "project_deleted",
        status: "deleted",
        projectId: payload.projectId,
      };
    }

    if (payload.kind === "project_deleted") {
      return toProjectRecordUnavailable(
        "Project deletion response could not be verified.",
      );
    }

    if (payload.kind === "project_request_invalid") {
      return toProjectRecordUnavailable(
        payload.message ?? "Project deletion request is invalid.",
        payload.status,
      );
    }

    if (payload.kind === "project_not_found") {
      return toProjectRecordUnavailable(
        payload.message ?? "Project was not found.",
        "not_found",
      );
    }

    if (payload.kind === "project_record" || payload.kind === "active_project") {
      return toProjectRecordUnavailable(
        "Project deletion response was not recognized.",
      );
    }

    return mapSharedProjectFailureResponse(payload);
  } catch {
    return toProjectRecordUnavailable(
      "Project deletion is temporarily unavailable.",
    );
  }
};
