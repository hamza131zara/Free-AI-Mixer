import { Trash2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSceneStore } from "../store/sceneStore";
import {
  selectCanClearTerminalScenes,
  selectHydrationError,
  selectQueueSummary,
} from "../store/sceneSelectors";

export function SceneStatus() {
  const summary = useSceneStore(useShallow(selectQueueSummary));
  const hasProviderJobs = useSceneStore((state) =>
    state.scenes.some((scene) => scene.providerJob !== undefined),
  );
  const hasResumeAwareJobs = useSceneStore((state) =>
    state.scenes.some((scene) =>
      scene.providerJob?.resumeState === "resume_needed" ||
      scene.providerJob?.resumeState === "resume_in_progress" ||
      scene.providerJob?.label === "Provider job completed after reload" ||
      scene.providerJob?.label === "Provider job failed after reload",
    ),
  );
  const hydrationError = useSceneStore(selectHydrationError);
  const canClearTerminalScenes = useSceneStore(selectCanClearTerminalScenes);
  const clearTerminalScenes = useSceneStore((state) => state.clearTerminalScenes);

  return (
    <section className="scene-status" aria-live="polite">
      <div>
        <div className="status-metrics">
          <span>Total {summary.total}</span>
          <span>Active {summary.activeJobs}</span>
          <span>Queued Jobs {summary.queuedJobs}</span>
          <span>Idle {summary.idle}</span>
          <span>Queued {summary.queued}</span>
          <span>Generating {summary.generating}</span>
          <span>Success {summary.success}</span>
          <span>Error {summary.error}</span>
        </div>
        <p className="status-stage-note">
          Scene stages are app lifecycle milestones, not provider telemetry.
        </p>
        {hasProviderJobs ? (
          <p className="status-stage-note">
            Long-running provider jobs stay in generating while the app waits for
            terminal provider updates.
          </p>
        ) : null}
        {hasResumeAwareJobs ? (
          <p className="status-stage-note">
            Browser-local provider jobs can resume after refresh when durable
            provider job metadata is available.
          </p>
        ) : null}
        {hydrationError ? <p className="error-message">{hydrationError}</p> : null}
      </div>
      <button
        type="button"
        className="ghost"
        onClick={clearTerminalScenes}
        disabled={!canClearTerminalScenes}
      >
        <Trash2 aria-hidden="true" size={16} />
        Clear Finished
      </button>
    </section>
  );
}
