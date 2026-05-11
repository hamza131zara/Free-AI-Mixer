import type { FreeMixerCompositionProps } from "./compositionProps";
import {
  FREE_MIXER_COMPOSITION_ID,
  toFreeMixerCompositionProps,
} from "./compositionProps";
import type { RenderInputSnapshot } from "../../contracts/renderInputSnapshot";

export interface FreeMixerLaneBlock {
  clipId: string;
  sceneRefId: string;
  label: string;
  x: number;
  width: number;
  y: number;
  height: number;
}

export interface FreeMixerCompositionModel {
  compositionId: string;
  timelineId: string;
  size: { width: number; height: number };
  fps: number;
  totalDurationMs: number;
  laneBlocks: FreeMixerLaneBlock[];
}

const clamp = (value: number, min: number): number => (value < min ? min : value);

export const renderFreeMixerCompositionModel = (
  props: FreeMixerCompositionProps,
): FreeMixerCompositionModel => {
  const total = Math.max(props.totalDurationMs, 1);
  const trackX = 80;
  const trackWidth = Math.max(props.width - 160, 1);
  const laneY = 200;
  const laneHeight = 220;

  const laneBlocks: FreeMixerLaneBlock[] = props.clips.map((clip) => {
    const startRatio = clip.startMs / total;
    const durationRatio = clip.durationMs / total;
    const x = Math.round(trackX + trackWidth * startRatio);
    const width = Math.round(trackWidth * durationRatio);

    return {
      clipId: clip.clipId,
      sceneRefId: clip.sceneRefId,
      label: clip.label,
      x,
      width: clamp(width, 8),
      y: laneY,
      height: laneHeight,
    };
  });

  return {
    compositionId: FREE_MIXER_COMPOSITION_ID,
    timelineId: props.timelineId,
    size: { width: props.width, height: props.height },
    fps: props.fps,
    totalDurationMs: props.totalDurationMs,
    laneBlocks,
  };
};

export const createFreeMixerCompositionModelFromSnapshot = (
  snapshot: RenderInputSnapshot,
): FreeMixerCompositionModel =>
  renderFreeMixerCompositionModel(toFreeMixerCompositionProps(snapshot));

