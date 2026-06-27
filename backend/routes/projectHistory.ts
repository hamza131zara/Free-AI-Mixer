import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { ErrorRequestHandler, Response } from "express";
import type { AsyncBackendRequesterContextResolver } from "../auth/requesterContextResolver";
import { resolveSelectedRouteAccess } from "../auth/protectedRouteGuards";
import type { TrustedAuthProviderRuntimeConfig } from "../auth/trustedAuthProviderRuntimeConfig";
import { isOwnerOrAdminWorkspaceRole } from "../auth/workspaceRoleNormalization";
import { applySensitiveAuthResponseHeaders } from "./sensitiveAuthResponse";
import type {
  BackendExportHistoryResponse,
  BackendActiveProjectPreference,
  BackendProjectMutationResponse,
  BackendProjectLibraryResponse,
  BackendProjectRecord,
} from "../contracts/projectHistoryHttpTypes";
import type { ProductionSupabasePersistenceWriter } from "../persistence/productionSupabasePersistenceBoundary";
import type {
  BackendProjectRecord as RepositoryProjectRecord,
  BackendProjectRepository,
} from "../repositories/repositoryContracts";

export interface CreateProjectHistoryRouterOptions {
  runtimeConfig: TrustedAuthProviderRuntimeConfig;
  routeAccessResolver?: AsyncBackendRequesterContextResolver;
  productionPersistenceWriter?: ProductionSupabasePersistenceWriter;
  projectRepository?: BackendProjectRepository;
}

const projectTitleMaxLength = 120;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unavailableStatus = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): "auth_not_configured" | "auth_provider_unavailable" =>
  runtimeConfig.kind === "auth_provider_not_configured"
    ? "auth_not_configured"
    : "auth_provider_unavailable";

const unavailableMessage = (
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
  scope: "projects" | "history",
): string => {
  if (runtimeConfig.kind === "auth_provider_not_configured") {
    return "Authentication is not configured on this backend yet.";
  }

  return scope === "projects"
    ? "Project library is configured behind auth, but not available in this product phase."
    : "Export history is configured behind auth, but not available in this product phase.";
};

const toProjectRecord = (
  project: RepositoryProjectRecord,
): BackendProjectRecord => ({
  projectId: project.projectId,
  title: project.title,
  status: project.status,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseTitleRequest = (
  value: unknown,
): { kind: "valid"; title: string } | { kind: "invalid"; message: string } => {
  if (!isPlainObject(value)) {
    return {
      kind: "invalid",
      message: "Project request body must be a JSON object.",
    };
  }

  const keys = Object.keys(value);

  if (keys.length !== 1 || keys[0] !== "title") {
    return {
      kind: "invalid",
      message: "Project requests may only include a title field.",
    };
  }

  if (typeof value.title !== "string") {
    return {
      kind: "invalid",
      message: "Project title must be a string.",
    };
  }

  const title = value.title.trim();

  if (title.length === 0) {
    return {
      kind: "invalid",
      message: "Project title is required.",
    };
  }

  if (title.length > projectTitleMaxLength) {
    return {
      kind: "invalid",
      message: `Project title must be ${projectTitleMaxLength} characters or fewer.`,
    };
  }

  return {
    kind: "valid",
    title,
  };
};

const parseActiveProjectRequest = (
  value: unknown,
): { kind: "valid"; projectId: string } | { kind: "invalid" } => {
  if (!isPlainObject(value)) {
    return { kind: "invalid" };
  }

  const keys = Object.keys(value);

  if (
    keys.length !== 1 ||
    keys[0] !== "projectId" ||
    typeof value.projectId !== "string" ||
    !uuidPattern.test(value.projectId)
  ) {
    return { kind: "invalid" };
  }

  return { kind: "valid", projectId: value.projectId };
};

const isValidProjectId = (projectId: string | undefined): projectId is string =>
  typeof projectId === "string" && uuidPattern.test(projectId);

const sendProjectAccessDenied = (
  response: Response,
  accessDecision: Exclude<
    Awaited<ReturnType<typeof resolveSelectedRouteAccess>>,
    { kind: "allowed" }
  >,
  runtimeConfig: TrustedAuthProviderRuntimeConfig,
): void => {
  if (accessDecision.code === "workspace_required") {
    response.status(403).json({
      kind: "project_library_forbidden",
      status: "workspace_required",
      message: accessDecision.message,
    });
    return;
  }

  if (accessDecision.code === "auth_required") {
    response.status(401).json({
      kind: "project_library_sign_in_required",
      status: "unauthenticated",
      reason: "invalid_credentials",
      message:
        "Sign in is required before account-owned saved projects can appear here.",
    });
    return;
  }

  response.status(503).json({
    kind: "project_library_unavailable",
    status:
      accessDecision.code === "workspace_runtime_not_configured"
        ? "workspace_runtime_not_configured"
        : unavailableStatus(runtimeConfig),
    message:
      accessDecision.code === "workspace_runtime_not_configured"
        ? accessDecision.message
        : unavailableMessage(runtimeConfig, "projects"),
  });
};

const sendRepositoryUnavailable = (
  response: Response<BackendProjectMutationResponse>,
): void => {
  response.status(503).json({
    kind: "project_library_unavailable",
    status: "persistence_unavailable",
    message:
      "Durable project persistence is not configured; no account-owned project change was saved.",
  });
};

const createProjectLibraryErrorHandler = (): ErrorRequestHandler => {
  return (_error, _request, response, next) => {
    if (response.headersSent) {
      next(_error);
      return;
    }

    response.status(503).json({
      kind: "project_library_unavailable",
      status: "repository_unavailable",
      message: "Project persistence is temporarily unavailable.",
    });
  };
};

export const createProjectHistoryRouter = (
  options: CreateProjectHistoryRouterOptions,
): Router => {
  const router = Router();

  router.use("/project-library", applySensitiveAuthResponseHeaders);

  router.get(
    "/project-library/projects",
    (request, response: Response<BackendProjectLibraryResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind === "allowed") {
          const requesterContext = accessDecision.requester;
          const persistenceUnavailable = !options.projectRepository;
          const projects = options.projectRepository
            ? await options.projectRepository.listProjectsForWorkspace(
                requesterContext.workspaceId,
              )
            : [];
          let activeProjectPreference: BackendActiveProjectPreference = {
            status: "persistence_unavailable",
            projectId: null,
          };

          if (
            options.projectRepository?.getActiveProjectForWorkspaceUser
          ) {
            try {
              const activeProject =
                await options.projectRepository.getActiveProjectForWorkspaceUser(
                  requesterContext.workspaceId,
                  requesterContext.appUserId,
                );
              activeProjectPreference = {
                status: "ready",
                projectId: activeProject?.projectId ?? null,
              };
            } catch {
              activeProjectPreference = {
                status: "persistence_unavailable",
                projectId: null,
              };
            }
          }

          response.status(200).json({
            kind: "project_library",
            status: "authenticated",
            message: persistenceUnavailable
              ? "Project library is available for this verified session, but durable Supabase persistence is unavailable; browser-local project state remains local/browser-only."
              : "Project library is available for this verified session with durable project metadata persistence.",
            persistence: persistenceUnavailable
              ? "persistence_unavailable"
              : "durable",
            capabilities: {
              canDeleteProjects: isOwnerOrAdminWorkspaceRole(
                requesterContext.workspaceRole,
              ),
            },
            activeProjectPreference,
            projects: projects.map(toProjectRecord),
          });
          return;
        }

        sendProjectAccessDenied(response, accessDecision, options.runtimeConfig);
      })().catch(next);
    },
  );

  router.put(
    "/project-library/active-project",
    (request, response: Response<BackendProjectMutationResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind !== "allowed") {
          sendProjectAccessDenied(response, accessDecision, options.runtimeConfig);
          return;
        }

        const activeProjectRequest = parseActiveProjectRequest(request.body);

        if (activeProjectRequest.kind === "invalid") {
          response.status(400).json({
            kind: "project_request_invalid",
            status: "invalid_project_id",
            message: "Active project request requires one valid project ID.",
          });
          return;
        }

        if (!options.projectRepository?.setActiveProjectForWorkspaceUser) {
          sendRepositoryUnavailable(response);
          return;
        }

        const selection =
          await options.projectRepository.setActiveProjectForWorkspaceUser({
            projectId: activeProjectRequest.projectId,
            userId: accessDecision.requester.appUserId,
            workspaceId: accessDecision.requester.workspaceId,
          });

        if (selection.status === "forbidden") {
          response.status(403).json({
            kind: "project_library_forbidden",
            status: "workspace_required",
            message: "Verified workspace access is required to select this project.",
          });
          return;
        }

        if (selection.status === "not_found") {
          response.status(404).json({
            kind: "project_not_found",
            status: "not_found",
            message: "Project was not found for this workspace.",
          });
          return;
        }

        response.status(200).json({
          kind: "active_project",
          status: "selected",
          activeProject: toProjectRecord(selection.project),
        });
      })().catch(next);
    },
  );

  router.delete(
    "/project-library/active-project",
    (request, response: Response<BackendProjectMutationResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind !== "allowed") {
          sendProjectAccessDenied(response, accessDecision, options.runtimeConfig);
          return;
        }

        if (!options.projectRepository?.clearActiveProjectForWorkspaceUser) {
          sendRepositoryUnavailable(response);
          return;
        }

        await options.projectRepository.clearActiveProjectForWorkspaceUser(
          accessDecision.requester.workspaceId,
          accessDecision.requester.appUserId,
        );

        response.status(200).json({
          kind: "active_project",
          status: "cleared",
          activeProject: null,
        });
      })().catch(next);
    },
  );

  router.post(
    "/project-library/projects",
    (request, response: Response<BackendProjectMutationResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind !== "allowed") {
          sendProjectAccessDenied(
            response,
            accessDecision,
            options.runtimeConfig,
          );
          return;
        }

        if (!options.projectRepository) {
          sendRepositoryUnavailable(response);
          return;
        }

        const titleResult = parseTitleRequest(request.body);

        if (titleResult.kind === "invalid") {
          response.status(400).json({
            kind: "project_request_invalid",
            status: "invalid_title",
            message: titleResult.message,
          });
          return;
        }

        const project = await options.projectRepository.createProject({
          ownerId: accessDecision.requester.appUserId,
          projectId: randomUUID(),
          title: titleResult.title,
          workspaceId: accessDecision.requester.workspaceId,
        });

        response.status(201).json({
          kind: "project_record",
          status: "created",
          project: toProjectRecord(project),
        });
      })().catch(next);
    },
  );

  router.get(
    "/project-library/projects/:projectId",
    (request, response: Response<BackendProjectMutationResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind !== "allowed") {
          sendProjectAccessDenied(
            response,
            accessDecision,
            options.runtimeConfig,
          );
          return;
        }

        if (!isValidProjectId(request.params.projectId)) {
          response.status(400).json({
            kind: "project_request_invalid",
            status: "invalid_project_id",
            message: "Project ID is invalid.",
          });
          return;
        }

        if (!options.projectRepository) {
          sendRepositoryUnavailable(response);
          return;
        }

        const project = await options.projectRepository.getProjectForWorkspace(
          accessDecision.requester.workspaceId,
          request.params.projectId,
        );

        if (!project) {
          response.status(404).json({
            kind: "project_not_found",
            status: "not_found",
            message: "Project was not found for this workspace.",
          });
          return;
        }

        response.status(200).json({
          kind: "project_record",
          status: "loaded",
          project: toProjectRecord(project),
        });
      })().catch(next);
    },
  );

  router.patch(
    "/project-library/projects/:projectId",
    (request, response: Response<BackendProjectMutationResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind !== "allowed") {
          sendProjectAccessDenied(
            response,
            accessDecision,
            options.runtimeConfig,
          );
          return;
        }

        if (!isValidProjectId(request.params.projectId)) {
          response.status(400).json({
            kind: "project_request_invalid",
            status: "invalid_project_id",
            message: "Project ID is invalid.",
          });
          return;
        }

        if (!options.projectRepository) {
          sendRepositoryUnavailable(response);
          return;
        }

        const titleResult = parseTitleRequest(request.body);

        if (titleResult.kind === "invalid") {
          response.status(400).json({
            kind: "project_request_invalid",
            status: "invalid_title",
            message: titleResult.message,
          });
          return;
        }

        const project =
          await options.projectRepository.updateProjectTitleForWorkspace({
            projectId: request.params.projectId,
            title: titleResult.title,
            workspaceId: accessDecision.requester.workspaceId,
          });

        if (!project) {
          response.status(404).json({
            kind: "project_not_found",
            status: "not_found",
            message: "Project was not found for this workspace.",
          });
          return;
        }

        response.status(200).json({
          kind: "project_record",
          status: "updated",
          project: toProjectRecord(project),
        });
      })().catch(next);
    },
  );

  router.delete(
    "/project-library/projects/:projectId",
    (request, response: Response<BackendProjectMutationResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind !== "allowed") {
          sendProjectAccessDenied(response, accessDecision, options.runtimeConfig);
          return;
        }

        if (!isValidProjectId(request.params.projectId)) {
          response.status(400).json({
            kind: "project_request_invalid",
            status: "invalid_project_id",
            message: "Project ID is invalid.",
          });
          return;
        }

        if (!isOwnerOrAdminWorkspaceRole(accessDecision.requester.workspaceRole)) {
          response.status(403).json({
            kind: "project_delete_forbidden",
            status: "workspace_owner_or_admin_required",
            message:
              "Workspace owner or admin permission is required to delete a project.",
          });
          return;
        }

        if (!options.projectRepository?.softDeleteProjectForWorkspaceUser) {
          sendRepositoryUnavailable(response);
          return;
        }

        const result =
          await options.projectRepository.softDeleteProjectForWorkspaceUser({
            projectId: request.params.projectId,
            userId: accessDecision.requester.appUserId,
            workspaceId: accessDecision.requester.workspaceId,
          });

        if (result === "forbidden") {
          response.status(403).json({
            kind: "project_delete_forbidden",
            status: "workspace_owner_or_admin_required",
            message:
              "Workspace owner or admin permission is required to delete a project.",
          });
          return;
        }

        if (result === "not_found") {
          response.status(404).json({
            kind: "project_not_found",
            status: "not_found",
            message: "Project was not found for this workspace.",
          });
          return;
        }

        if (result !== "deleted") {
          throw new Error(
            "Project soft-delete repository returned an invalid status.",
          );
        }

        response.status(200).json({
          kind: "project_deleted",
          status: "deleted",
          projectId: request.params.projectId,
        });
      })().catch(next);
    },
  );

  router.get(
    "/project-library/history",
    (request, response: Response<BackendExportHistoryResponse>, next) => {
      void (async () => {
        const accessDecision = await resolveSelectedRouteAccess({
          headers: request.headers,
          runtimeConfig: options.runtimeConfig,
          requesterResolver: options.routeAccessResolver,
        });

        if (accessDecision.kind === "allowed") {
          const requesterContext = accessDecision.requester;
          const persistenceReadiness =
            options.productionPersistenceWriter?.getReadiness();
          const persistenceUnavailable =
            !persistenceReadiness ||
            persistenceReadiness.kind === "unavailable";

          response.status(200).json({
            kind: "export_history",
            status: "authenticated",
            message: persistenceUnavailable
              ? "Export history is available for this verified session, but durable Supabase persistence is unavailable; browser-local history remains local/browser-only."
              : "Export history is available for this verified session.",
            activeWorkspaceId: requesterContext.workspaceId,
            historyState: persistenceUnavailable
              ? "persistence_unavailable"
              : "not_enabled_yet",
            exports: [],
          });
          return;
        }

        if (accessDecision.code === "workspace_required") {
          response.status(403).json({
            kind: "export_history_forbidden",
            status: "workspace_required",
            message: accessDecision.message,
          });
          return;
        }

        if (accessDecision.code === "auth_required") {
          response.status(401).json({
            kind: "export_history_sign_in_required",
            status: "unauthenticated",
            reason: "invalid_credentials",
            message:
              "Sign in is required before verified backend export history can appear here.",
          });
          return;
        }

        response.status(503).json({
          kind: "export_history_unavailable",
          status:
            accessDecision.code === "workspace_runtime_not_configured"
              ? "workspace_runtime_not_configured"
              : unavailableStatus(options.runtimeConfig),
          message:
            accessDecision.code === "workspace_runtime_not_configured"
              ? accessDecision.message
              : unavailableMessage(options.runtimeConfig, "history"),
        });
      })().catch(next);
    },
  );

  router.use("/project-library", createProjectLibraryErrorHandler());

  return router;
};
