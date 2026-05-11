import { expect, test } from "@playwright/test";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createFreeMixerCompositionModelFromSnapshot,
  renderFreeMixerCompositionModel,
} from "../../backend/renderer/compositions/freeMixerComposition";
import {
  FREE_MIXER_COMPOSITION_ID,
  toFreeMixerCompositionProps,
} from "../../backend/renderer/compositions/compositionProps";
import type { RenderInputSnapshot } from "../../backend/contracts/renderInputSnapshot";

const createSnapshot = (): RenderInputSnapshot => ({
  jobId: "job-phase79",
  timelineId: "timeline-phase79",
  renderSettings: {
    format: "mp4",
    resolution: "1080p",
    fps: 30,
    quality: "standard",
  },
  timelineSnapshot: {
    timelineId: "timeline-phase79",
    clips: [
      {
        clipId: "clip-a",
        sceneRefId: "scene-a",
        startMs: 0,
        durationMs: 1000,
        order: 0,
      },
      {
        clipId: "clip-b",
        sceneRefId: "scene-b",
        startMs: 1000,
        durationMs: 2000,
        order: 1,
      },
    ],
  },
  sceneRefs: [{ sceneId: "scene-a" }, { sceneId: "scene-b" }],
  mediaRefs: [],
  outputTarget: {
    jobFolderKey: "job-phase79",
    artifactBaseName: "final",
    format: "mp4",
  },
});

test.describe("phase79 remotion composition boundary scaffold", () => {
  test("composition module imports successfully", async () => {
    const module = await import("../../backend/renderer/compositions/freeMixerComposition");
    expect(typeof module.createFreeMixerCompositionModelFromSnapshot).toBe("function");
  });

  test("composition accepts RenderInputSnapshot-derived props", () => {
    const snapshot = createSnapshot();
    const props = toFreeMixerCompositionProps(snapshot);
    const model = renderFreeMixerCompositionModel(props);

    expect(model.compositionId).toBe(FREE_MIXER_COMPOSITION_ID);
    expect(model.timelineId).toBe(snapshot.timelineId);
    expect(model.fps).toBe(snapshot.renderSettings.fps);
    expect(model.laneBlocks.length).toBe(snapshot.timelineSnapshot.clips.length);
    expect(model.totalDurationMs).toBe(3000);
  });

  test("derived composition model from snapshot is deterministic and serializable", () => {
    const model = createFreeMixerCompositionModelFromSnapshot(createSnapshot());
    const serialized = JSON.stringify(model);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed.timelineId).toBe("timeline-phase79");
    expect(Array.isArray(parsed.laneBlocks)).toBe(true);
  });

  test("composition source keeps strict boundary imports and forbidden calls out", async () => {
    const compositionSource = await fs.readFile(
      path.resolve(
        process.cwd(),
        "backend/renderer/compositions/freeMixerComposition.ts",
      ),
      "utf8",
    );
    const propsSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/compositions/compositionProps.ts"),
      "utf8",
    );

    const source = `${compositionSource}\n${propsSource}`;

    expect(source.includes("src/store")).toBe(false);
    expect(source.includes("src/services")).toBe(false);
    expect(source.includes("src/agents")).toBe(false);
    expect(source.includes("backend/routes")).toBe(false);
    expect(source.includes("backend/registry")).toBe(false);

    expect(source.includes("renderMedia(")).toBe(false);
    expect(source.includes("bundle(")).toBe(false);
    expect(source.includes("selectComposition(")).toBe(false);
    expect(source.includes("getCompositions(")).toBe(false);
    expect(source.includes("openBrowser(")).toBe(false);

    expect(source.includes("localStorage")).toBe(false);
    expect(source.includes("window.")).toBe(false);
    expect(source.includes("document.")).toBe(false);

    expect(source.includes("downloadUrl")).toBe(false);
    expect(source.includes("signedUrl")).toBe(false);
    expect(source.includes("publicUrl")).toBe(false);
    expect(source.includes("artifacts")).toBe(false);
  });

  test("no route auto-execution wiring and no frontend src file coupling", async () => {
    const routeSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/routes/exports.ts"),
      "utf8",
    );
    expect(routeSource.includes("executeSingleProcessRender")).toBe(false);

    const compositionSource = await fs.readFile(
      path.resolve(
        process.cwd(),
        "backend/renderer/compositions/freeMixerComposition.ts",
      ),
      "utf8",
    );
    const propsSource = await fs.readFile(
      path.resolve(process.cwd(), "backend/renderer/compositions/compositionProps.ts"),
      "utf8",
    );
    expect(compositionSource.includes("from \"../../../src/")).toBe(false);
    expect(compositionSource.includes("from '../../src/")).toBe(false);
    expect(propsSource.includes("from \"../../../src/")).toBe(false);
    expect(propsSource.includes("from '../../src/")).toBe(false);
  });
});
