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

export const createExportRouter = (registry: ExportJobRegistry): Router => {
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

  return router;
};
