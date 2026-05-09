import { useShallow } from "zustand/react/shallow";
import {
  selectActiveTimeline,
  selectActiveTimelineClips,
  selectActiveTimelineSelection,
  selectTimelineTotalDurationMs,
  useTimelineStore,
} from "../store/timelineStore";
import { TimelineHeader } from "./TimelineHeader";
import { TimelinePlaybackControls } from "./TimelinePlaybackControls";
import { TimelineSceneSource } from "./TimelineSceneSource";
import { TimelineTrack } from "./TimelineTrack";

export function TimelinePanel() {
  const hasHydrated = useTimelineStore((state) => state.hasHydrated);
  const hydrationError = useTimelineStore((state) => state.hydrationError);
  const timelines = useTimelineStore((state) => state.timelines);
  const activeTimelineId = useTimelineStore((state) => state.activeTimelineId);
  const activeTimeline = useTimelineStore(selectActiveTimeline);
  const clips = useTimelineStore(useShallow(selectActiveTimelineClips));
  const selection = useTimelineStore(selectActiveTimelineSelection);
  const totalDurationMs = useTimelineStore(selectTimelineTotalDurationMs);
  const createTimeline = useTimelineStore((state) => state.createTimeline);
  const setActiveTimeline = useTimelineStore((state) => state.setActiveTimeline);
  const renameTimeline = useTimelineStore((state) => state.renameTimeline);
  const removeTimeline = useTimelineStore((state) => state.removeTimeline);
  const selectClip = useTimelineStore((state) => state.selectClip);
  const removeClip = useTimelineStore((state) => state.removeClip);

  if (!hasHydrated) {
    return (
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2>Loading timeline...</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Editorial Timeline</h2>
          <p className="scene-stage-note">
            Build an editorial timeline from successful scenes. Manual preview
            only; no video export yet.
          </p>
        </div>
      </div>
      {hydrationError ? <p className="error-message">{hydrationError}</p> : null}
      <TimelineHeader
        timelines={timelines}
        activeTimelineId={activeTimelineId}
        onCreateTimeline={createTimeline}
        onSetActiveTimeline={setActiveTimeline}
        onRenameTimeline={renameTimeline}
        onRemoveTimeline={removeTimeline}
      />
      <TimelinePlaybackControls timelineId={activeTimeline?.id} />
      <TimelineSceneSource activeTimelineId={activeTimeline?.id} />
      <TimelineTrack
        timelineId={activeTimeline?.id}
        totalDurationMs={totalDurationMs}
        selectedClipId={selection.clipId}
        clips={clips}
        onSelectClip={selectClip}
        onRemoveClip={removeClip}
      />
    </section>
  );
}
