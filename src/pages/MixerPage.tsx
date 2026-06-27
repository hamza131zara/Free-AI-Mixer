import { useCallback, useEffect, useRef, useState } from "react";
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

const removeMixerProjectIdFromUrl = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("projectId");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
};

export function MixerPage() {
  const reconciliationPending = useRef(false);
  const [projectContextStatus, setProjectContextStatus] = useState<
    "none" | "invalid" | "loading" | "ready" | "unauthenticated" | "unavailable"
  >("none");
  const [projectContextMessage, setProjectContextMessage] = useState(
    "Select a saved project before running hosted mock image generation.",
  );
  const activeProject = useProjectLibraryStore((state) => state.activeProject);
  const operationStatus = useProjectLibraryStore((state) => state.operationStatus);
  const refreshProjectLibrary = useProjectLibraryStore(
    (state) => state.refreshProjectLibrary,
  );
  const clearRuntimeProjectContext = useProjectLibraryStore(
    (state) => state.clearRuntimeProjectContext,
  );
  const projectId = (() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    return new URLSearchParams(window.location.search).get("projectId") ?? undefined;
  })();

  const applyVerifiedProjectResolution = useCallback(
    (requestedProjectId?: string): void => {
      const state = useProjectLibraryStore.getState();
      const listResolved =
        state.accessStatus === "authenticated" &&
        (state.operationStatus === "idle" || state.operationStatus === "empty");

      if (listResolved) {
        const loadedProject = state.activeProject;

        if (
          loadedProject &&
          (!requestedProjectId || loadedProject.projectId === requestedProjectId)
        ) {
          if (!requestedProjectId && typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("projectId", loadedProject.projectId);
            window.history.replaceState({}, "", `${url.pathname}${url.search}`);
          }
          setProjectContextStatus("ready");
          setProjectContextMessage(
            `Verified project context: ${loadedProject.title}`,
          );
          return;
        }

        if (requestedProjectId) {
          removeMixerProjectIdFromUrl();
        }
        setProjectContextStatus("none");
        setProjectContextMessage(
          "Select a saved project before running hosted mock image generation.",
        );
        return;
      }

      if (state.accessStatus === "unauthenticated") {
        setProjectContextStatus("unauthenticated");
        setProjectContextMessage(
          state.accessMessage || "Sign in is required to restore project context.",
        );
        return;
      }

      if (
        state.accessStatus === "forbidden" ||
        state.accessStatus === "unavailable" ||
        state.operationStatus === "unavailable"
      ) {
        setProjectContextStatus("unavailable");
        setProjectContextMessage(
          state.accessMessage || "Verified project context is temporarily unavailable.",
        );
      }
    },
    [],
  );

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

    void refreshProjectLibrary(projectId)
      .then(() => applyVerifiedProjectResolution(projectId))
      .catch(() => {
        setProjectContextStatus("unavailable");
        setProjectContextMessage("Verified project context is temporarily unavailable.");
      });
  }, [
    applyVerifiedProjectResolution,
    clearRuntimeProjectContext,
    projectId,
    refreshProjectLibrary,
  ]);

  useEffect(() => {
    const reconcile = () => {
      if (
        reconciliationPending.current ||
        document.visibilityState === "hidden" ||
        useProjectLibraryStore.getState().pendingAction !== null ||
        (projectId !== undefined && !safeProjectIdPattern.test(projectId))
      ) {
        return;
      }

      reconciliationPending.current = true;
      void refreshProjectLibrary(projectId)
        .then(() => applyVerifiedProjectResolution(projectId))
        .catch(() => {
          setProjectContextStatus("unavailable");
          setProjectContextMessage("Verified project context is temporarily unavailable.");
        })
        .finally(() => {
          reconciliationPending.current = false;
        });
    };

    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    return () => {
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [applyVerifiedProjectResolution, projectId, refreshProjectLibrary]);

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
