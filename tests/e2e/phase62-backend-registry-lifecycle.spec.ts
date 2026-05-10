import { expect, test } from "@playwright/test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../backend/app";

const createRequest = (requestId: string) => ({
  requestId,
  timelineId: "timeline-phase62",
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

test.describe("Phase 6.2 backend registry idempotency and lifecycle", () => {
  test("POST /exports is idempotent by requestId and does not fabricate terminal output", async () => {
    const firstResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createRequest("request-phase62-idem")),
    });
    expect(firstResponse.status).toBe(202);
    const firstBody = (await firstResponse.json()) as {
      kind: string;
      handle: { jobId: string; status: string };
      result?: unknown;
      artifacts?: unknown;
      downloadUrl?: unknown;
      progress?: unknown;
    };
    expect(firstBody.kind).toBe("accepted_job");
    expect(firstBody.handle.status).toBe("submitted");
    expect(firstBody.result).toBeUndefined();
    expect(firstBody.artifacts).toBeUndefined();
    expect(firstBody.downloadUrl).toBeUndefined();
    expect(firstBody.progress).toBeUndefined();

    const secondResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createRequest("request-phase62-idem")),
    });
    expect(secondResponse.status).toBe(202);
    const secondBody = (await secondResponse.json()) as {
      kind: string;
      handle: { jobId: string; status: string };
      result?: unknown;
      artifacts?: unknown;
      downloadUrl?: unknown;
      progress?: unknown;
    };

    expect(secondBody.kind).toBe("accepted_job");
    expect(secondBody.handle.status).toBe("submitted");
    expect(secondBody.handle.jobId).toBe(firstBody.handle.jobId);
    expect(secondBody.result).toBeUndefined();
    expect(secondBody.artifacts).toBeUndefined();
    expect(secondBody.downloadUrl).toBeUndefined();
    expect(secondBody.progress).toBeUndefined();
  });

  test("POST /exports with different requestId creates a different job", async () => {
    const firstResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createRequest("request-phase62-a")),
    });
    const firstBody = (await firstResponse.json()) as {
      handle: { jobId: string };
    };

    const secondResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createRequest("request-phase62-b")),
    });
    const secondBody = (await secondResponse.json()) as {
      handle: { jobId: string };
    };

    expect(secondBody.handle.jobId).not.toBe(firstBody.handle.jobId);
  });

  test("GET /exports/:jobId stays truthful pending with no fake success/progress/artifacts", async () => {
    const createdResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createRequest("request-phase62-get")),
    });
    const createdBody = (await createdResponse.json()) as {
      handle: { jobId: string };
    };

    const response = await fetch(`${baseUrl}/exports/${createdBody.handle.jobId}`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.kind).toBe("pending");
    expect(body).toHaveProperty("handle");
    expect(body).not.toHaveProperty("result");
    expect(body).not.toHaveProperty("artifacts");
    expect(body).not.toHaveProperty("downloadUrl");
    expect(body).not.toHaveProperty("progress");
  });

  test("GET /exports/:jobId/artifacts remains unavailable with no fake refs or urls", async () => {
    const createdResponse = await fetch(`${baseUrl}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createRequest("request-phase62-artifacts")),
    });
    const createdBody = (await createdResponse.json()) as {
      handle: { jobId: string };
    };

    const response = await fetch(
      `${baseUrl}/exports/${createdBody.handle.jobId}/artifacts`,
    );
    expect(response.status).toBe(409);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("export_artifacts_unavailable");
    expect(body).not.toHaveProperty("artifacts");
    expect(body).not.toHaveProperty("downloadUrl");
  });
});
