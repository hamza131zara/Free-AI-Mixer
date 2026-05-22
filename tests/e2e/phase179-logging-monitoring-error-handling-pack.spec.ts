import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createStructuredLogEvent,
  isStructuredLogEventSafeToEmit,
  resolveProductionObservabilityReadiness,
} from "../../backend/observability/productionObservability";
import { scanForSecretExposure } from "../../backend/security/secretExposureGuard";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const monitoringDocs = readSource("docs/monitoring.md");

test.describe("phase179 logging monitoring error handling pack", () => {
  test("structured log event redacts sensitive fields while preserving safe operational context", async () => {
    const event = createStructuredLogEvent({
      level: "error",
      event: "artifact_delivery_failed",
      message: "Artifact delivery failed safely.",
      fields: {
        jobId: "job-phase179",
        artifactId: "artifact-phase179",
        failureCode: "descriptor_expired",
        authorization: "Bearer secret-token",
        signedUrl: "https://signed.example/path?token=secret",
        nested: {
          service_role_key: "secret-service-role",
          safe: "value",
        },
      },
    });

    expect(event).toEqual({
      level: "error",
      event: "artifact_delivery_failed",
      message: "Artifact delivery failed safely.",
      fields: {
        jobId: "job-phase179",
        artifactId: "artifact-phase179",
        failureCode: "descriptor_expired",
        authorization: "[redacted]",
        signedUrl: "[redacted]",
        nested: {
          service_role_key: "[redacted]",
          safe: "value",
        },
      },
      redactedFields: ["authorization", "signedUrl", "nested.service_role_key"],
      safeToEmit: true,
    });

    expect(isStructuredLogEventSafeToEmit(event)).toBe(true);
    expect(JSON.stringify(event)).not.toContain("secret-token");
    expect(JSON.stringify(event)).not.toContain("secret-service-role");
  });

  test("production observability readiness validates monitoring docs and failure visibility without enabling launch", async () => {
    const backendErrorMappingSource = readSource("backend/errors/exportErrors.ts");
    const renderFailureSource =
      readIfExists("backend/renderer/rendererFailureMapping.ts") +
      "\n" +
      readSource("backend/routes/exports.ts");
    const downloadFailureSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts");

    expect(resolveProductionObservabilityReadiness({})).toEqual({
      kind: "not_ready",
      missingItems: [
        "structured_logs",
        "backend_error_mapping",
        "render_export_failure_visibility",
        "download_failure_visibility",
        "monitoring_plan",
        "sensitive_data_redaction",
      ],
      sensitiveDataAllowedInLogs: false,
      publicLaunchEnabled: false,
    });

    expect(resolveProductionObservabilityReadiness({
      monitoringDocsText: monitoringDocs,
      backendErrorMappingSource,
      renderFailureSource,
      downloadFailureSource,
    })).toEqual({
      kind: "ready",
      missingItems: [],
      sensitiveDataAllowedInLogs: false,
      publicLaunchEnabled: false,
    });
  });

  test("logging monitoring and error handling sources avoid sensitive data logs and public launch shortcuts", async () => {
    const observabilitySource = readSource("backend/observability/productionObservability.ts");
    const exportErrorsSource = readSource("backend/errors/exportErrors.ts");
    const frontendFailureSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts");
    const docsSource =
      monitoringDocs +
      "\n" +
      readSource("docs/phases.md") +
      "\n" +
      readSource("docs/known-issues.md");

    expect(observabilitySource).toContain("createStructuredLogEvent");
    expect(observabilitySource).toContain("resolveProductionObservabilityReadiness");
    expect(observabilitySource).toContain("sensitiveDataAllowedInLogs: false");
    expect(exportErrorsSource).toContain("invalid_export_request");
    expect(exportErrorsSource).toContain("internal_export_error");
    expect(frontendFailureSource).toContain("transport_error");
    expect(frontendFailureSource).toContain("descriptor_expired");
    expect(frontendFailureSource).toContain("invalid_navigation_target");

    expect(scanForSecretExposure({
      content: exportErrorsSource + "\n" + frontendFailureSource,
      context: "backend_source",
    })).toEqual({
      kind: "safe",
      findings: [],
      safeToExpose: true,
    });

    expect(observabilitySource).not.toContain("console.log");
    expect(observabilitySource).not.toContain("console.error");
    expect(docsSource).not.toContain("PUBLIC_LAUNCH_ENABLED=true");
    expect(docsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(docsSource).not.toContain("-----BEGIN PRIVATE KEY-----");
  });
});


