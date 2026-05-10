import { expect, test } from "@playwright/test";
import {
  ExportJobTransitionError,
  InMemoryExportJobRegistry,
} from "../../backend/registry/exportJobRegistry";

const createRegistry = () => new InMemoryExportJobRegistry();

const createJob = (registry: InMemoryExportJobRegistry, requestId: string) =>
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
  test("eligible submitted job can be claimed by worker", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-claim");
    const claimed = registry.claim(job.jobId, "worker-a");
    expect(claimed.claimedByWorkerId).toBe("worker-a");
  });

  test("claim stores claimedByWorkerId and increments attemptCount", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-attempts");
    expect(job.attemptCount).toBe(0);
    const claimed = registry.claim(job.jobId, "worker-a");
    expect(claimed.attemptCount).toBe(1);

    const claimedAgain = registry.claim(job.jobId, "worker-a");
    expect(claimedAgain.attemptCount).toBe(2);
  });

  test("same claimed job cannot be claimed by a different worker", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-claim-conflict");
    registry.claim(job.jobId, "worker-a");
    expect(() => registry.claim(job.jobId, "worker-b")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("terminal job cannot be claimed", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-terminal-claim");
    registry.transition(job.jobId, "error", {
      failure: { message: "failed", code: "renderer_failed" },
    });

    expect(() => registry.claim(job.jobId, "worker-a")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("non-owner worker cannot markRendering", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-non-owner-render");
    registry.claim(job.jobId, "worker-a");
    expect(() => registry.markRendering(job.jobId, "worker-b")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("owning worker can markRendering", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-owner-render");
    registry.claim(job.jobId, "worker-a");
    const rendering = registry.markRendering(job.jobId, "worker-a");
    expect(rendering.status).toBe("rendering");
  });

  test("owning worker can markFinalizing after rendering", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-owner-finalize");
    registry.claim(job.jobId, "worker-a");
    registry.markRendering(job.jobId, "worker-a");
    const finalizing = registry.markFinalizing(job.jobId, "worker-a");
    expect(finalizing.status).toBe("finalizing");
  });

  test("markSuccess requires owning worker and valid artifact metadata", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-owner-success");
    registry.claim(job.jobId, "worker-a");
    registry.markRendering(job.jobId, "worker-a");
    registry.markFinalizing(job.jobId, "worker-a");

    expect(() =>
      registry.markSuccess(job.jobId, "worker-b", [createArtifact(job.jobId)]),
    ).toThrow(ExportJobTransitionError);

    const success = registry.markSuccess(job.jobId, "worker-a", [
      createArtifact(job.jobId),
    ]);
    expect(success.status).toBe("success");
  });

  test("markError requires owning worker and valid failure", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-owner-error");
    registry.claim(job.jobId, "worker-a");

    expect(() =>
      registry.markError(job.jobId, "worker-b", {
        message: "x",
        code: "renderer_failed",
      }),
    ).toThrow(ExportJobTransitionError);

    expect(() =>
      registry.markError(job.jobId, "worker-a", {
        message: "",
      }),
    ).toThrow(ExportJobTransitionError);

    const error = registry.markError(job.jobId, "worker-a", {
      message: "render failed",
      code: "renderer_failed",
    });
    expect(error.status).toBe("error");
  });

  test("terminal states remain immutable", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-terminal-immutable");
    registry.claim(job.jobId, "worker-a");
    registry.markRendering(job.jobId, "worker-a");
    registry.markFinalizing(job.jobId, "worker-a");
    registry.markSuccess(job.jobId, "worker-a", [createArtifact(job.jobId)]);

    expect(() => registry.markRendering(job.jobId, "worker-a")).toThrow(
      ExportJobTransitionError,
    );
    expect(() =>
      registry.markError(job.jobId, "worker-a", {
        message: "late failure",
      }),
    ).toThrow(ExportJobTransitionError);
  });

  test("no fake progress percent or artifact urls/download urls are added", () => {
    const registry = createRegistry();
    const job = createJob(registry, "phase68-no-fake");
    registry.claim(job.jobId, "worker-a");
    const rendering = registry.markRendering(job.jobId, "worker-a");
    registry.markFinalizing(job.jobId, "worker-a");
    const success = registry.markSuccess(job.jobId, "worker-a", [
      createArtifact(job.jobId),
    ]);

    expect((rendering as unknown as Record<string, unknown>).percent).toBeUndefined();
    expect((rendering as unknown as Record<string, unknown>).progress).toBeUndefined();
    const artifact = success.artifacts?.[0] as unknown as Record<string, unknown>;
    expect(artifact.url).toBeUndefined();
    expect(artifact.downloadUrl).toBeUndefined();
  });
});
