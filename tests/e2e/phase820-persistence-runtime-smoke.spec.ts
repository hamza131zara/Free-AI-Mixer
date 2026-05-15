import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { createApp } from "../../backend/app";

const getTestFilePath = (name: string) =>
  path.join(process.cwd(), `.test-persistence-${name}.json`);

async function cleanupTestFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

const saveEnvVars = (): Record<string, string | undefined> => ({
  FREE_AI_MIXER_PERSISTENCE_ENABLED: process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED,
  FREE_AI_MIXER_PERSISTENCE_FILE_PATH: process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH,
  FREE_AI_MIXER_ENABLE_WORKER_STARTUP: process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP,
  FREE_AI_MIXER_ENABLE_WORKER_LOOP: process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP,
  FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION: process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION,
});

const restoreEnvVars = (saved: Record<string, string | undefined>): void => {
  process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = saved.FREE_AI_MIXER_PERSISTENCE_ENABLED;
  process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH = saved.FREE_AI_MIXER_PERSISTENCE_FILE_PATH;
  process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = saved.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
  process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = saved.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
  process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = saved.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION;
};

const setEnvVars = (
  persistenceEnabled: boolean,
  filePath: string,
  workerEnabled: boolean = false,
  routeExecutionEnabled: boolean = false,
): void => {
  process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = persistenceEnabled ? "true" : undefined;
  process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH = filePath;
  process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP = workerEnabled ? "1" : undefined;
  process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP = workerEnabled ? "1" : undefined;
  process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION = routeExecutionEnabled ? "1" : undefined;
};

interface TestServerContext {
  baseUrl: string;
  cleanup: () => Promise<void>;
}

async function startTestServer(persistenceEnabled: boolean, filePath: string): Promise<TestServerContext> {
  setEnvVars(persistenceEnabled, filePath, false, false);

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
    },
  };
}

test.describe("phase820 persistence runtime smoke", () => {
  const testFilePath = getTestFilePath("smoke");

  test.afterEach(async () => {
    // Clear env vars for next test
    delete process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;
    delete process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    delete process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION;

    // Clean up test file
    await cleanupTestFile(testFilePath);
    await cleanupTestFile(testFilePath + ".tmp");
  });

  test("createApp with persistence enabled handles POST /exports and persists job file", async () => {
    const { baseUrl, cleanup } = await startTestServer(true, testFilePath);

    try {
      // POST /exports - using exact contract from phase814 tests
      const postResponse = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-request-1",
          timelineId: "timeline-1",
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
      const postBody = await postResponse.json() as { kind: string; handle: { jobId: string } };
      expect(postBody.kind).toBe("accepted_job");
      expect(postBody.handle).toHaveProperty("jobId");

      const jobId = postBody.handle.jobId;

      // Persistence file should be written
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Persisted JSON should have expected structure
      const content = await fs.readFile(testFilePath, "utf8");
      const parsed = JSON.parse(content);

      expect(parsed.version).toBe(1);
      expect(parsed.jobs).toBeDefined();
      expect(Array.isArray(parsed.jobs)).toBe(true);
      expect(parsed.jobs.length).toBe(1);
      expect(parsed.requestIdToJobId).toBeDefined();
      expect(parsed.requestIdToJobId["smoke-test-request-1"]).toBe(jobId);
      expect(parsed.updatedAt).toBeDefined();

      // Persisted job should have expected fields
      const persistedJob = parsed.jobs[0];
      expect(persistedJob.requestId).toBe("smoke-test-request-1");
      expect(persistedJob.timelineId).toBe("timeline-1");
      expect(persistedJob.status).toBe("submitted");
      expect(persistedJob.renderSettings.format).toBe("mp4");
    } finally {
      await cleanup();
    }
  });

  test("persisted JSON does not include local paths/URLs/download/signed URLs", async () => {
    const { baseUrl, cleanup } = await startTestServer(true, testFilePath);

    try {
      await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-safety",
          timelineId: "timeline-safety",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      const content = await fs.readFile(testFilePath, "utf8");
      const parsed = JSON.parse(content);
      const contentStr = JSON.stringify(parsed);

      // Should NOT contain any unsafe fields
      expect(contentStr).not.toContain("path:");
      expect(contentStr).not.toContain("filePath:");
      expect(contentStr).not.toContain("path");
      expect(contentStr).not.toContain("url:");
      expect(contentStr).not.toContain("artifactUrl");
      expect(contentStr).not.toContain("downloadUrl");
      expect(contentStr).not.toContain("signedUrl");
    } finally {
      await cleanup();
    }
  });

  test("recreated app with same persistence file returns truthful pending status via GET", async () => {
    // First app: create job
    const { baseUrl: baseUrl1, cleanup: cleanup1 } = await startTestServer(true, testFilePath);

    let jobId: string;
    try {
      const postResponse1 = await fetch(`${baseUrl1}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-recreate",
          timelineId: "timeline-recreate",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse1.status).toBe(202);
      const postBody1 = await postResponse1.json() as { handle: { jobId: string } };
      jobId = postBody1.handle.jobId;
    } finally {
      await cleanup1();
    }

    // Second app: recreate with same persistence file
    const { baseUrl: baseUrl2, cleanup: cleanup2 } = await startTestServer(true, testFilePath);

    try {
      // GET /exports/:jobId should return truthful pending
      const getResponse = await fetch(`${baseUrl2}/exports/${jobId}`);
      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json() as { kind: string; handle: { jobId: string; requestId: string } };
      expect(getBody.kind).toBe("pending");
      expect(getBody.handle.jobId).toBe(jobId);
      expect(getBody.handle.requestId).toBe("smoke-test-recreate");
    } finally {
      await cleanup2();
    }
  });

  test("requestId idempotency survives recreated app through route-level getByRequestId", async () => {
    // First app: create job
    const { baseUrl: baseUrl1, cleanup: cleanup1 } = await startTestServer(true, testFilePath);

    let jobId1: string;
    try {
      const postResponse1 = await fetch(`${baseUrl1}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-idempotency",
          timelineId: "timeline-idempotency",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse1.status).toBe(202);
      const postBody1 = await postResponse1.json() as { handle: { jobId: string } };
      jobId1 = postBody1.handle.jobId;
    } finally {
      await cleanup1();
    }

    // Second app: recreate with same persistence file
    const { baseUrl: baseUrl2, cleanup: cleanup2 } = await startTestServer(true, testFilePath);

    try {
      // POST again with same requestId - should return same job (idempotency)
      const postResponse2 = await fetch(`${baseUrl2}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-idempotency",
          timelineId: "timeline-idempotency",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      expect(postResponse2.status).toBe(202);
      const postBody2 = await postResponse2.json() as { kind: string; handle: { jobId: string } };
      expect(postBody2.kind).toBe("accepted_job");
      expect(postBody2.handle.jobId).toBe(jobId1); // Same jobId
    } finally {
      await cleanup2();
    }
  });

  test("persistence remains disabled by default when env flag is missing", async () => {
    // Clear persistence env vars
    delete process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;
    delete process.env.FREE_AI_MIXER_PERSISTENCE_FILE_PATH;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_STARTUP;
    delete process.env.FREE_AI_MIXER_ENABLE_WORKER_LOOP;
    delete process.env.FREE_AI_MIXER_ENABLE_ROUTE_EXECUTION;

    const app = createApp();
    const server = app.listen(0);

    try {
      const address = server.address() as { port: number };
      const baseUrl = `http://localhost:${address.port}`;

      // Create a job
      await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-default",
          timelineId: "timeline-default",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          requestedAt: new Date().toISOString(),
        }),
      });

      // With persistence disabled, no file should be written
      const fileExists = await fs.access(testFilePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test("no route execution is triggered during smoke", async () => {
    const { baseUrl, cleanup } = await startTestServer(true, testFilePath);

    try {
      // Create a job
      const postResponse = await fetch(`${baseUrl}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "smoke-test-no-execute",
          timelineId: "timeline-no-execute",
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

      // Try to execute the job - should be disabled
      const executeResponse = await fetch(`${baseUrl}/exports/${jobId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      expect(executeResponse.status).toBe(503);

      const executeBody = await executeResponse.json() as { code: string };
      expect(executeBody.code).toBe("route_execution_disabled");
    } finally {
      await cleanup();
    }
  });

  test("worker lifecycle does not process jobs during this smoke", async () => {
    setEnvVars(true, testFilePath, false, false);
    const app = createApp();

    // Check worker lifecycle status - should not be running with worker disabled
    const lifecycle = app.locals.renderWorkerLifecycle;
    expect(lifecycle).toBeDefined();

    const status = lifecycle.getStatus();
    // Worker should not be running since FREE_AI_MIXER_ENABLE_WORKER_STARTUP is not set
    expect(status.startupStatus.loopRunning).toBe(false);
  });

  test("GET returns truthful status for recovered rendering job via recovery policy", async () => {
    // First, manually create a file with rendering status to test recovery
    const renderingData = {
      version: 1,
      jobs: [
        {
          jobId: "job-recovery-test",
          requestId: "req-recovery-test",
          timelineId: "timeline-recovery",
          status: "rendering",
          attemptCount: 1,
          claimedByWorkerId: "dead-worker",
          claimExpiresAt: new Date(Date.now() - 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          renderSettings: { format: "mp4", resolution: "1080p", fps: 30, quality: "standard" },
        },
      ],
      requestIdToJobId: { "req-recovery-test": "job-recovery-test" },
      updatedAt: new Date().toISOString(),
    };

    // Write the test file
    await fs.writeFile(testFilePath, JSON.stringify(renderingData), "utf8");

    // Now create app with the existing file (recovery should happen)
    const { baseUrl, cleanup } = await startTestServer(true, testFilePath);

    try {
      // GET should return pending (recovered rendering -> submitted)
      const getResponse = await fetch(`${baseUrl}/exports/job-recovery-test`);
      expect(getResponse.status).toBe(200);

      const getBody = await getResponse.json() as { kind: string; handle: { jobId: string } };
      // Recovery policy maps rendering -> submitted
      expect(getBody.kind).toBe("pending");
      expect(getBody.handle.jobId).toBe("job-recovery-test");
    } finally {
      await cleanup();
    }
  });
});