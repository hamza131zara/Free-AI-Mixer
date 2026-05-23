import { expect, test } from "@playwright/test";
import {
  buildRenderInputSnapshot,
  RenderInputSnapshotBuilderError,
} from "../../backend/renderer/renderInputSnapshotBuilder";
import { renderInputSnapshotVersion } from "../../backend/contracts/renderInputSnapshot";
import {
  buildTimelineExportSnapshot,
  ExportSnapshotBuilderError,
} from "../../src/services/exportSnapshotService";
import type { SceneRecord } from "../../src/types/scene";
import type { Timeline } from "../../src/types/timeline";

const createSuccessScene = (
  id: string,
  overrides: Partial<SceneRecord> = {},
): SceneRecord => ({
  id,
  lifecycle: "success",
  payload: {
    prompt: `Prompt for ${id}`,
  },
  progress: 100,
  result: {
    image: `provider-image-token-${id}`,
    variations: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:10.000Z",
  ...overrides,
});

const createTimeline = (): Timeline => ({
  id: "timeline-phase6",
  name: "Phase 6 Timeline",
  clips: [
    {
      id: "clip-b",
      sceneId: "scene-b",
      source: "scene",
      order: 1,
      startMs: 3000,
      durationMs: 2000,
      label: "Second clip",
    },
    {
      id: "clip-a",
      sceneId: "scene-a",
      source: "scene",
      order: 0,
      startMs: 0,
      durationMs: 3000,
      label: "First clip",
    },
  ],
  selection: {},
  playback: {
    status: "idle",
    currentTimeMs: 0,
  },
  totalDurationMs: 5000,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

test.describe("product phase 6 render snapshot builder", () => {
  test("builds a truthful RenderInputSnapshot from real timeline clips", () => {
    const timeline = createTimeline();
    const snapshotSource = buildTimelineExportSnapshot(timeline, [
      createSuccessScene("scene-a"),
      createSuccessScene("scene-b"),
    ]);

    const snapshot = buildRenderInputSnapshot({
      jobId: "job-phase6",
      timelineId: timeline.id,
      renderSettings: {
        format: "mp4",
        resolution: "1080p",
        fps: 30,
        quality: "standard",
      },
      snapshotSource,
    });

    expect(snapshot.snapshotVersion).toBe(renderInputSnapshotVersion);
    expect(snapshot.timelineSnapshot.timelineId).toBe(timeline.id);
    expect(snapshot.timelineSnapshot.clips.map((clip) => clip.clipId)).toEqual([
      "clip-a",
      "clip-b",
    ]);
    expect(snapshot.timelineSnapshot.clips.map((clip) => clip.sceneRefId)).toEqual([
      "scene-a",
      "scene-b",
    ]);
    expect(snapshot.timelineSnapshot.clips.map((clip) => clip.startMs)).toEqual([
      0,
      3000,
    ]);
    expect(snapshot.timelineSnapshot.clips.map((clip) => clip.durationMs)).toEqual([
      3000,
      2000,
    ]);
    expect(snapshot.mediaRefs.map((mediaRef) => mediaRef.mediaId)).toEqual([
      "scene-media:scene-a:selected",
      "scene-media:scene-b:selected",
    ]);
    expect(snapshot.sceneRefs.map((sceneRef) => sceneRef.sceneId)).toEqual([
      "scene-a",
      "scene-b",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("scene-0");
  });

  test("fails closed when a scene is missing generated media", () => {
    const timeline = createTimeline();

    expect(() =>
      buildTimelineExportSnapshot(timeline, [
        createSuccessScene("scene-a", {
          result: undefined,
        }),
        createSuccessScene("scene-b"),
      ]),
    ).toThrow(ExportSnapshotBuilderError);
  });

  test("rejects snapshot input with missing media refs", () => {
    expect(() =>
      buildRenderInputSnapshot({
        jobId: "job-phase6",
        timelineId: "timeline-phase6",
        renderSettings: {
          format: "mp4",
          resolution: "1080p",
          fps: 30,
          quality: "standard",
        },
        snapshotSource: {
          snapshotVersion: 1,
          timelineSnapshot: {
            timelineId: "timeline-phase6",
            clips: [
              {
                clipId: "clip-a",
                sceneRefId: "scene-a",
                startMs: 0,
                durationMs: 1000,
                order: 0,
              },
            ],
          },
          sceneRefs: [{ sceneId: "scene-a", role: "primary" }],
          mediaRefs: [],
        },
      }),
    ).toThrow(RenderInputSnapshotBuilderError);
  });

  test("rejects blob URLs public URLs and local paths in snapshot input", () => {
    const unsafeSources = [
      {
        snapshotVersion: 1,
        timelineSnapshot: {
          timelineId: "timeline-phase6",
          clips: [
            {
              clipId: "clip-a",
              sceneRefId: "scene-a",
              startMs: 0,
              durationMs: 1000,
              order: 0,
              blobUrl: "blob:unsafe",
            },
          ],
        },
        sceneRefs: [{ sceneId: "scene-a", role: "primary" }],
        mediaRefs: [{ mediaId: "scene-media:scene-a:selected" }],
      },
      {
        snapshotVersion: 1,
        timelineSnapshot: {
          timelineId: "timeline-phase6",
          clips: [
            {
              clipId: "clip-a",
              sceneRefId: "scene-a",
              startMs: 0,
              durationMs: 1000,
              order: 0,
            },
          ],
        },
        sceneRefs: [
          {
            sceneId: "scene-a",
            url: "https://example.com/not-allowed.png",
          },
        ],
        mediaRefs: [{ mediaId: "scene-media:scene-a:selected" }],
      },
      {
        snapshotVersion: 1,
        timelineSnapshot: {
          timelineId: "timeline-phase6",
          clips: [
            {
              clipId: "clip-a",
              sceneRefId: "scene-a",
              startMs: 0,
              durationMs: 1000,
              order: 0,
            },
          ],
        },
        sceneRefs: [{ sceneId: "scene-a", role: "primary" }],
        mediaRefs: [
          {
            mediaId: "scene-media:scene-a:selected",
            localPath: "C:\\temp\\unsafe.mp4",
          },
        ],
      },
    ];

    for (const snapshotSource of unsafeSources) {
      expect(() =>
        buildRenderInputSnapshot({
          jobId: "job-phase6",
          timelineId: "timeline-phase6",
          renderSettings: {
            format: "mp4",
            resolution: "1080p",
            fps: 30,
            quality: "standard",
          },
          snapshotSource,
        }),
      ).toThrow(RenderInputSnapshotBuilderError);
    }
  });
});
