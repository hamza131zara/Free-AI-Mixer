import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../../backend/app";
import { createSafeStructuredLogEvent } from "../../backend/observability/safeStructuredLogger";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const startServer = async (): Promise<{ server: Server; baseUrl: string }> => {
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address() as AddressInfo;

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const stopServer = async (server: Server): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

test.describe("product phase 10 monitoring and logging policy", () => {
  test("structured logging policy redacts secrets signed urls local paths and raw prompts by default", () => {
    const event = createSafeStructuredLogEvent({
      event: "provider_failure",
      severity: "error",
      correlationId: "corr-123",
      jobId: "job-123",
      reasonCode: "provider_unavailable",
      metadata: {
        apiKey: "sk-secret-value",
        service_role: "secret-service-role",
        artifactSignedUrl:
          "https://example.com/file.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc",
        outputPath: "C:\\temp\\private\\artifact.mp4",
        rawPrompt: "private user prompt text",
        safeState: "rendering",
      },
    });

    expect(event.metadata).toMatchObject({
      apiKey: "[redacted]",
      service_role: "[redacted]",
      artifactSignedUrl: "[redacted]",
      outputPath: "[redacted]",
      rawPrompt: "[redacted]",
      safeState: "rendering",
    });
    expect(event.redactedFields).toEqual(
      expect.arrayContaining([
        "apiKey",
        "service_role",
        "artifactSignedUrl",
        "outputPath",
        "rawPrompt",
      ]),
    );
  });

  test("monitoring routes stay read-only and do not expose raw config or secrets", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const healthResponse = await fetch(`${baseUrl}/monitoring/health`);
      expect(healthResponse.status).toBe(200);
      await expect(healthResponse.json()).resolves.toEqual({
        kind: "monitoring_health",
        status: "ok",
        message:
          "Monitoring health boundary is reachable. No vendor integrations or operational dashboards are enabled in this product phase.",
        externalVendorsEnabled: false,
      });

      const readinessResponse = await fetch(`${baseUrl}/monitoring/readiness`);
      expect(readinessResponse.status).toBe(200);
      await expect(readinessResponse.json()).resolves.toEqual({
        kind: "monitoring_readiness",
        status: "readiness_boundary_only",
        message:
          "Structured logging and secret-redaction readiness are available as backend-only policy boundaries. External monitoring integrations remain disabled.",
        structuredLoggingPolicyEnabled: true,
        secretRedactionRequired: true,
        externalVendorsEnabled: false,
        safeMetadataOnly: true,
      });
    } finally {
      await stopServer(server);
    }
  });

  test("no fake metrics or monitoring vendor integrations are introduced by default", async () => {
    const source = [
      readSource("backend/observability/safeStructuredLogger.ts"),
      readSource("backend/monitoring/monitoringReadiness.ts"),
      readSource("backend/routes/monitoring.ts"),
    ].join("\n");

    expect(source).not.toContain("datadog");
    expect(source).not.toContain("sentry");
    expect(source).not.toContain("newrelic");
  });
});
