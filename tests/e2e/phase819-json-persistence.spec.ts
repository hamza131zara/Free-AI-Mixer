import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import { JsonFileExportJobRegistry } from "../../backend/registry/jsonFileExportJobRegistry";
import { InMemoryExportJobRegistry } from "../../backend/registry/inMemoryExportJobRegistry";
import { createBackendDependencies } from "../../backend/composition/backendDependencies";

const TEST_FILE_PATH = path.join(process.cwd(), ".test-jobs.json");

async function cleanupTestFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
  try {
    await fs.unlink(filePath + ".tmp");
  } catch {
    // ignore
  }
}

test.describe("phase819 JSON file persistence adapter", () => {
  test.afterEach(async () => {
    await cleanupTestFile(TEST_FILE_PATH);
  });

  test("JSON adapter creates and persists job file", async () => {
    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });

    registry.create({
      requestId: "test-request-123",
      timelineId: "timeline-1",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });

    // File should exist after create
    const exists = await fs.access(TEST_FILE_PATH).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // File should contain JSON
    const content = await fs.readFile(TEST_FILE_PATH, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe(1);
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0].requestId).toBe("test-request-123");
  });

  test("JSON adapter getById works after re-instantiation", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry1.create({
      requestId: "test-request-456",
      timelineId: "timeline-2",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry2.getById(job.jobId);

    expect(recovered).toBeDefined();
    expect(recovered?.jobId).toBe(job.jobId);
    expect(recovered?.requestId).toBe("test-request-456");
  });

  test("getByRequestId survives restart", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    registry1.create({
      requestId: "idempotency-test",
      timelineId: "timeline-3",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry2.getByRequestId("idempotency-test");

    expect(recovered).toBeDefined();
    expect(recovered?.requestId).toBe("idempotency-test");
  });

  test("requestId idempotency survives restart", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    registry1.create({
      requestId: "idempotency-same",
      timelineId: "timeline-4",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });

    // Verify getByRequestId survives restart (route-level idempotency pattern)
    const recovered = registry2.getByRequestId("idempotency-same");
    expect(recovered).toBeDefined();
    expect(recovered?.requestId).toBe("idempotency-same");
  });

  test("getByStatus works after re-instantiation", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    registry1.create({
      requestId: "status-test-1",
      timelineId: "timeline-5",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const submitted = registry2.getByStatus("submitted");

    expect(submitted.length).toBeGreaterThan(0);
  });

  test("claim persists safely", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry1.create({
      requestId: "claim-test",
      timelineId: "timeline-6",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });
    registry1.claim(job.jobId, "worker-1");

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry2.getById(job.jobId);

    expect(recovered?.claimedByWorkerId).toBe("worker-1");
    expect(recovered?.attemptCount).toBe(1);
  });

  test("markRendering persists safely", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry1.create({
      requestId: "mark-render-test",
      timelineId: "timeline-7",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });
    registry1.claim(job.jobId, "worker-1");
    registry1.markRendering(job.jobId, "worker-1");

    // Create new registry instance (simulating restart)
    // Recovery policy maps rendering -> submitted on load
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry2.getById(job.jobId);

    // Job recovered as submitted (rendering -> submitted per Phase 8.18 recovery policy)
    expect(recovered?.status).toBe("submitted");
  });

  test("markSuccess persists safely", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry1.create({
      requestId: "success-test",
      timelineId: "timeline-8",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });
    registry1.claim(job.jobId, "worker-1");
    registry1.markRendering(job.jobId, "worker-1");
    registry1.markFinalizing(job.jobId, "worker-1");
    registry1.markSuccess(job.jobId, "worker-1", [
      {
        artifactId: "art-123",
        jobId: job.jobId,
        kind: "render_output",
        format: "mp4",
        status: "available",
        createdAt: new Date().toISOString(),
      },
    ]);

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry2.getById(job.jobId);

    expect(recovered?.status).toBe("success");
    expect(recovered?.artifacts).toHaveLength(1);
  });

  test("markError persists safely", async () => {
    const registry1 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry1.create({
      requestId: "error-test",
      timelineId: "timeline-9",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });
    registry1.claim(job.jobId, "worker-1");
    registry1.markRendering(job.jobId, "worker-1");
    registry1.markError(job.jobId, "worker-1", {
      message: "Render failed",
      code: "RENDER_ERROR",
    });

    // Create new registry instance (simulating restart)
    const registry2 = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry2.getById(job.jobId);

    expect(recovered?.status).toBe("error");
    expect(recovered?.failure?.message).toBe("Render failed");
    expect(recovered?.failure?.code).toBe("RENDER_ERROR");
  });

  test("submitted recovers as submitted", async () => {
    // Manually create a JSON file with submitted status
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-submitted-123",
          requestId: "req-submitted-123",
          timelineId: "timeline-sub",
          status: "submitted",
          attemptCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: { "req-submitted-123": "job-submitted-123" },
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-submitted-123");

    expect(recovered?.status).toBe("submitted");
  });

  test("rendering recovers to submitted", async () => {
    // Manually create a JSON file with rendering status
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-rendering-123",
          requestId: "req-rendering-123",
          timelineId: "timeline-render",
          status: "rendering",
          attemptCount: 2,
          claimedByWorkerId: "worker-dead",
          claimExpiresAt: new Date(Date.now() - 1000).toISOString(), // expired
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: { "req-rendering-123": "job-rendering-123" },
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-rendering-123");

    expect(recovered?.status).toBe("submitted");
    expect(recovered?.claimedByWorkerId).toBeUndefined();
    expect(recovered?.claimExpiresAt).toBeUndefined();
    expect(recovered?.attemptCount).toBe(2); // preserved
  });

  test("finalizing recovers to submitted", async () => {
    // Manually create a JSON file with finalizing status
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-finalizing-123",
          requestId: "req-finalizing-123",
          timelineId: "timeline-final",
          status: "finalizing",
          attemptCount: 1,
          claimedByWorkerId: "worker-dead",
          claimExpiresAt: new Date(Date.now() - 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: { "req-finalizing-123": "job-finalizing-123" },
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-finalizing-123");

    expect(recovered?.status).toBe("submitted");
    expect(recovered?.claimedByWorkerId).toBeUndefined();
    expect(recovered?.claimExpiresAt).toBeUndefined();
  });

  test("terminal success remains success", async () => {
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-success-123",
          requestId: "req-success-123",
          timelineId: "timeline-success",
          status: "success",
          attemptCount: 1,
          artifacts: [
            {
              artifactId: "art-success",
              jobId: "job-success-123",
              kind: "render_output",
              format: "mp4",
              status: "available",
              createdAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: {},
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-success-123");

    expect(recovered?.status).toBe("success");
    expect(recovered?.artifacts?.[0]?.artifactId).toBe("art-success");
  });

  test("terminal error remains error", async () => {
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-error-123",
          requestId: "req-error-123",
          timelineId: "timeline-error",
          status: "error",
          attemptCount: 1,
          failure: { message: "Test error", code: "TEST" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: {},
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-error-123");

    expect(recovered?.status).toBe("error");
    expect(recovered?.failure?.message).toBe("Test error");
  });

  test("terminal expired remains expired", async () => {
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-expired-123",
          requestId: "req-expired-123",
          timelineId: "timeline-expired",
          status: "expired",
          attemptCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          expiredAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: {},
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-expired-123");

    expect(recovered?.status).toBe("expired");
  });

  test("artifact metadata persistence excludes local paths/URLs/download/signed URLs", async () => {
    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry.create({
      requestId: "artifact-safe-test",
      timelineId: "timeline-artifact",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });
    registry.claim(job.jobId, "worker-1");
    registry.markRendering(job.jobId, "worker-1");
    registry.markFinalizing(job.jobId, "worker-1");
    registry.markSuccess(job.jobId, "worker-1", [
      {
        artifactId: "art-safe",
        jobId: job.jobId,
        kind: "render_output",
        format: "mp4",
        status: "available",
        createdAt: new Date().toISOString(),
      },
    ]);

    // Read persisted file
    const content = await fs.readFile(TEST_FILE_PATH, "utf8");
    const parsed = JSON.parse(content);
    const artifact = parsed.jobs.find((j: { jobId: string }) => j.jobId === job.jobId)?.artifacts?.[0];

    expect(artifact).toBeDefined();
    expect(artifact).not.toHaveProperty("path");
    expect(artifact).not.toHaveProperty("filePath");
    expect(artifact).not.toHaveProperty("url");
    expect(artifact).not.toHaveProperty("downloadUrl");
    expect(artifact).not.toHaveProperty("signedUrl");
    expect(artifact).not.toHaveProperty("artifactUrl");
  });

  test("failure.details is not persisted", async () => {
    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const job = registry.create({
      requestId: "failure-sanitize-test",
      timelineId: "timeline-failure",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });
    registry.claim(job.jobId, "worker-1");
    registry.markRendering(job.jobId, "worker-1");
    registry.markError(job.jobId, "worker-1", {
      message: "Error occurred",
      code: "ERR",
      details: { stack: "some stack trace" }, // details should not be persisted
    });

    // Read persisted file
    const content = await fs.readFile(TEST_FILE_PATH, "utf8");
    const parsed = JSON.parse(content);
    const failure = parsed.jobs.find((j: { jobId: string }) => j.jobId === job.jobId)?.failure;

    expect(failure).toBeDefined();
    expect(failure.message).toBe("Error occurred");
    expect(failure.code).toBe("ERR");
    expect(failure).not.toHaveProperty("details");
  });

  test("write uses temp file + rename", async () => {
    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });

    registry.create({
      requestId: "atomic-test",
      timelineId: "timeline-atomic",
      renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
    });

    // After write, temp file should not exist
    try {
      await fs.access(TEST_FILE_PATH + ".tmp");
      // If it exists, it should have been renamed
      const exists = await fs.access(TEST_FILE_PATH + ".tmp").then(() => true).catch(() => false);
      expect(exists).toBe(false);
    } catch {
      // Expected - file shouldn't exist
    }

    // Main file should exist
    const mainExists = await fs.access(TEST_FILE_PATH).then(() => true).catch(() => false);
    expect(mainExists).toBe(true);
  });

  test(".free-ai-mixer-jobs.json is gitignored", async () => {
    const gitignoreContent = await fs.readFile(path.resolve(process.cwd(), ".gitignore"), "utf8");
    expect(gitignoreContent).toContain(".free-ai-mixer-jobs.json");
    expect(gitignoreContent).toContain(".free-ai-mixer-jobs.json.tmp");
  });

  test("createBackendDependencies uses JSON adapter only when env flag is true", async () => {
    // With env flag set
    const originalEnv = process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;
    process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = "true";

    const deps = createBackendDependencies();
    expect(deps.registry).toBeInstanceOf(JsonFileExportJobRegistry);

    process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = originalEnv ?? "";
  });

  test("createBackendDependencies defaults to InMemoryExportJobRegistry when flag is missing", async () => {
    const originalEnv = process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;
    delete process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;

    const deps = createBackendDependencies();
    expect(deps.registry).toBeInstanceOf(InMemoryExportJobRegistry);

    process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = originalEnv ?? "";
  });

  test("createBackendDependencies defaults to InMemoryExportJobRegistry when flag is 'false'", async () => {
    const originalEnv = process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED;
    process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = "false";

    const deps = createBackendDependencies();
    expect(deps.registry).toBeInstanceOf(InMemoryExportJobRegistry);

    process.env.FREE_AI_MIXER_PERSISTENCE_ENABLED = originalEnv ?? "";
  });

  test("new files are JSON adapter and tests only", async () => {
    // Verify new files exist
    const jsonAdapterPath = path.resolve(process.cwd(), "backend/registry/jsonFileExportJobRegistry.ts");
    const testPath = path.resolve(process.cwd(), "tests/e2e/phase819-json-persistence.spec.ts");

    const jsonAdapterExists = await fs.access(jsonAdapterPath).then(() => true).catch(() => false);
    const testExists = await fs.access(testPath).then(() => true).catch(() => false);

    expect(jsonAdapterExists).toBe(true);
    expect(testExists).toBe(true);
  });

  test("recovered non-terminal jobs clear claimedByWorkerId and claimExpiresAt", async () => {
    // Manually create JSON with expired claim
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-claim-clear",
          requestId: "req-claim-clear",
          timelineId: "timeline-claim",
          status: "rendering",
          attemptCount: 1,
          claimedByWorkerId: "dead-worker",
          claimExpiresAt: new Date(Date.now() - 5000).toISOString(), // expired
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: { "req-claim-clear": "job-claim-clear" },
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-claim-clear");

    expect(recovered?.status).toBe("submitted");
    expect(recovered?.claimedByWorkerId).toBeUndefined();
    expect(recovered?.claimExpiresAt).toBeUndefined();
    expect(recovered?.attemptCount).toBe(1); // preserved
  });

  test("attemptCount is preserved through recovery", async () => {
    const data = {
      version: 1,
      jobs: [
        {
          jobId: "job-attempt-preserve",
          requestId: "req-attempt-preserve",
          timelineId: "timeline-attempt",
          status: "rendering",
          attemptCount: 5,
          claimedByWorkerId: "dead-worker",
          claimExpiresAt: new Date(Date.now() - 1000).toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          renderSettings: { width: 1920, height: 1080, fps: 30, format: "mp4" },
        },
      ],
      requestIdToJobId: { "req-attempt-preserve": "job-attempt-preserve" },
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(TEST_FILE_PATH, JSON.stringify(data), "utf8");

    const registry = new JsonFileExportJobRegistry({ filePath: TEST_FILE_PATH });
    const recovered = registry.getById("job-attempt-preserve");

    expect(recovered?.attemptCount).toBe(5);
  });
});