import { expect, test } from "@playwright/test";
import {
  ExportJobTransitionError,
  InMemoryExportJobRegistry,
  canTransition,
} from "../../backend/registry/exportJobRegistry";

const createRegistry = () => new InMemoryExportJobRegistry();

test.describe("Phase 6.6 backend lifecycle state machine", () => {
  test("allowed transitions pass", () => {
    const registry = createRegistry();
    const job = registry.create({
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
    const rendering = registry.transition(job.jobId, "rendering");
    expect(rendering.status).toBe("rendering");

    expect(canTransition(rendering.status, "finalizing")).toBe(true);
    const finalizing = registry.transition(job.jobId, "finalizing");
    expect(finalizing.status).toBe("finalizing");

    const success = registry.transition(job.jobId, "success", {
      artifacts: [{ id: "artifact-phase66" }],
    });
    expect(success.status).toBe("success");
    expect(success.artifacts).toEqual([{ id: "artifact-phase66" }]);
  });

  test("forbidden transitions fail", () => {
    const registry = createRegistry();
    const job = registry.create({
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
    expect(() => registry.transition(job.jobId, "success", { artifacts: [{ id: "a" }] })).toThrow(
      ExportJobTransitionError,
    );
    expect(() => registry.transition(job.jobId, "finalizing")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("terminal states cannot transition", () => {
    const registry = createRegistry();
    const job = registry.create({
      requestId: "phase66-terminal",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    registry.transition(job.jobId, "error", {
      failure: { message: "render failed", code: "renderer_failed" },
    });
    expect(() => registry.transition(job.jobId, "rendering")).toThrow(
      ExportJobTransitionError,
    );
    expect(() => registry.transition(job.jobId, "success", { artifacts: [{ id: "x" }] })).toThrow(
      ExportJobTransitionError,
    );
  });

  test("success without artifacts is rejected", () => {
    const registry = createRegistry();
    const job = registry.create({
      requestId: "phase66-no-artifacts",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    registry.transition(job.jobId, "rendering");
    registry.transition(job.jobId, "finalizing");

    expect(() => registry.transition(job.jobId, "success")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("success with artifact metadata is allowed only from finalizing", () => {
    const registry = createRegistry();
    const job = registry.create({
      requestId: "phase66-success-from-finalizing",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    registry.transition(job.jobId, "rendering");
    const finalizing = registry.transition(job.jobId, "finalizing");
    expect(finalizing.status).toBe("finalizing");

    const success = registry.transition(job.jobId, "success", {
      artifacts: [{ id: "artifact-verified", status: "ready" }],
    });
    expect(success.status).toBe("success");
    expect(success.artifacts?.[0].url).toBeUndefined();
  });

  test("expired is terminal", () => {
    const registry = createRegistry();
    const job = registry.create({
      requestId: "phase66-expired",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const expired = registry.transition(job.jobId, "expired");
    expect(expired.status).toBe("expired");
    expect(() => registry.transition(job.jobId, "rendering")).toThrow(
      ExportJobTransitionError,
    );
  });

  test("lifecycle transition methods do not add fake progress percent", () => {
    const registry = createRegistry();
    const job = registry.create({
      requestId: "phase66-progress",
      timelineId: "timeline-phase66",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });

    const rendering = registry.transition(job.jobId, "rendering");
    expect((rendering as unknown as Record<string, unknown>).progress).toBeUndefined();
    expect(
      (rendering as unknown as Record<string, unknown>).percent,
    ).toBeUndefined();
  });
});
