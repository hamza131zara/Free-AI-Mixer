import { useMemo } from "react";
import {
  selectExportCanSubmit,
  selectEffectiveExportLifecycleByTimelineId,
  selectEffectiveExportResumeStateByTimelineId,
  selectExportFailure,
  selectExportIsInFlight,
  selectExportResultArtifacts,
  useExportStore,
} from "../store/exportStore";
import type { ExportArtifactRef } from "../types/exportJob";
import type { TimelineId } from "../types/timeline";

const emptyArtifacts: ExportArtifactRef[] = [];

interface TimelineExportPanelProps {
  timelineId?: TimelineId;
  clipCount: number;
}

export function TimelineExportPanel({ timelineId, clipCount }: TimelineExportPanelProps) {
  const hasHydrated = useExportStore((state) => state.hasHydrated);
  const hydrationError = useExportStore((state) => state.hydrationError);
  const activeExportTimelineId = useExportStore(
    (state) => state.activeExportTimelineId,
  );
  const requestExport = useExportStore((state) => state.requestExport);
  const resumeExport = useExportStore((state) => state.resumeExport);
  const clearExportState = useExportStore((state) => state.clearExportState);
  const hasExportStateForTimeline = useExportStore((state) =>
    timelineId ? !!state.jobsByTimelineId[timelineId] : false,
  );
  const resolvedTimelineId =
    timelineId && hasExportStateForTimeline
      ? timelineId
      : (activeExportTimelineId ?? timelineId);

  const lifecycle = useExportStore((state) =>
    resolvedTimelineId
      ? selectEffectiveExportLifecycleByTimelineId(state, resolvedTimelineId)
      : undefined,
  );
  const resumeState = useExportStore((state) =>
    resolvedTimelineId
      ? selectEffectiveExportResumeStateByTimelineId(state, resolvedTimelineId)
      : "none",
  );
  const isInFlight = useExportStore((state) =>
    resolvedTimelineId ? selectExportIsInFlight(state, resolvedTimelineId) : false,
  );
  const canSubmitBySelector = useExportStore((state) =>
    resolvedTimelineId ? selectExportCanSubmit(state, resolvedTimelineId) : false,
  );
  const failure = useExportStore((state) =>
    resolvedTimelineId ? selectExportFailure(state, resolvedTimelineId) : undefined,
  );
  const artifacts = useExportStore((state) =>
    resolvedTimelineId
      ? selectExportResultArtifacts(state, resolvedTimelineId)
      : emptyArtifacts,
  );
  const isSubmitting = useExportStore((state) =>
    resolvedTimelineId ? !!state.isSubmittingByTimelineId[resolvedTimelineId] : false,
  );
  const isResolving = useExportStore((state) =>
    resolvedTimelineId ? !!state.isResolvingByTimelineId[resolvedTimelineId] : false,
  );

  const statusMessage = useMemo(() => {
    if (!timelineId) {
      return "Create and select a timeline to request export.";
    }

    if (resumeState === "resume_needed") {
      return "Resumable export job found. Resume is not started yet.";
    }

    if (resumeState === "resume_unavailable") {
      return "Resume unavailable. Request export again.";
    }

    if (resumeState === "expired") {
      return "Export expired or timed out.";
    }

    switch (lifecycle) {
      case "queued":
      case "submitted":
      case "rendering":
      case "finalizing":
        return "Export requested / in progress.";
      case "success":
        return "Export completed.";
      case "error":
        return "Export failed.";
      case "canceled":
        return "Export canceled.";
      case "expired":
        return "Export expired or timed out.";
      default:
        return "No export requested yet.";
    }
  }, [lifecycle, resumeState, timelineId]);

  const canRequestExport =
    !!timelineId && clipCount > 0 && hasHydrated && !hydrationError && canSubmitBySelector && !isInFlight;
  const showResumeButton = !!timelineId && resumeState === "resume_needed";
  const canResumeExport =
    !!timelineId &&
    showResumeButton &&
    !isSubmitting &&
    !isResolving &&
    !terminalLifecycle(lifecycle);

  return (
    <section className="scene-status" data-testid="timeline-export-panel">
      <div>
        <p className="scene-stage-note">
          Backend-dependent export request/status only. No backend rendering queue is built yet.
        </p>
        <div className="status-metrics">
          <span>Export Status {lifecycle ?? "idle"}</span>
          <span>{statusMessage}</span>
        </div>
      </div>

      <div className="scene-card-actions">
        {showResumeButton ? (
          <button
            type="button"
            onClick={() => {
              if (!timelineId) {
                return;
              }
              void resumeExport(timelineId);
            }}
            disabled={!canResumeExport}
          >
            Resume export
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (!timelineId) {
              return;
            }

            void requestExport(timelineId, {
              format: "mp4",
              resolution: "1080p",
              fps: 30,
              quality: "standard",
            });
          }}
          disabled={!canRequestExport}
        >
          Request export
        </button>
        <button
          type="button"
          onClick={() => {
            if (!timelineId) {
              return;
            }
            clearExportState(timelineId);
          }}
          disabled={!timelineId}
        >
          Clear export state
        </button>
      </div>

      {failure ? (
        <p className="error-message" data-testid="timeline-export-failure">
          {failure.code ? `${failure.code}: ` : ""}
          {failure.message}
        </p>
      ) : null}

      {artifacts.length > 0 ? (
        <div data-testid="timeline-export-artifacts">
          <p className="scene-stage-note">Artifact references</p>
          <ul>
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <span>{artifact.id} </span>
                {artifact.url ? (
                  <a href={artifact.url} target="_blank" rel="noreferrer">
                    Open artifact
                  </a>
                ) : (
                  <span>artifact reference available.</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const terminalLifecycle = (lifecycle: string | undefined): boolean =>
  lifecycle === "success" ||
  lifecycle === "error" ||
  lifecycle === "canceled" ||
  lifecycle === "expired";
