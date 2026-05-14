import { Router } from "express";
import type { Request, Response } from "express";
import type {
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

const isRouteExecutionEnabled = (): boolean =>
  process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION === "1";

export interface ExportRouterOptions {
  rendererAdapter?: RendererAdapter;
  pathPolicy?: RenderOutputPathPolicy;
}

export const createExportRouter = (registry: ExportJobRegistry, options?: ExportRouterOptions): Router => {
  const router = Router();

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

      response.json({
        kind: "pending",
        handle: toJobHandle(record),
      });
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

      const result = await executeRenderJob({
        registry,
        rendererAdapter: options.rendererAdapter,
        pathPolicy: options.pathPolicy,
        workerId: "route-trigger-worker",
        jobId: record.jobId,
        snapshotInput,
      });

      if (result.ok) {
        response.json({
          kind: "executed",
          jobId: result.jobId,
          status: result.status,
          artifact: {
            artifactId: result.artifact.artifactId,
            jobId: result.artifact.jobId,
            kind: result.artifact.kind,
            format: result.artifact.format,
            status: result.artifact.status,
            createdAt: result.artifact.createdAt,
            sizeBytes: result.artifact.sizeBytes,
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
