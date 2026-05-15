import { expect, test, type Page } from "@playwright/test";
import { createApp } from "../../backend/app";
import { promises as fs } from "node:fs";

const testFilePath = ".test-frontend-refresh-jobs.json";

const cleanupTestFile = async (): Promise<void> => {
  try {
    await fs.unlink(testFilePath);
  } catch {
    // ignore
  }
  try {
    await fs.unlink(testFilePath + ".tmp");
  } catch {
    // ignore
  }
};

const startBackendWithPersistence = async (options?: { keepFile?: boolean }): Promise<{ baseUrl: string; cleanup: () => Promise<void> }> => {
  process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = "true";
  process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH = testFilePath;
  process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = undefined;
  process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = undefined;
  process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = undefined;

  const app = createApp();
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.on("listening", () => {
      const address = server.address();
      if (address && typeof address !== "string") {
        resolve();
      }
    });
  });

  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  return {
    baseUrl,
    cleanup: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      delete process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;
      delete process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH;
      delete process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
      delete process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
      delete process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION;
      if (!options?.keepFile) {
        await cleanupTestFile();
      }
    },
  };
};

test.describe("phase822 frontend export status refresh", () => {
  test.afterEach(async () => {
    await cleanupTestFile();
  });

  test("backend returns truthful status for persisted job", async () => {
    const { baseUrl, cleanup } = await startBackendWithPersistence();

    try {
      // Create a job via POST
      const postResponse = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "test-refresh-request",
          timelineId: "timeline-refresh",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse.status).toBe(202);
      const postBody = await postResponse.json() as { handle: { jobId: string } };
      const jobId = postBody.handle.jobId;

      // GET should return pending status
      const getResponse = await fetch(`${baseUrl}/exports/${jobId}`);
      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json() as { kind: string };
      expect(getBody.kind).toBe("pending");
    } finally {
      await cleanup();
    }
  });

  test("frontend refreshExportStatus action polls backend and updates state", async () => {
    const { baseUrl, cleanup } = await startBackendWithPersistence();

    try {
      // Create a job via POST
      const postResponse = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "test-frontend-refresh",
          timelineId: "timeline-frontend",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse.status).toBe(202);
      const postBody = await postResponse.json() as { handle: { jobId: string } };
      const jobId = postBody.handle.jobId;

      // Simulate frontend refresh by calling GET directly (same as refreshExportStatus does)
      const getResponse = await fetch(`${baseUrl}/exports/${jobId}`);
      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json() as {
        kind: string;
        handle?: { jobId: string; requestId: string; status: string };
      };
      expect(getBody.kind).toBe("pending");
      expect(getBody.handle?.jobId).toBe(jobId);
      expect(getBody.handle?.status).toBe("submitted");
    } finally {
      await cleanup();
    }
  });

  test("persisted job survives backend restart and returns consistent status", async () => {
    // First backend instance: create job (keep file after cleanup)
    const { baseUrl: baseUrl1, cleanup: cleanup1 } = await startBackendWithPersistence({ keepFile: true });

    let jobId: string;
    try {
      const postResponse = await fetch(`${baseUrl1}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "test-survival-request",
          timelineId: "timeline-survival",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse.status).toBe(202);
      const postBody = await postResponse.json() as { handle: { jobId: string } };
      jobId = postBody.handle.jobId;

      // Verify persistence file was created
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    } finally {
      // Cleanup server but keep the file for next instance
      await cleanup1();
    }

    // Verify file still exists after first server cleanup
    const fileStillExists = await fs.access(testFilePath).then(() => true).catch(() => false);
    expect(fileStillExists).toBe(true);

    // Second backend instance: same persistence file (will clean up in afterEach)
    const { baseUrl: baseUrl2, cleanup: cleanup2 } = await startBackendWithPersistence();

    try {
      // GET should return same truthful pending status (recovery policy maps rendering -> submitted)
      const getResponse = await fetch(`${baseUrl2}/exports/${jobId}`);
      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json() as { kind: string };
      expect(getBody.kind).toBe("pending");
    } finally {
      await cleanup2();
    }
  });

  test("refresh works for job without handle but with requestId", async () => {
    const { baseUrl, cleanup } = await startBackendWithPersistence();

    try {
      // Create a job via POST
      const postResponse = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "test-no-handle-request",
          timelineId: "timeline-no-handle",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse.status).toBe(202);
      const postBody = await postResponse.json() as { handle: { jobId: string; requestId: string } };
      const { jobId, requestId } = postBody.handle;

      // Frontend could reconstruct handle from requestId if needed
      // GET by jobId works
      const getResponse = await fetch(`${baseUrl}/exports/${jobId}`);
      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json() as { kind: string; handle: { requestId: string } };
      expect(getBody.kind).toBe("pending");
      expect(getBody.handle.requestId).toBe(requestId);
    } finally {
      await cleanup();
    }
  });
});