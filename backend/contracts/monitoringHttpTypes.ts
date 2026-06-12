import type {
  MonitoringHealthSummary,
  MonitoringReadinessSummary,
} from "../monitoring/monitoringReadiness";
import type { ProductionDeploymentReadinessSummary } from "../config/productionDeploymentReadiness";

export type BackendMonitoringHealthResponse = MonitoringHealthSummary;

export type BackendMonitoringReadinessResponse = MonitoringReadinessSummary;

export type BackendMonitoringDeploymentReadinessResponse =
  ProductionDeploymentReadinessSummary;
