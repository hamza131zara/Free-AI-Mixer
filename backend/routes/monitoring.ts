import { Router } from "express";
import type { Response } from "express";
import type {
  BackendMonitoringHealthResponse,
  BackendMonitoringReadinessResponse,
} from "../contracts/monitoringHttpTypes";
import {
  getMonitoringHealthSummary,
  getMonitoringReadinessSummary,
} from "../monitoring/monitoringReadiness";

export const createMonitoringRouter = (): Router => {
  const router = Router();

  router.get(
    "/monitoring/health",
    (_request, response: Response<BackendMonitoringHealthResponse>) => {
      response.status(200).json(getMonitoringHealthSummary());
    },
  );

  router.get(
    "/monitoring/readiness",
    (_request, response: Response<BackendMonitoringReadinessResponse>) => {
      response.status(200).json(getMonitoringReadinessSummary());
    },
  );

  return router;
};
