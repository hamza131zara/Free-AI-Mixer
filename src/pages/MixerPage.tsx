import { useEffect, useMemo, useState } from "react";
import { SceneComposer } from "../components/SceneComposer";
import { SceneQueue } from "../components/SceneQueue";
import { SceneStatus } from "../components/SceneStatus";
import { PromptImageGenerator } from "../components/PromptImageGenerator";
import { PromptImageHistory } from "../components/PromptImageHistory";
import { PromptVideoGenerator } from "../components/PromptVideoGenerator";
import { TimelinePanel } from "../components/TimelinePanel";
import { platformGenerationPolicyCopy } from "../services/providerCapabilityPolicyService";
import { useProjectLibraryStore } from "../store/projectLibraryStore";

const safeProjectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function MixerPage() {
  const [projectContextStatus, setProjectContextStatus] = useState<
    "none" | "invalid" | "loading" | "ready" | "unavailable"
  >("none");
  const [projectContextMessage, setProjectContextMessage] = useState(
    "Select a saved project before running hosted mock image generation.",
  );
  const activeProject = useProjectLibraryStore((state) => state.activeProject);
  const operationStatus = useProjectLibraryStore((state) => state.operationStatus);
  const accessMessage = useProjectLibraryStore((state) => state.accessMessage);
  const refreshProjectLibrary = useProjectLibraryStore(
    (state) => state.refreshProjectLibrary,
  );
  const clearRuntimeProjectContext = useProjectLibraryStore(
    (state) => state.clearRuntimeProjectContext,
  );
  const projectId = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return new URLSearchParams(window.location.search).get("projectId") ?? undefined;
  }, []);

  useEffect(() => {
    if (projectId && !safeProjectIdPattern.test(projectId)) {
      clearRuntimeProjectContext();
      setProjectContextStatus("invalid");
      setProjectContextMessage(
        "The Mixer project link is invalid. Return to Projects and select a saved project.",
      );
      return;
    }

    setProjectContextStatus("loading");
    setProjectContextMessage("Loading verified project context for Mixer.");

    void refreshProjectLibrary(projectId).then(() => {
      const loadedProject = useProjectLibraryStore.getState().activeProject;

      if (loadedProject && (!projectId || loadedProject.projectId === projectId)) {
        if (!projectId && typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("projectId", loadedProject.projectId);
          window.history.replaceState({}, "", `${url.pathname}${url.search}`);
        }
        setProjectContextStatus("ready");
        setProjectContextMessage(`Verified project context: ${loadedProject.title}`);
        return;
      }

      if (!projectId) {
        setProjectContextStatus("none");
        setProjectContextMessage(
          "Select a saved project before running hosted mock image generation.",
        );
        return;
      }

      setProjectContextStatus("unavailable");
      setProjectContextMessage(
        useProjectLibraryStore.getState().accessMessage ||
          "The selected project could not be verified for Mixer.",
      );
    });
  }, [clearRuntimeProjectContext, projectId, refreshProjectLibrary]);

  const verifiedActiveProject =
    projectContextStatus === "ready" ? activeProject : undefined;

  return (
    <main className="app-shell" data-testid="mixer-page">
      <section className="workspace">
        <div className="workspace-header">
          <div>
            <p className="eyebrow">AI Scene Generation</p>
            <h1>Free AI Mixer</h1>
          </div>
        </div>
        <SceneStatus />
        <div className="workspace-grid">
          <div className="workspace-stack">
            <SceneComposer />
            <section
              className="generation-workbench"
              aria-labelledby="generation-workbench-title"
            >
              <div className="generation-workbench-header">
                <div>
                  <p className="eyebrow">Mock generation lab</p>
                  <h2 id="generation-workbench-title">Prompt generation workspace</h2>
                  <p>
                    Generate backend-verified image metadata, review local history,
                    and inspect the video boundary without previews, downloads, or
                    provider calls.
                  </p>
                </div>
                <span className="status-pill status-idle">Metadata only</span>
              </div>
              <div
                className="generation-policy-banner"
                data-testid="generation-policy-banner"
              >
                <p>{platformGenerationPolicyCopy.freeWorkspaceCopy}</p>
                <p>{platformGenerationPolicyCopy.byokQuotaCopy}</p>
                <p>{platformGenerationPolicyCopy.providerBillingCopy}</p>
                <p>{platformGenerationPolicyCopy.paidPlatformCopy}</p>
              </div>
              <div
                className="generation-policy-banner"
                data-testid="mixer-project-context"
                role="status"
                aria-live="polite"
              >
                <p>{projectContextMessage}</p>
                {projectContextStatus === "loading" ||
                operationStatus === "opening" ? (
                  <p>Project validation is in progress.</p>
                ) : null}
                {projectContextStatus === "unavailable" ? (
                  <p>{accessMessage}</p>
                ) : null}
              </div>
              <div className="generation-workbench-grid">
                <PromptImageGenerator project={verifiedActiveProject} />
                <PromptVideoGenerator />
              </div>
              <PromptImageHistory project={verifiedActiveProject} />
            </section>
          </div>
          <SceneQueue />
        </div>
      </section>
      <TimelinePanel />
    </main>
  );
}
