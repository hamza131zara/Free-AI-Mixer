import type { RenderInputSnapshot } from "../../contracts/renderInputSnapshot";

export const FREE_MIXER_COMPOSITION_ID = "FreeMixerComposition";

export interface FreeMixerClipView {
  clipId: string;
  sceneRefId: string;
  startMs: number;
  durationMs: number;
  order: number;
  label: string;
}

export interface FreeMixerCompositionProps {
  jobId: string;
  timelineId: string;
  width: number;
  height: number;
  fps: number;
  totalDurationMs: number;
  clips: FreeMixerClipView[];
}

const toLabel = (clipId: string, sceneRefId: string): string =>
  `Clip ${clipId} | Scene ${sceneRefId}`;

export const toFreeMixerCompositionProps = (
  snapshot: RenderInputSnapshot,
): FreeMixerCompositionProps => {
  const clips = [...snapshot.timelineSnapshot.clips]
    .sort((a, b) => a.order - b.order)
    .map((clip) => ({
      clipId: clip.clipId,
      sceneRefId: clip.sceneRefId,
      startMs: clip.startMs,
      durationMs: clip.durationMs,
      order: clip.order,
      label: toLabel(clip.clipId, clip.sceneRefId),
    }));

  const totalDurationMs = clips.reduce(
    (max, clip) => Math.max(max, clip.startMs + clip.durationMs),
    0,
  );

  return {
    jobId: snapshot.jobId,
    timelineId: snapshot.timelineId,
    width: 1920,
    height: 1080,
    fps: snapshot.renderSettings.fps,
    totalDurationMs,
    clips,
  };
};
