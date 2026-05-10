import { expect, test } from "@playwright/test";
import {
  createRenderInputSnapshot,
  RenderInputSnapshotError,
  validateRenderInputSnapshot,
} from "../../backend/contracts/renderInputSnapshot";
import { InMemoryExportJobRegistry } from "../../backend/registry/exportJobRegistry";

const createValidSnapshot = () => ({
  jobId: "job-phase70",
  timelineId: "timeline-phase70",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  timelineSnapshot: {
    timelineId: "timeline-phase70",
    clips: [
      {
        clipId: "clip-1",
        sceneRefId: "scene-1",
        startMs: 0,
        durationMs: 4000,
        order: 0,
      },
    ],
  },
  sceneRefs: [{ sceneId: "scene-1", role: "primary" }],
  mediaRefs: [],
  outputTarget: {
    jobFolderKey: "job-phase70",
    artifactBaseName: "timeline-phase70-main",
    format: "mp4",
  },
});

test.describe("Phase 7.0 renderer input snapshot contract", () => {
  test("valid renderer input snapshot is accepted structurally", () => {
    const snapshot = validateRenderInputSnapshot(createValidSnapshot());
    expect(snapshot.jobId).toBe("job-phase70");
    expect(snapshot.timelineSnapshot.clips).toHaveLength(1);
  });

  test("missing jobId is rejected", () => {
    const { jobId: _removed, ...missing } = createValidSnapshot();
    expect(() => validateRenderInputSnapshot(missing)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("missing timelineId is rejected", () => {
    const { timelineId: _removed, ...missing } = createValidSnapshot();
    expect(() => validateRenderInputSnapshot(missing)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("missing renderSettings is rejected", () => {
    const { renderSettings: _removed, ...missing } = createValidSnapshot();
    expect(() => validateRenderInputSnapshot(missing)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("empty timelineSnapshot/clips policy is explicit and rejected", () => {
    const snapshot = createValidSnapshot();
    snapshot.timelineSnapshot.clips = [];
    expect(() => validateRenderInputSnapshot(snapshot)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("invalid clip timing is rejected", () => {
    const negativeStart = createValidSnapshot();
    negativeStart.timelineSnapshot.clips[0].startMs = -1;
    expect(() => validateRenderInputSnapshot(negativeStart)).toThrow(
      RenderInputSnapshotError,
    );

    const zeroDuration = createValidSnapshot();
    zeroDuration.timelineSnapshot.clips[0].durationMs = 0;
    expect(() => validateRenderInputSnapshot(zeroDuration)).toThrow(
      RenderInputSnapshotError,
    );

    const negativeDuration = createValidSnapshot();
    negativeDuration.timelineSnapshot.clips[0].durationMs = -100;
    expect(() => validateRenderInputSnapshot(negativeDuration)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("missing scene/media reference is rejected", () => {
    const snapshot = createValidSnapshot();
    snapshot.sceneRefs = [];
    snapshot.mediaRefs = [];
    expect(() => validateRenderInputSnapshot(snapshot)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("raw blob-like fields are rejected", () => {
    const snapshot = createValidSnapshot() as Record<string, unknown>;
    snapshot.blob = "fake";
    expect(() => validateRenderInputSnapshot(snapshot)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("URL/download/publicUrl fields are rejected", () => {
    const urlSnapshot = createValidSnapshot();
    (urlSnapshot.sceneRefs[0] as Record<string, unknown>).url =
      "https://example.com/scene.mp4";
    expect(() => validateRenderInputSnapshot(urlSnapshot)).toThrow(
      RenderInputSnapshotError,
    );

    const downloadSnapshot = createValidSnapshot();
    (downloadSnapshot.mediaRefs as Array<Record<string, unknown>>).push({
      mediaId: "media-1",
      downloadUrl: "https://example.com/download.mp4",
    });
    expect(() => validateRenderInputSnapshot(downloadSnapshot)).toThrow(
      RenderInputSnapshotError,
    );

    const publicUrlSnapshot = createValidSnapshot();
    (publicUrlSnapshot.outputTarget as Record<string, unknown>).publicUrl =
      "https://example.com/out.mp4";
    expect(() => validateRenderInputSnapshot(publicUrlSnapshot)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("path traversal in outputTarget is rejected", () => {
    const snapshot = createValidSnapshot();
    snapshot.outputTarget.jobFolderKey = "..\\unsafe";
    expect(() => validateRenderInputSnapshot(snapshot)).toThrow(
      RenderInputSnapshotError,
    );
  });

  test("snapshot helper does not add progress/artifacts/download URLs", () => {
    const snapshot = createRenderInputSnapshot(createValidSnapshot());
    const asRecord = snapshot as unknown as Record<string, unknown>;
    expect(asRecord.progress).toBeUndefined();
    expect(asRecord.percent).toBeUndefined();
    expect(asRecord.artifacts).toBeUndefined();
    expect(asRecord.downloadUrl).toBeUndefined();
  });

  test("snapshot helper does not trigger lifecycle transitions", () => {
    const registry = new InMemoryExportJobRegistry();
    const job = registry.create({
      requestId: "phase70-lifecycle",
      timelineId: "timeline-phase70",
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
    });
    expect(job.status).toBe("submitted");

    createRenderInputSnapshot({
      ...createValidSnapshot(),
      jobId: job.jobId,
      timelineId: job.timelineId,
      timelineSnapshot: {
        ...createValidSnapshot().timelineSnapshot,
        timelineId: job.timelineId,
      },
      outputTarget: {
        ...createValidSnapshot().outputTarget,
        jobFolderKey: job.jobId,
      },
    });

    const after = registry.getById(job.jobId);
    expect(after?.status).toBe("submitted");
  });
});
