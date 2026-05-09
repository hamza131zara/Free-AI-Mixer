import type { SceneRecord } from "./scene";

export type TimelineId = string;
export type TimelineClipId = string;
export type SceneId = SceneRecord["id"];

export type TimelinePlaybackStatus =
  | "idle"
  | "ready"
  | "playing"
  | "paused"
  | "ended";

export type TimelineInsertMode = "append" | "before" | "after" | "replace";

export type TimelineClipSource = "scene";

// Timeline clips are editorial references to generated scenes, never duplicated scene payload/result data.
export interface TimelineClip {
  id: TimelineClipId;
  sceneId: SceneId;
  source: TimelineClipSource;
  order: number;
  startMs: number;
  durationMs: number;
  label?: string;
}

export interface TimelineSelection {
  clipId?: TimelineClipId;
  sceneId?: SceneId;
}

// Playback state is preview/simulation metadata for the editor, not provider or backend telemetry.
export interface TimelinePlaybackState {
  status: TimelinePlaybackStatus;
  currentTimeMs: number;
  activeClipId?: TimelineClipId;
}

// Timeline is editorial metadata only. It is not export/render output.
// Video export/rendering and backend render queue orchestration are deferred to later phases.
export interface Timeline {
  id: TimelineId;
  name: string;
  clips: TimelineClip[];
  selection: TimelineSelection;
  playback: TimelinePlaybackState;
  totalDurationMs: number;
  createdAt: string;
  updatedAt: string;
}
