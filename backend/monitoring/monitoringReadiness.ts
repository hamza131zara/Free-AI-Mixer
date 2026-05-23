export interface MonitoringHealthSummary {
  kind: "monitoring_health";
  status: "ok";
  message: string;
  externalVendorsEnabled: false;
}

export interface MonitoringReadinessSummary {
  kind: "monitoring_readiness";
  status: "readiness_boundary_only";
  message: string;
  structuredLoggingPolicyEnabled: true;
  secretRedactionRequired: true;
  externalVendorsEnabled: false;
  safeMetadataOnly: true;
}

export const getMonitoringHealthSummary = (): MonitoringHealthSummary => ({
  kind: "monitoring_health",
  status: "ok",
  message:
    "Monitoring health boundary is reachable. No vendor integrations or operational dashboards are enabled in this product phase.",
  externalVendorsEnabled: false,
});

export const getMonitoringReadinessSummary = (): MonitoringReadinessSummary => ({
  kind: "monitoring_readiness",
  status: "readiness_boundary_only",
  message:
    "Structured logging and secret-redaction readiness are available as backend-only policy boundaries. External monitoring integrations remain disabled.",
  structuredLoggingPolicyEnabled: true,
  secretRedactionRequired: true,
  externalVendorsEnabled: false,
  safeMetadataOnly: true,
});
