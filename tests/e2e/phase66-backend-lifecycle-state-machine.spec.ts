import { expect, test } from "@playwright/test";
import {
  ExportJobTransitionError,
  InMemoryExportJobRegistry,
  canTransition,
} from "../../backend/registry/exportJobRegistry";

const createRegistry = () => new InMemoryExportJobRegistry();

const createArtifact = (jobId: string, artifactId = "artifact-phase66") => ({
  artifactId,
  jobId,
  kind: "render_output",
  format: "mp4",
  status: "available",
  createdAt: "2026-05-10T00:00:00.000Z",
});

test.describe("Phase 6.6 backend lifecycle state machine", () => {
  test("allowed transitions pass", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-allowed",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    expect(canTransition(job.status, "rendering")).toBe(true);
    const rendering = await registry.transition(job.jobId, "rendering");
    expect(rendering.status).toBe("rendering");

    expect(canTransition(rendering.status, "finalizing")).toBe(true);
    const finalizing = await registry.transition(job.jobId, "finalizing");
    expect(finalizing.status).toBe("finalizing");

    const artifact = createArtifact(job.jobId);

    const success = await registry.transition(job.jobId, "success", {
      artifacts: [artifact],
    });

    expect(success.status).toBe("success");
    expect(success.artifacts).toEqual([artifact]);
  });

  test("forbidden transitions fail", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-forbidden",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    expect(canTransition(job.status, "success")).toBe(false);
    await expect(
      registry.transition(job.jobId, "success", {
        artifacts: [createArtifact(job.jobId, "artifact-forbidden")],
      }),
    ).rejects.toThrow(ExportJobTransitionError);
    await expect(registry.transition(job.jobId, "finalizing")).rejects.toThrow(
      ExportJobTransitionError,
    );
  });

  test("terminal states cannot transition", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-terminal",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    await registry.transition(job.jobId, "error", {
      failure: { message: "render failed", code: "renderer_failed" },
    });
    await expect(registry.transition(job.jobId, "rendering")).rejects.toThrow(
      ExportJobTransitionError,
    );
    await expect(
      registry.transition(job.jobId, "success", {
        artifacts: [createArtifact(job.jobId, "artifact-terminal")],
      }),
    ).rejects.toThrow(ExportJobTransitionError);
  });

  test("success without artifacts is rejected", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-no-artifacts",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    await registry.transition(job.jobId, "rendering");
    await registry.transition(job.jobId, "finalizing");

    await expect(registry.transition(job.jobId, "success")).rejects.toThrow(
      ExportJobTransitionError,
    );
  });

  test("success with artifact metadata is allowed only from finalizing", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-success-from-finalizing",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    await registry.transition(job.jobId, "rendering");
    const finalizing = await registry.transition(job.jobId, "finalizing");
    expect(finalizing.status).toBe("finalizing");

    const success = await registry.transition(job.jobId, "success", {
      artifacts: [createArtifact(job.jobId, "artifact-verified")],
    });

    expect(success.status).toBe("success");
    expect(success.artifacts?.[0].artifactId).toBe("artifact-verified");
    // expect(success.artifacts?.[0].url).toBeUndefined();
    expect(
  (success.artifacts?.[0] as unknown as Record<string, unknown>)?.url,
).toBeUndefined();
  });

  test("expired is terminal", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-expired",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const expired = await registry.transition(job.jobId, "expired");
    expect(expired.status).toBe("expired");
    await expect(registry.transition(job.jobId, "rendering")).rejects.toThrow(
      ExportJobTransitionError,
    );
  });

  test("lifecycle transition methods do not add fake progress percent", async () => {
    const registry = createRegistry();
    const job = await registry.create({
      requestId: "phase66-progress",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const rendering = await registry.transition(job.jobId, "rendering");
    expect(
      (rendering as unknown as Record<string, unknown>).progress,
    ).toBeUndefined();
    expect(
      (rendering as unknown as Record<string, unknown>).percent,
    ).toBeUndefined();
  });
});
