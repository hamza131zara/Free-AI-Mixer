import { expect, test } from "@playwright/test";
import {
  ExportJobTransitionError,
  InMemoryExportJobRegistry,
} from "../../backend/registry/exportJobRegistry";

const createRegistry = () => new InMemoryExportJobRegistry();

const createJob = async (registry: InMemoryExportJobRegistry, requestId: string) =>
  registry.create({
    requestId,
    timelineId: "timeline-phase68",
    renderSettings: {
      format: "mp4",
      resolution: "1080p",
      fps: 30,
      quality: "standard",
    },
  });

const createArtifact = (jobId: string, artifactId = "artifact-phase68") => ({
  artifactId,
  jobId,
  kind: "render_output",
  format: "mp4",
  status: "available" as const,
  createdAt: "2026-05-10T00:00:00.000Z",
});

test.describe("Phase 6.8 worker-boundary claim contract", () => {
  test("eligible submitted job can be claimed by worker", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-claim");
    const claimed = await registry.claim(job.jobId, "worker-a");
    expect(claimed.claimedByWorkerId).toBe("worker-a");
  });

  test("claim stores claimedByWorkerId and increments attemptCount", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-attempts");
    expect(job.attemptCount).toBe(0);
    const claimed = await registry.claim(job.jobId, "worker-a");
    expect(claimed.attemptCount).toBe(1);

    const claimedAgain = await registry.claim(job.jobId, "worker-a");
    expect(claimedAgain.attemptCount).toBe(2);
  });

  test("same claimed job cannot be claimed by a different worker", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-claim-conflict");
    await registry.claim(job.jobId, "worker-a");
    await expect(registry.claim(job.jobId, "worker-b")).rejects.toThrow(
      ExportJobTransitionError,
    );
  });

  test("terminal job cannot be claimed", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-terminal-claim");
    await registry.transition(job.jobId, "error", {
      failure: { message: "failed", code: "renderer_failed" },
    });

    await expect(registry.claim(job.jobId, "worker-a")).rejects.toThrow(
      ExportJobTransitionError,
    );
  });

  test("non-owner worker cannot markRendering", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-non-owner-render");
    await registry.claim(job.jobId, "worker-a");
    await expect(registry.markRendering(job.jobId, "worker-b")).rejects.toThrow(
      ExportJobTransitionError,
    );
  });

  test("owning worker can markRendering", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-owner-render");
    await registry.claim(job.jobId, "worker-a");
    const rendering = await registry.markRendering(job.jobId, "worker-a");
    expect(rendering.status).toBe("rendering");
  });

  test("owning worker can markFinalizing after rendering", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-owner-finalize");
    await registry.claim(job.jobId, "worker-a");
    await registry.markRendering(job.jobId, "worker-a");
    const finalizing = await registry.markFinalizing(job.jobId, "worker-a");
    expect(finalizing.status).toBe("finalizing");
  });

  test("markSuccess requires owning worker and valid artifact metadata", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-owner-success");
    await registry.claim(job.jobId, "worker-a");
    await registry.markRendering(job.jobId, "worker-a");
    await registry.markFinalizing(job.jobId, "worker-a");

    await expect(
      registry.markSuccess(job.jobId, "worker-b", [createArtifact(job.jobId)]),
    ).rejects.toThrow(ExportJobTransitionError);

    const success = await registry.markSuccess(job.jobId, "worker-a", [
      createArtifact(job.jobId),
    ]);
    expect(success.status).toBe("success");
  });

  test("markError requires owning worker and valid failure", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-owner-error");
    await registry.claim(job.jobId, "worker-a");

    await expect(
      registry.markError(job.jobId, "worker-b", {
        message: "x",
        code: "renderer_failed",
      }),
    ).rejects.toThrow(ExportJobTransitionError);

    await expect(
      registry.markError(job.jobId, "worker-a", {
        message: "",
      }),
    ).rejects.toThrow(ExportJobTransitionError);

    const error = await registry.markError(job.jobId, "worker-a", {
      message: "render failed",
      code: "renderer_failed",
    });
    expect(error.status).toBe("error");
  });

  test("terminal states remain immutable", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-terminal-immutable");
    await registry.claim(job.jobId, "worker-a");
    await registry.markRendering(job.jobId, "worker-a");
    await registry.markFinalizing(job.jobId, "worker-a");
    await registry.markSuccess(job.jobId, "worker-a", [createArtifact(job.jobId)]);

    await expect(registry.markRendering(job.jobId, "worker-a")).rejects.toThrow(
      ExportJobTransitionError,
    );
    await expect(
      registry.markError(job.jobId, "worker-a", {
        message: "late failure",
      }),
    ).rejects.toThrow(ExportJobTransitionError);
  });

  test("no fake progress percent or artifact urls/download urls are added", async () => {
    const registry = createRegistry();
    const job = await createJob(registry, "phase68-no-fake");
    await registry.claim(job.jobId, "worker-a");
    const rendering = await registry.markRendering(job.jobId, "worker-a");
    await registry.markFinalizing(job.jobId, "worker-a");
    const success = await registry.markSuccess(job.jobId, "worker-a", [
      createArtifact(job.jobId),
    ]);

    expect((rendering as unknown as Record<string, unknown>).percent).toBeUndefined();
    expect((rendering as unknown as Record<string, unknown>).progress).toBeUndefined();
    const artifact = success.artifacts?.[0] as unknown as Record<string, unknown>;
    expect(artifact.url).toBeUndefined();
    expect(artifact.downloadUrl).toBeUndefined();
  });
});
