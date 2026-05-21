import { getRequesterContextFromRequest } from "../auth/trustedAuthMiddleware";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BackendArtifactAccessResponse,
  BackendArtifactMetadata,
  BackendExportLifecycleStatus,
  BackendExportJobRecord,
  ExportArtifactsUnavailableResponseBody,
  ExportPollResponseBody,
  ExportSubmitResponseBody,
} from "../contracts/exportHttpTypes";
import {
  exportArtifactsUnavailable,
  exportJobNotFound,
} from "../errors/exportErrors";
import type { ExportJobRegistry } from "../registry/exportJobRegistry";
import { parseJobIdParams, parseSubmitBody } from "../validation/exportValidation";
import { toJobHandle } from "../contracts/exportHttpTypes";
import { executeRenderJob } from "../renderer/executeRenderJob";
import type { RendererAdapter, VerifiedArtifactRefPayload } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import type { ArtifactAccessProvider } from "../artifacts/artifactAccessProvider";
import { createNotConfiguredArtifactAccessProvider } from "../artifacts/notConfiguredArtifactAccessProvider";
import type { ArtifactStorageRefResolver } from "../artifacts/artifactStorageRefResolver";
import {
  resolveExportRequesterContext,
  type ExportRequesterContextResolver,
} from "../requester/exportRequesterContext";

const isRouteExecutionEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1";

const getRouteExecutionTimeout = (): number => {
  const envValue = process.env.FREE_AI_MIXER_ROUTE_EXECUTION_TIMEOUT_MS;
  const parsed = parseInt(envValue ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 120000;
  }
  return parsed;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isTerminalStatus = (status: BackendExportLifecycleStatus): boolean =>
  status === "success" || status === "error" || status === "expired";

const mapRecordToPollResponse = (
  record: BackendExportJobRecord,
): ExportPollResponseBody => {
  // In-flight statuses map to pending
  if (!isTerminalStatus(record.status)) {
    return {
      kind: "pending",
      handle: toJobHandle(record),
    };
  }

  // Terminal: success
  if (record.status === "success") {
    return {
      kind: "terminal_success",
      result: {
        provider: "backend_render",
        requestId: record.requestId,
        jobId: record.jobId,
        artifacts: (record.artifacts ?? []).map((artifact) => ({
          id: artifact.artifactId,
          status: "ready" as const,
          ...(artifact.sizeBytes !== undefined ? { bytes: artifact.sizeBytes } : {}),
          ...(artifact.durationMs !== undefined ? { metadata: { durationMs: artifact.durationMs } } : {}),
        })),
        completedAt: record.completedAt,
      },
    };
  }

  // Terminal: error or expired
  return {
    kind: "terminal_failure",
    failure: {
      message: record.status === "expired"
        ? "Export job has expired."
        : record.failure?.message ?? "Export job failed.",
      code: record.failure?.code ?? (record.status === "expired" ? "expired" : "error"),
    },
    jobId: record.jobId,
  };
};

export type ExportRouteAuthorizationMode = "disabled" | "enforce";

interface ExportRouteAuthorizationFailure {
  statusCode: typeof exportAuthorizationUnauthorizedStatus | typeof exportAuthorizationForbiddenStatus;
  code: "unauthorized" | "forbidden";
  message: string;
}

const exportAuthorizationUnauthorizedStatus = 401 as const;
const exportAuthorizationForbiddenStatus = 403 as const;

const getExportRouteAuthorizationFailure = (
  request: Request,
  record: BackendExportJobRecord,
  options?: ExportRouterOptions,
): ExportRouteAuthorizationFailure | undefined => {
  if (options?.authorizationMode !== "enforce") {
    return undefined;
  }

  const trustedRequesterContext = getRequesterContextFromRequest(request);

  if (trustedRequesterContext.kind !== "authenticated") {
    return {
      statusCode: exportAuthorizationUnauthorizedStatus,
      code: "unauthorized",
      message: "Authentication is required to access this export job.",
    };
  }

  if (
    trustedRequesterContext.userId !== record.ownerId ||
    trustedRequesterContext.workspaceId !== record.workspaceId
  ) {
    return {
      statusCode: exportAuthorizationForbiddenStatus,
      code: "forbidden",
      message: "You are not authorized to access this export job.",
    };
  }

  return undefined;
};

const sendExportRouteAuthorizationFailure = (
  response: Response,
  failure: ExportRouteAuthorizationFailure,
): void => {
  response.status(failure.statusCode).json({
    code: failure.code,
    message: failure.message,
  });
};
export interface ExportRouterOptions {
  rendererAdapter?: RendererAdapter;
  pathPolicy?: RenderOutputPathPolicy;
  artifactAccessProvider?: ArtifactAccessProvider;
  requesterContextResolver?: ExportRequesterContextResolver;
  authorizationMode?: ExportRouteAuthorizationMode;
  /** Internal resolver for artifact storage references. Used by stream route. */
  artifactStorageRefResolver?: ArtifactStorageRefResolver;
  /** Internal callback for ref registration. Used by POST /exports/:jobId/execute. */
  onVerifiedArtifactRef?: (payload: VerifiedArtifactRefPayload) => void;
}

export const createExportRouter = (registry: ExportJobRegistry, options?: ExportRouterOptions): Router => {
  const router = Router();


  // Artifact access provider: use injected or default to not-configured
  const artifactAccessProvider = options?.artifactAccessProvider ?? createNotConfiguredArtifactAccessProvider();
  const requesterContextResolver =
    options?.requesterContextResolver ?? resolveExportRequesterContext;

  router.post(
    "/exports",
    async (
      request: Request<unknown, ExportSubmitResponseBody, unknown>,
      response: Response<ExportSubmitResponseBody>,
    ) => {
      const body = parseSubmitBody(request.body);
      const requesterContext = requesterContextResolver(request);
      const existingRecord = await registry.getByRequestId(body.requestId, requesterContext);
      const record =
        existingRecord ??
        await registry.create({
          requestId: body.requestId,
          timelineId: body.timelineId,
          renderSettings: body.renderSettings,
          ownerId: requesterContext.ownerId,
          workspaceId: requesterContext.workspaceId,
        });

      response.status(202).json({
        kind: "accepted_job",
        handle: toJobHandle(record),
      });
    },
  );

  router.get(
    "/exports/:jobId",
    async (
      request: Request<{ jobId: string }, ExportPollResponseBody>,
      response: Response<ExportPollResponseBody>,
      next: NextFunction,
    ) => {
      try {
        const requesterContext = requesterContextResolver(request);
        const { jobId } = parseJobIdParams(request.params);
        const record = await registry.getByIdForOwner(jobId, requesterContext);
        if (!record) {
          throw exportJobNotFound(jobId);
        }

        // Phase 133 authorization guard for export status route.
        const authorizationFailure = getExportRouteAuthorizationFailure(request, record, options);
        if (authorizationFailure) {
          sendExportRouteAuthorizationFailure(response, authorizationFailure);
          return;
        }

        const pollResponse = mapRecordToPollResponse(record);
        response.json(pollResponse);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/exports/:jobId/artifacts",
    async (
      request: Request<{ jobId: string }, ExportArtifactsUnavailableResponseBody>,
      response: Response<ExportArtifactsUnavailableResponseBody>,
    ) => {
      const requesterContext = requesterContextResolver(request);
      const { jobId } = parseJobIdParams(request.params);
      const record = await registry.getByIdForOwner(jobId, requesterContext);
      // Phase 134 authorization guard for artifact access/stream routes.
      if (record) {
        const authorizationFailure = getExportRouteAuthorizationFailure(request, record, options);
        if (authorizationFailure) {
          sendExportRouteAuthorizationFailure(response, authorizationFailure);
          return;
        }
      }
      if (!record) {
        throw exportJobNotFound(jobId);
      }

      const error = exportArtifactsUnavailable(record.jobId);
      response.status(error.status).json(
        error.body as ExportArtifactsUnavailableResponseBody,
      );
    },
  );

  router.get(
    "/exports/:jobId/artifacts/:artifactId/access",
    async (
      request: Request<{ jobId: string; artifactId: string }, BackendArtifactAccessResponse>,
      response: Response<BackendArtifactAccessResponse>,
    ) => {
     const requesterContext = requesterContextResolver(request);
     const { jobId } = parseJobIdParams({ jobId: request.params.jobId });
     const { artifactId } = request.params;
      const record = await registry.getByIdForOwner(jobId, requesterContext);
      // Phase 134 authorization guard for artifact access/stream routes.
      if (record) {
        const authorizationFailure = getExportRouteAuthorizationFailure(request, record, options);
        if (authorizationFailure) {
          sendExportRouteAuthorizationFailure(response, authorizationFailure);
          return;
        }
      }

      if (!record) {
        response.json({
          kind: "artifact_access_unavailable",
          reason: "job_not_found",
          message: "Export job was not found.",
        });
        return;
      }

      if (record.status !== "success") {
        response.json({
          kind: "artifact_access_unavailable",
          reason: "job_not_successful",
          message: "Artifact access is available only for successful export jobs.",
        });
        return;
      }

      const artifact = (record.artifacts ?? []).find((a) => a.artifactId === artifactId);

      if (!artifact) {
        response.json({
          kind: "artifact_access_unavailable",
          reason: "artifact_not_found",
          message: "Artifact was not found for this export job.",
        });
        return;
      }

      if (artifact.status && artifact.status !== "available") {
        response.json({
          kind: "artifact_access_unavailable",
          reason: "artifact_not_ready",
          message: "Artifact is not ready for access.",
        });
        return;
      }

      try {
        const accessResponse = await artifactAccessProvider.getArtifactAccess({
          jobId,
          artifactId,
          artifact,
        });
        response.json(accessResponse);
      } catch {
        response.json({
          kind: "artifact_access_unavailable",
          reason: "artifact_access_not_configured",
          message: "Artifact access is not configured.",
        });
      }
    },
  );

  // Content-Type mapping for artifact formats
  const formatToContentType = (format: string): string => {
    switch (format.toLowerCase()) {
      case "mp4":
        return "video/mp4";
      case "webm":
        return "video/webm";
      default:
        return "application/octet-stream";
    }
  };

  // Safe filename generation
  const safeFilename = (artifactId: string, format: string): string => {
    const sanitizedId = artifactId.replace(/[^a-zA-Z0-9_-]/g, "_") || "artifact";
    return `${sanitizedId}.${format}`;
  };

  router.get(
    "/exports/:jobId/artifacts/:artifactId/stream",
    async (
      request: Request<{ jobId: string; artifactId: string }, unknown>,
      response: Response,
    ) => {
      const requesterContext = requesterContextResolver(request);
      // Check if resolver is configured
      if (!options?.artifactStorageRefResolver) {
        response.status(501).json({
          code: "stream_not_configured",
          message: "Artifact stream access is not configured.",
        });
        return;
      }

      // Parse jobId
      const { jobId } = parseJobIdParams({ jobId: request.params.jobId });
      const artifactId = request.params.artifactId;

      // Get job from registry
      const record = await registry.getByIdForOwner(jobId, requesterContext);
      // Phase 134 authorization guard for artifact access/stream routes.
      if (record) {
        const authorizationFailure = getExportRouteAuthorizationFailure(request, record, options);
        if (authorizationFailure) {
          sendExportRouteAuthorizationFailure(response, authorizationFailure);
          return;
        }
      }
      if (!record) {
        response.status(404).json({
          code: "job_not_found",
          message: "Export job was not found.",
        });
        return;
      }

      // Check job is successful
      if (record.status !== "success") {
        response.status(404).json({
          code: "job_not_found",
          message: "Export job was not found.",
        });
        return;
      }

      // Find artifact
      const artifact = (record.artifacts ?? []).find((a) => a.artifactId === artifactId);
      if (!artifact) {
        response.status(404).json({
          code: "artifact_not_found",
          message: "Artifact was not found.",
        });
        return;
      }

      // Check artifact is ready
      if (artifact.status && artifact.status !== "available") {
        response.status(404).json({
          code: "artifact_not_found",
          message: "Artifact was not found.",
        });
        return;
      }

      // Resolve storage ref
      const storageRef = options.artifactStorageRefResolver.resolve(jobId, artifactId);
      if (!storageRef) {
        response.status(404).json({
          code: "artifact_not_found",
          message: "Artifact was not found.",
        });
        return;
      }

      // Path safety: resolve real paths
      let realFilePath: string;
      let realRootPath: string;
      try {
        realRootPath = await fs.realpath(storageRef.rootPath);
        realFilePath = await fs.realpath(storageRef.filePath);
      } catch {
        response.status(500).json({
          code: "internal_error",
          message: "Artifact stream failed.",
        });
        return;
      }

      // Validate file is inside root
      const normalizedFile = path.resolve(realFilePath);
      const normalizedRoot = path.resolve(realRootPath);
      const relative = path.relative(normalizedRoot, normalizedFile);
      const isInsideRoot =
        relative.length > 0 &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative);

      if (!isInsideRoot) {
        response.status(403).json({
          code: "forbidden",
          message: "Artifact stream access was denied.",
        });
        return;
      }

      // Check file exists and is a file
      let stat;
      try {
        stat = await fs.stat(realFilePath);
      } catch {
        response.status(404).json({
          code: "not_found",
          message: "Artifact file is not available.",
        });
        return;
      }

      if (!stat.isFile()) {
        response.status(403).json({
          code: "forbidden",
          message: "Artifact stream access was denied.",
        });
        return;
      }

      // Set headers
      response.setHeader("Content-Type", formatToContentType(artifact.format));
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFilename(artifactId, artifact.format)}"`,
      );
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");

      // Stream file
      response.sendFile(realFilePath, (err) => {
        if (err && !response.headersSent) {
          response.status(500).json({
            code: "internal_error",
            message: "Artifact stream failed.",
          });
        }
      });
    },
  );

  router.post(
    "/exports/:jobId/execute",
    async (
      request: Request<{ jobId: string }, unknown, unknown>,
      response: Response,
    ) => {
      const requesterContext = requesterContextResolver(request);

      if (!isRouteExecutionEnabled()) {
        response.status(503).json({
          code: "route_execution_disabled",
          message: "Route execution is disabled. Set FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1 to enable.",
        });
        return;
      }

      const { jobId } = parseJobIdParams(request.params);
      const record = await registry.getByIdForOwner(jobId, requesterContext);
      // Phase 133 authorization guard for execute route.
      if (record) {
        const authorizationFailure = getExportRouteAuthorizationFailure(request, record, options);
        if (authorizationFailure) {
          sendExportRouteAuthorizationFailure(response, authorizationFailure);
          return;
        }
      }
      if (!record) {
        throw exportJobNotFound(jobId);
      }

      if (!options?.rendererAdapter || !options?.pathPolicy) {
        response.status(501).json({
          code: "executor_not_configured",
          message: "Execute trigger is enabled but rendererAdapter or pathPolicy not configured.",
        });
        return;
      }

      const snapshotInput = {
        jobId: record.jobId,
        timelineId: record.timelineId,
        renderSettings: record.renderSettings,
        timelineSnapshot: {
          timelineId: record.timelineId,
          clips: [
            {
              clipId: `clip-${record.jobId}`,
              sceneRefId: "scene-0",
              startMs: 0,
              durationMs: 1000,
              order: 0,
            },
          ],
        },
        sceneRefs: [{ sceneId: "scene-0", role: "primary" }],
        mediaRefs: [],
        outputTarget: {
          jobFolderKey: record.jobId,
          artifactBaseName: "output",
          format: record.renderSettings.format,
        },
      };

      const timeoutMs = getRouteExecutionTimeout();
      const renderPromise = executeRenderJob({
        registry,
        rendererAdapter: options.rendererAdapter,
        pathPolicy: options.pathPolicy,
        workerId: "route-trigger-worker",
        jobId: record.jobId,
        snapshotInput,
        onVerifiedArtifactRef: options?.onVerifiedArtifactRef,
      });
      const timeoutPromise = wait(timeoutMs).then(() => ({ timedOut: true }));

      const outcome = await Promise.race([renderPromise, timeoutPromise]) as
        | { ok: true; jobId: string; status: string; artifact: unknown }
        | { ok: false; jobId: string; status: string; failure: unknown }
        | { timedOut: true };

      if ("timedOut" in outcome && outcome.timedOut) {
        response.status(504).json({
          code: "route_execution_timeout",
          message: "Route execution response timed out before completion. The job may still be running; poll the job state for the latest lifecycle status.",
          jobId: record.jobId,
        });
        return;
      }

      const result = outcome as
        | { ok: true; jobId: string; status: string; artifact: BackendArtifactMetadata }
        | { ok: false; jobId: string; status: string; failure: unknown };

      if (result.ok) {
        const artifact = result.artifact as BackendArtifactMetadata;
        response.json({
          kind: "executed",
          jobId: result.jobId,
          status: result.status,
          artifact: {
            artifactId: artifact.artifactId,
            jobId: artifact.jobId,
            kind: artifact.kind,
            format: artifact.format,
            status: artifact.status,
            createdAt: artifact.createdAt,
            ...(artifact.sizeBytes !== undefined ? { sizeBytes: artifact.sizeBytes } : {}),
          },
        });
      } else {
        response.status(500).json({
          kind: "execution_failed",
          jobId: result.jobId,
          status: result.status,
          failure: result.failure,
        });
      }
    },
  );

  return router;
};






