import {
  selectActivePlaybackClip,
  selectActiveTimelinePlayback,
  selectIsPlaybackInteractive,
  selectPlaybackCanPause,
  selectPlaybackCanPlay,
  selectPlaybackCanStep,
  selectPlaybackProgress,
  selectTimelineTotalDurationMs,
  useTimelineStore,
} from "../store/timelineStore";
import type { TimelineId } from "../types/timeline";

interface TimelinePlaybackControlsProps {
  timelineId?: TimelineId;
}

export function TimelinePlaybackControls({ timelineId }: TimelinePlaybackControlsProps) {
  const playback = useTimelineStore(selectActiveTimelinePlayback);
  const activeClip = useTimelineStore(selectActivePlaybackClip);
  const totalDurationMs = useTimelineStore(selectTimelineTotalDurationMs);
  const isInteractive = useTimelineStore(selectIsPlaybackInteractive);
  const canPlay = useTimelineStore(selectPlaybackCanPlay);
  const canPause = useTimelineStore(selectPlaybackCanPause);
  const canStep = useTimelineStore(selectPlaybackCanStep);
  const progress = useTimelineStore(selectPlaybackProgress);
  const playTimeline = useTimelineStore((state) => state.playTimeline);
  const pauseTimeline = useTimelineStore((state) => state.pauseTimeline);
  const stopTimeline = useTimelineStore((state) => state.stopTimeline);
  const stepTimeline = useTimelineStore((state) => state.stepTimeline);
  const seekTimeline = useTimelineStore((state) => state.seekTimeline);

  if (!timelineId) {
    return null;
  }

  const currentMs = playback.currentTimeMs;
  const progressPercent = Math.round(progress * 100);

  return (
    <section className="scene-status" data-testid="timeline-playback-controls">
      <div>
        <p className="scene-stage-note">Preview simulation only (no real media playback).</p>
        <div className="status-metrics">
          <span>Status {playback.status}</span>
          <span>Time {currentMs}ms</span>
          <span>Progress {progressPercent}%</span>
          <span>Active Clip {activeClip?.sceneId ?? "None"}</span>
        </div>
      </div>
      <div className="scene-card-actions">
        <button
          type="button"
          onClick={() => playTimeline(timelineId)}
          disabled={!canPlay}
        >
          Play
        </button>
        <button
          type="button"
          onClick={() => pauseTimeline(timelineId)}
          disabled={!canPause}
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => stopTimeline(timelineId)}
          disabled={!isInteractive}
        >
          Stop
        </button>
        <button
          type="button"
          onClick={() => stepTimeline(timelineId, -1000)}
          disabled={!canStep}
        >
          Step back 1s
        </button>
        <button
          type="button"
          onClick={() => stepTimeline(timelineId, 1000)}
          disabled={!canStep}
        >
          Step forward 1s
        </button>
      </div>
      <label className="field field-wide">
        <span>Seek (ms)</span>
        <input
          type="range"
          min={0}
          max={Math.max(totalDurationMs, 0)}
          step={100}
          value={Math.min(Math.max(currentMs, 0), Math.max(totalDurationMs, 0))}
          onChange={(event) => seekTimeline(timelineId, Number(event.target.value))}
          disabled={!isInteractive}
          aria-label="Seek timeline"
        />
      </label>
      {!isInteractive ? (
        <p className="scene-stage-note">Add clips to enable manual preview controls.</p>
      ) : null}
    </section>
  );
}
