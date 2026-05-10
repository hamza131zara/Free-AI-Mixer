import { expect, test } from "@playwright/test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../../backend/app";

const createValidRequest = () => ({
  requestId: "request-phase61",
  timelineId: "timeline-phase61",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  requestedAt: new Date().toISOString(),
});

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

test.describe("Phase 6.1 backend export contract scaffold", () => {
  test("POST /exports accepts valid request and returns accepted_job only", async () => {
    const response = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequest()),
    });

    expect(response.status).toBe(202);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.kind).toBe("accepted_job");
    expect(body).toHaveProperty("handle");
    expect(body).not.toHaveProperty("result");
    expect(body).not.toHaveProperty("artifacts");
    expect(body).not.toHaveProperty("downloadUrl");
    expect(body).not.toHaveProperty("progress");

    const handle = body.handle as Record<string, unknown>;
    expect(typeof handle.jobId).toBe("string");
    expect(handle.status).toBe("submitted");
  });

  test("POST /exports rejects invalid and malformed request payloads", async () => {
    const missingRequestId = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timelineId: "timeline-a",
        renderSettings: createValidRequest().renderSettings,
        requestedAt: new Date().toISOString(),
      }),
    });
    expect(missingRequestId.status).toBe(400);
    expect((await missingRequestId.json()).code).toBe("invalid_export_request");

    const missingTimelineId = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "request-a",
        renderSettings: createValidRequest().renderSettings,
        requestedAt: new Date().toISOString(),
      }),
    });
    expect(missingTimelineId.status).toBe(400);
    expect((await missingTimelineId.json()).code).toBe("invalid_export_request");

    const missingRenderSettings = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "request-a",
        timelineId: "timeline-a",
        requestedAt: new Date().toISOString(),
      }),
    });
    expect(missingRenderSettings.status).toBe(400);
    expect((await missingRenderSettings.json()).code).toBe("invalid_export_request");

    const malformedJson = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"requestId":"broken"',
    });
    expect(malformedJson.status).toBe(400);
    expect((await malformedJson.json()).code).toBe("invalid_export_request");
  });

  test("GET /exports/:jobId returns pending state for known job only", async () => {
    const createResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequest()),
    });
    const created = (await createResponse.json()) as {
      handle: { jobId: string };
    };

    const response = await fetch(`${baseUrl}/exports/${created.handle.jobId}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.kind).toBe("pending");
    expect(body).toHaveProperty("handle");
    expect(body).not.toHaveProperty("result");
    expect(body).not.toHaveProperty("artifacts");
    expect(body).not.toHaveProperty("downloadUrl");
    expect(body).not.toHaveProperty("progress");
  });

  test("GET /exports/:jobId returns export_job_not_found for unknown job", async () => {
    const response = await fetch(`${baseUrl}/exports/unknown-job-id`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("export_job_not_found");
  });

  test("GET /exports/:jobId/artifacts returns artifacts unavailable for known job", async () => {
    const createResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createValidRequest()),
    });
    const created = (await createResponse.json()) as {
      handle: { jobId: string };
    };

    const response = await fetch(
      `${baseUrl}/exports/${created.handle.jobId}/artifacts`,
    );
    expect(response.status).toBe(409);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("export_artifacts_unavailable");
    expect(body).not.toHaveProperty("artifacts");
    expect(body).not.toHaveProperty("downloadUrl");
  });

  test("GET /exports/:jobId/artifacts returns export_job_not_found for unknown job", async () => {
    const response = await fetch(`${baseUrl}/exports/unknown-artifacts/artifacts`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("export_job_not_found");
  });
});
