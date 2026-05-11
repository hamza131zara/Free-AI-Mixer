import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import {
  FREE_MIXER_COMPOSITION_ID,
  type FreeMixerCompositionProps,
} from "./compositionProps";
import { renderFreeMixerCompositionModel } from "./freeMixerComposition";

const DEFAULT_PROPS: FreeMixerCompositionProps = {
  jobId: "remotion-entry-default-job",
  timelineId: "remotion-entry-default-timeline",
  width: 64,
  height: 64,
  fps: 6,
  totalDurationMs: 100,
  clips: [
    {
      clipId: "clip-default",
      sceneRefId: "scene-default",
      startMs: 0,
      durationMs: 100,
      order: 0,
      label: "Default Clip",
    },
  ],
};

const FreeMixerRenderComposition: React.FC<FreeMixerCompositionProps> = (props) => {
  const model = renderFreeMixerCompositionModel(props);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1020", color: "#E4E8F7" }}>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 18,
        }}
      >
        {model.timelineId}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const calculateDurationInFrames = (fps: number, totalDurationMs: number): number => {
  const safeFps = fps > 0 ? fps : 24;
  const frames = Math.ceil((totalDurationMs / 1000) * safeFps);
  return frames > 0 ? frames : 1;
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={FREE_MIXER_COMPOSITION_ID}
      component={FreeMixerRenderComposition}
      defaultProps={DEFAULT_PROPS}
      width={DEFAULT_PROPS.width}
      height={DEFAULT_PROPS.height}
      fps={DEFAULT_PROPS.fps}
      durationInFrames={calculateDurationInFrames(
        DEFAULT_PROPS.fps,
        DEFAULT_PROPS.totalDurationMs,
      )}
    />
  );
};

registerRoot(RemotionRoot);
