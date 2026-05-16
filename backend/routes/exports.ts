import { Router } from "express";
import type { Request, Response } from "express";
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
import type { RendererAdapter } from "../renderer/singleProcessRenderHarness";
import type { RenderOutputPathPolicy } from "../renderer/outputPathPolicy";
import type { ArtifactAccessProvider } from "../artifacts/artifactAccessProvider";
import { createNotConfiguredArtifactAccessProvider } from "../artifacts/notConfiguredArtifactAccessProvider";
import type { ArtifactStorageRefResolver } from "../artifacts/artifactStorageRefResolver";

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

export interface ExportRouterOptions {
  rendererAdapter?: RendererAdapter;
  pathPolicy?: RenderOutputPathPolicy;
  artifactAccessProvider?: ArtifactAccessProvider;
  /** Internal resolver for artifact storage references. Used by stream route. */
  artifactStorageRefResolver?: ArtifactStorageRefResolver;
}

export const createExportRouter = (registry: ExportJobRegistry, options?: ExportRouterOptions): Router => {
  const router = Router();

  // Artifact access provider: use injected or default to not-configured
  const artifactAccessProvider = options?.artifactAccessProvider ?? createNotConfiguredArtifactAccessProvider();

  router.post(
    "/exports",
    (
      request: Request<unknown, ExportSubmitResponseBody, unknown>,
      response: Response<ExportSubmitResponseBody>,
    ) => {
      const body = parseSubmitBody(request.body);
      const existingRecord = registry.getByRequestId(body.requestId);
      const record =
        existingRecord ??
        registry.create({
          requestId: body.requestId,
          timelineId: body.timelineId,
          renderSettings: body.renderSettings,
        });

      response.status(202).json({
        kind: "accepted_job",
        handle: toJobHandle(record),
      });
    },
  );

  router.get(
    "/exports/:jobId",
    (
      request: Request<{ jobId: string }, ExportPollResponseBody>,
      response: Response<ExportPollResponseBody>,
    ) => {
      const { jobId } = parseJobIdParams(request.params);
      const record = registry.getById(jobId);
      if (!record) {
        throw exportJobNotFound(jobId);
      }

      const pollResponse = mapRecordToPollResponse(record);
      response.json(pollResponse);
    },
  );

  router.get(
    "/exports/:jobId/artifacts",
    (
      request: Request<{ jobId: string }, ExportArtifactsUnavailableResponseBody>,
      response: Response<ExportArtifactsUnavailableResponseBody>,
    ) => {
      const { jobId } = parseJobIdParams(request.params);
      const record = registry.getById(jobId);
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
     const { jobId } = parseJobIdParams(request.params);
     const { artifactId } = request.params;
      const record = registry.getById(jobId);

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

  router.post(
    "/exports/:jobId/execute",
    async (
      request: Request<{ jobId: string }, unknown, unknown>,
      response: Response,
    ) => {
      if (!isRouteExecutionEnabled()) {
        response.status(503).json({
          code: "route_execution_disabled",
          message: "Route execution is disabled. Set FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1 to enable.",
        });
        return;
      }

      const { jobId } = parseJobIdParams(request.params);
      const record = registry.getById(jobId);
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
