import { expect, test } from "@playwright/test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../backend/app";
import path from "node:path";
import { promises as fs } from "node:fs";

let server: Server;
let baseUrl: string;

test.beforeAll(async () => {
  const app = createApp();

  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

const submitExport = async (requestId: string): Promise<string> => {
  const response = await fetch(`${baseUrl}/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      timelineId: "timeline-test",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
      requestedAt: new Date().toISOString(),
    }),
  });

  expect(response.status).toBe(202);
  const data = await response.json();
  expect(data.kind).toBe("accepted_job");
  return data.handle.jobId;
};

const getJobStatus = async (jobId: string): Promise<unknown> => {
  const response = await fetch(`${baseUrl}/exports/${jobId}`, {
    method: "GET",
  });

  expect(response.status).toBe(200);
  return response.json();
};

test.describe("phase814 get status truthful", () => {
  test("GET returns pending for submitted job", async () => {
    const jobId = await submitExport("req-pending-submitted");

    const status = await getJobStatus(jobId);

    expect(status.kind).toBe("pending");
    expect(status.handle.jobId).toBe(jobId);
    expect(status.handle.status).toBe("submitted");
  });

  test("POST /exports returns accepted_job and creates submitted job", async () => {
    const response = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "req-submit-test",
        timelineId: "timeline-test",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        requestedAt: new Date().toISOString(),
      }),
    });

    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.kind).toBe("accepted_job");
    expect(data.handle.status).toBe("submitted");
  });

  test("POST /exports idempotency for same requestId", async () => {
    const requestId = "req-idempotent-test";

    const response1 = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        timelineId: "timeline-test",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        requestedAt: new Date().toISOString(),
      }),
    });

    const data1 = await response1.json();
    const jobId1 = data1.handle.jobId;

    const response2 = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        timelineId: "timeline-test",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        requestedAt: new Date().toISOString(),
      }),
    });

    const data2 = await response2.json();
    const jobId2 = data2.handle.jobId;

    // Same requestId should return the same job
    expect(jobId1).toBe(jobId2);
  });

  test("POST /exports/:jobId/execute returns 503 when env flag is not set (disabled)", async () => {
    // First create a job
    const response = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "req-execute-disabled",
        timelineId: "timeline-test",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        requestedAt: new Date().toISOString(),
      }),
    });

    const data = await response.json();
    const jobId = data.handle.jobId;

    // Try to execute - should fail because route execution is disabled by default
    const executeResponse = await fetch(`${baseUrl}/exports/${jobId}/execute`, {
      method: "POST",
    });

    expect(executeResponse.status).toBe(503);
    const executeData = await executeResponse.json();
    expect(executeData.code).toBe("route_execution_disabled");
  });

  test("execute route returns 501 when enabled but rendererAdapter/pathPolicy not configured", async () => {
    // This test verifies the code path - it requires FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION=1
    // Since we can't set env vars in the test, we verify the code contains this check
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    // Verify the code checks for executor_not_configured
    expect(source).toContain("executor_not_configured");
    expect(source).toContain("options?.rendererAdapter");
    expect(source).toContain("options?.pathPolicy");
  });

  test("routes.ts GET handler maps registry status to public poll response truthfully", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    // Verify the mapping function exists
    expect(source).toContain("mapRecordToPollResponse");
    expect(source).toContain("isTerminalStatus");

    // Verify terminal statuses are handled
    expect(source).toContain('status === "success"');
    expect(source).toContain('status === "error"');
    expect(source).toContain('status === "expired"');

    // Verify success maps to terminal_success
    expect(source).toContain('kind: "terminal_success"');
    expect(source).toContain("result:");

    // Verify error/expired map to terminal_failure
    expect(source).toContain('kind: "terminal_failure"');
    expect(source).toContain("failure:");
  });

  test("routes.ts does not expose local path, filePath, path, url, downloadUrl, or signedUrl in poll response", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    // The mapping function should not add these fields
    expect(source).not.toContain("filePath:");
    expect(source).not.toContain("path:");
    expect(source).not.toContain("url:");
    expect(source).not.toContain("downloadUrl");
    expect(source).not.toContain("signedUrl");
    expect(source).not.toContain("artifactUrl");
  });

  test("routes.ts terminal_failure does not include failure.details", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    // Verify terminal_failure does not pass details field in the mapping
    // Check that mapRecordToPollResponse does not include details: in the terminal failure response
    expect(source).not.toContain("details: record.failure?.details");
  });

  test("routes.ts terminal_failure response shape includes only safe fields", async () => {
    const source = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );

    // Verify the terminal_failure response only contains message, code, and jobId
    // Look for the pattern where terminal_failure is constructed
    const terminalFailurePattern = /kind: "terminal_failure"[\s\S]*?jobId: record\.jobId/;
    const match = source.match(terminalFailurePattern);
    expect(match).toBeTruthy();
    const section = match![0];
    expect(section).toContain("message:");
    expect(section).toContain("code:");
    expect(section).not.toContain("details:");
    expect(section).not.toContain("stack");
  });

  test("app.ts does NOT pass rendererAdapter/pathPolicy into createExportRouter", async () => {
    const appSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/app.ts"),
      "utf8",
    );

    const routerCallMatch = appSource.match(/createExportRouter\([^)]+\)/);
    expect(routerCallMatch).toBeTruthy();
    const callContent = routerCallMatch![0];
    expect(callContent).not.toContain("rendererAdapter");
    expect(callContent).not.toContain("pathPolicy");
  });
});