import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ProjectSummary } from "../types/projectLibrary";
import { useNavigationStore } from "../store/navigationStore";
import { useProjectLibraryStore } from "../store/projectLibraryStore";
import { useAuthStore } from "../store/authStore";
import { BackendRequestAbortedError } from "../services/backendRequestPolicy";

const safeProjectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readProjectIdFromUrl = (): { invalid: boolean; projectId?: string } => {
  if (typeof window === "undefined") {
    return { invalid: false };
  }

  const projectId = new URLSearchParams(window.location.search).get("projectId");

  return !projectId
    ? { invalid: false }
    : safeProjectIdPattern.test(projectId)
      ? { invalid: false, projectId }
      : { invalid: true };
};

const updateProjectsProjectIdUrl = (projectId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (projectId) {
    url.searchParams.set("projectId", projectId);
  } else {
    url.searchParams.delete("projectId");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
};

export function ProjectsPage() {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | undefined>();
  const reconciliationPending = useRef(false);
  const reconciliationTrailing = useRef(false);
  const deleteDialogRef = useRef<HTMLElement>(null);
  const projectListPanelRef = useRef<HTMLElement>(null);
  const deleteTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const confirmedDeletionFocusRef = useRef<{
    deletedProjectId: string;
    targetProjectId?: string;
  } | null>(null);
  const confirmedDeletionFocusHandledRef = useRef<string | null>(null);
  const accessStatus = useProjectLibraryStore((state) => state.accessStatus);
  const accessMessage = useProjectLibraryStore((state) => state.accessMessage);
  const projects = useProjectLibraryStore((state) => state.projects);
  const canDeleteProjects = useProjectLibraryStore(
    (state) => state.capabilities.canDeleteProjects,
  );
  const activeProject = useProjectLibraryStore((state) => state.activeProject);
  const operationStatus = useProjectLibraryStore((state) => state.operationStatus);
  const pendingAction = useProjectLibraryStore((state) => state.pendingAction);
  const pendingProjectId = useProjectLibraryStore((state) => state.pendingProjectId);
  const createProject = useProjectLibraryStore((state) => state.createProject);
  const deleteProject = useProjectLibraryStore((state) => state.deleteProject);
  const selectActiveProject = useProjectLibraryStore(
    (state) => state.selectActiveProject,
  );
  const renameProject = useProjectLibraryStore((state) => state.renameProject);
  const refreshProjectLibrary = useProjectLibraryStore(
    (state) => state.refreshProjectLibrary,
  );
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const syncWithLocation = useNavigationStore((state) => state.syncWithLocation);
  const beginProjectRestoration = useAuthStore(
    (state) => state.beginProjectRestoration,
  );
  const completeProjectRestoration = useAuthStore(
    (state) => state.completeProjectRestoration,
  );
  const failProjectRestoration = useAuthStore(
    (state) => state.failProjectRestoration,
  );

  const publishProjectRestorationOutcome = useCallback((): void => {
    const state = useProjectLibraryStore.getState();
    if (state.accessStatus === "authenticated") {
      completeProjectRestoration();
      return;
    }

    failProjectRestoration(
      state.accessStatus === "unauthenticated"
        ? "sign_in_required"
        : state.accessStatus === "forbidden"
          ? "workspace_forbidden"
          : "temporarily_unavailable",
    );
  }, [completeProjectRestoration, failProjectRestoration]);

  useEffect(() => {
    let disposed = false;

    const reconcile = () => {
      if (disposed) {
        return;
      }

      if (document.visibilityState === "hidden") {
        return;
      }

      if (reconciliationPending.current) {
        reconciliationTrailing.current = true;
        return;
      }

      const pendingAction = useProjectLibraryStore.getState().pendingAction;
      if (pendingAction !== null && pendingAction !== "refresh") {
        return;
      }

      reconciliationPending.current = true;
      beginProjectRestoration();
      const requested = readProjectIdFromUrl();
      void refreshProjectLibrary(
        requested.invalid ? undefined : requested.projectId,
        requested.invalid,
      )
        .then(() => {
          if (disposed) {
            return;
          }

          const state = useProjectLibraryStore.getState();
          const listResolved =
            state.accessStatus === "authenticated" &&
            (state.operationStatus === "idle" || state.operationStatus === "empty");

          if (!listResolved) {
            publishProjectRestorationOutcome();
            return;
          }

          const currentUrl = readProjectIdFromUrl();

          if (
            currentUrl.invalid ||
            (currentUrl.projectId &&
              !state.projects.some(
                (project) => project.projectId === currentUrl.projectId,
              ))
          ) {
            updateProjectsProjectIdUrl();
          }
          publishProjectRestorationOutcome();
        })
        .catch((error: unknown) => {
          if (disposed || error instanceof BackendRequestAbortedError) {
            return;
          }

          failProjectRestoration("temporarily_unavailable");
        })
        .finally(() => {
          if (disposed) {
            return;
          }

          reconciliationPending.current = false;
          if (reconciliationTrailing.current) {
            reconciliationTrailing.current = false;
            queueMicrotask(() => {
              if (!disposed) {
                reconcile();
              }
            });
          }
        });
    };

    reconcile();
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", reconcile);

    return () => {
      disposed = true;
      reconciliationPending.current = false;
      reconciliationTrailing.current = false;
      window.removeEventListener("focus", reconcile);
      document.removeEventListener("visibilitychange", reconcile);
    };
  }, [
    beginProjectRestoration,
    failProjectRestoration,
    publishProjectRestorationOutcome,
    refreshProjectLibrary,
  ]);

  useEffect(() => {
    if (
      accessStatus !== "authenticated" ||
      pendingAction !== null ||
      (operationStatus !== "idle" && operationStatus !== "empty")
    ) {
      return;
    }

    const requested = readProjectIdFromUrl();

    if (requested.invalid) {
      updateProjectsProjectIdUrl();
      return;
    }

    if (requested.projectId && activeProject?.projectId !== requested.projectId) {
      updateProjectsProjectIdUrl();
      return;
    }

    if (!requested.projectId && activeProject) {
      updateProjectsProjectIdUrl(activeProject.projectId);
    }
  }, [accessStatus, activeProject, operationStatus, pendingAction]);

  useEffect(() => {
    if (activeProject) {
      setRenameTitle(activeProject.title);
    }
  }, [activeProject]);

  useEffect(() => {
    if (deleteTarget) {
      deleteDialogRef.current?.focus();
    }
  }, [deleteTarget]);

  const returnFocusAfterDeleteDialog = (projectId: string): void => {
    window.requestAnimationFrame(() => {
      const trigger = deleteTriggerRefs.current.get(projectId);

      if (trigger?.isConnected) {
        trigger.focus();
        return;
      }

      for (const candidate of deleteTriggerRefs.current.values()) {
        if (candidate.isConnected) {
          candidate.focus();
          return;
        }
      }

      projectListPanelRef.current?.focus();
    });
  };

  const closeDeleteDialog = (projectId: string): void => {
    setDeleteTarget(undefined);
    returnFocusAfterDeleteDialog(projectId);
  };

  useLayoutEffect(() => {
    const pendingFocus = confirmedDeletionFocusRef.current;

    if (
      !pendingFocus ||
      projects.some(
        (project) => project.projectId === pendingFocus.deletedProjectId,
      )
    ) {
      return;
    }

    confirmedDeletionFocusRef.current = null;
    confirmedDeletionFocusHandledRef.current = pendingFocus.deletedProjectId;
    const target = pendingFocus.targetProjectId
      ? deleteTriggerRefs.current.get(pendingFocus.targetProjectId)
      : undefined;

    if (target?.isConnected) {
      target.focus();
      return;
    }

    projectListPanelRef.current?.focus();
  }, [projects]);

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }

    const targetStillAvailable = projects.some(
      (project) => project.projectId === deleteTarget.projectId,
    );
    const authenticatedDeleteStillAllowed =
      accessStatus === "authenticated" && canDeleteProjects;

    if (authenticatedDeleteStillAllowed && targetStillAvailable) {
      return;
    }

    const projectId = deleteTarget.projectId;
    const confirmedDeletionPending =
      confirmedDeletionFocusRef.current?.deletedProjectId === projectId ||
      confirmedDeletionFocusHandledRef.current === projectId;
    if (confirmedDeletionFocusHandledRef.current === projectId) {
      confirmedDeletionFocusHandledRef.current = null;
    }
    setDeleteTarget(undefined);

    if (accessStatus === "authenticated" && !confirmedDeletionPending) {
      returnFocusAfterDeleteDialog(projectId);
    }
  }, [accessStatus, canDeleteProjects, deleteTarget, projects]);

  const deleteConfirmationOpen = Boolean(deleteTarget);

  return (
    <section className="projects-page" data-testid="projects-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 4</p>
          <h1>Project library boundary</h1>
          <p className="placeholder-description">
            This route shows backend-owned project metadata and a durable active-project
            preference for the verified workspace session.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => void refreshProjectLibrary()}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh project library"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                navigateTo(accessStatus === "authenticated" ? "/dashboard" : "/login")
              }
            >
              {accessStatus === "authenticated" ? "Back to dashboard" : "Go to login"}
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="projects-access-state">
          <span className="status-kicker">Access status</span>
          <strong>{accessStatus}</strong>
          <p>{accessMessage}</p>
          {accessStatus === "authenticated" ? (
            <p>
  Workspace access:{" "}
  <strong>
    {accessStatus === "authenticated" ? "Verified" : "Unavailable"}
  </strong>
</p>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Saved projects</p>
          <h2>Durable project metadata</h2>
        </div>
        {accessStatus === "authenticated" ? (
          <div className="placeholder-grid">
            <article className="info-card" data-testid="project-create-panel">
              <h3>Create project metadata</h3>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (deleteConfirmationOpen) {
                    return;
                  }
                  void createProject(newProjectTitle).then(() => {
                    setNewProjectTitle("");
                    const confirmed = useProjectLibraryStore.getState().activeProject;

                    if (confirmed) {
                      updateProjectsProjectIdUrl(confirmed.projectId);
                    }
                  });
                }}
              >
                <label htmlFor="new-project-title">Project title</label>
                <input
                  id="new-project-title"
                  name="projectTitle"
                  value={newProjectTitle}
                  disabled={deleteConfirmationOpen}
                  onChange={(event) => setNewProjectTitle(event.target.value)}
                  placeholder="Private beta project"
                />
                <button
                  type="submit"
                  disabled={pendingAction === "create" || deleteConfirmationOpen}
                >
                  {pendingAction === "create" ? "Creating..." : "Create Project"}
                </button>
              </form>
            </article>

            <article
              className="info-card"
              data-testid="project-list-panel"
              ref={projectListPanelRef}
              tabIndex={-1}
            >
              <h3>Workspace projects</h3>
              {projects.length === 0 ? (
                <p data-testid="projects-empty-state">
                  No durable project metadata exists for this workspace yet.
                </p>
              ) : (
                <ul className="metadata-list">
                  {projects.map((project) => {
                    const isActive = activeProject?.projectId === project.projectId;
                    const isSelecting =
                      pendingAction === "open" && pendingProjectId === project.projectId;

                    return (
                      <li
                        key={project.projectId}
                        aria-current={isActive ? "true" : undefined}
                      >
                        <strong>{project.title}</strong>
                        <span>Status: {project.status}</span>
                        <span>Updated: {project.updatedAt}</span>
                        {isActive ? (
                          <span aria-label="Currently selected project">Selected</span>
                        ) : null}
                        <button
                          type="button"
                          className="secondary"
                          aria-pressed={isActive}
                          disabled={pendingAction === "open" || deleteConfirmationOpen}
                          onClick={() => {
                            if (deleteConfirmationOpen) {
                              return;
                            }
                            void selectActiveProject(project.projectId).then(() => {
                              const confirmed = useProjectLibraryStore.getState().activeProject;

                              if (confirmed?.projectId === project.projectId) {
                                updateProjectsProjectIdUrl(project.projectId);
                              }
                            });
                          }}
                        >
                          {isSelecting ? "Selecting..." : isActive ? "Selected" : "Select"}
                        </button>
                        {canDeleteProjects ? (
                          <button
                            type="button"
                            className="secondary"
                            disabled={
                              pendingAction === "delete" || deleteConfirmationOpen
                            }
                            ref={(node) => {
                              if (node) {
                                deleteTriggerRefs.current.set(project.projectId, node);
                              } else {
                                deleteTriggerRefs.current.delete(project.projectId);
                              }
                            }}
                            onClick={() => setDeleteTarget(project)}
                          >
                            Delete project
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>

            {deleteTarget ? (
              <section
                className="info-card"
                role="dialog"
                ref={deleteDialogRef}
                tabIndex={-1}
                aria-labelledby="delete-project-title"
                aria-describedby="delete-project-warning"
                data-testid="project-delete-confirmation"
                onKeyDown={(event) => {
                  if (event.key === "Escape" && pendingAction !== "delete") {
                    event.preventDefault();
                    closeDeleteDialog(deleteTarget.projectId);
                  }
                }}
              >
                <h3 id="delete-project-title">Delete {deleteTarget.title}?</h3>
                <p id="delete-project-warning">
                  This removes the project from active workspace views. Existing
                  generation, history, and artifact records remain preserved.
                </p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={pendingAction === "delete"}
                    onClick={() => closeDeleteDialog(deleteTarget.projectId)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pendingAction === "delete"}
                    onClick={() => {
                      const projectId = deleteTarget.projectId;
                      const deletedIndex = projects.findIndex(
                        (project) => project.projectId === projectId,
                      );
                      const nearestSurvivor =
                        deletedIndex >= 0
                          ? projects[deletedIndex + 1] ??
                            projects[deletedIndex - 1]
                          : undefined;
                      confirmedDeletionFocusRef.current = {
                        deletedProjectId: projectId,
                        targetProjectId: nearestSurvivor?.projectId,
                      };
                      void deleteProject(projectId).then((deleted) => {
                        if (!deleted) {
                          confirmedDeletionFocusRef.current = null;
                          confirmedDeletionFocusHandledRef.current = null;
                          return;
                        }

                        const requested = readProjectIdFromUrl();
                        if (requested.projectId === projectId) {
                          updateProjectsProjectIdUrl();
                        }
                      });
                    }}
                  >
                    {pendingAction === "delete" ? "Deleting..." : "Confirm delete project"}
                  </button>
                </div>
              </section>
            ) : null}

            <article className="info-card" data-testid="project-selected-panel">
              <h3>Selected project</h3>
              {activeProject ? (
                <>
                  <p
                    className="status-note"
                    data-testid="project-selection-confirmation"
                    role="status"
                    aria-live="polite"
                  >
                    Selected project: {activeProject.title}
                  </p>
                  <dl className="metadata-list">
                    <div><dt>Project ID</dt><dd>{activeProject.projectId}</dd></div>
                    <div><dt>Title</dt><dd>{activeProject.title}</dd></div>
                    <div><dt>Status</dt><dd>{activeProject.status}</dd></div>
                    <div><dt>Created</dt><dd>{activeProject.createdAt}</dd></div>
                    <div><dt>Updated</dt><dd>{activeProject.updatedAt}</dd></div>
                  </dl>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (deleteConfirmationOpen) {
                        return;
                      }
                      void renameProject(activeProject.projectId, renameTitle);
                    }}
                  >
                    <label htmlFor="rename-project-title">Rename project</label>
                    <input
                      id="rename-project-title"
                      name="renameProjectTitle"
                      value={renameTitle}
                      disabled={deleteConfirmationOpen}
                      onChange={(event) => setRenameTitle(event.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={pendingAction === "rename" || deleteConfirmationOpen}
                    >
                      {pendingAction === "rename" ? "Renaming..." : "Rename Project"}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      window.history.pushState(
                        {},
                        "",
                        `/mixer?projectId=${encodeURIComponent(activeProject.projectId)}`,
                      );
                      syncWithLocation("/mixer");
                    }}
                  >
                    Use in Mixer
                  </button>
                </>
              ) : (
                <p>Select a project to inspect its persisted metadata.</p>
              )}
            </article>
          </div>
        ) : accessStatus === "forbidden" ? (
          <article className="info-card" data-testid="projects-forbidden-state">
            <h3>Workspace access is required</h3>
          </article>
        ) : (
          <article className="info-card" data-testid="projects-protected-state">
            <h3>Verified project data is not available yet</h3>
          </article>
        )}
        {operationStatus === "validation_error" ? (
          <p className="status-note" data-testid="project-validation-state">{accessMessage}</p>
        ) : null}
        {operationStatus === "not_found" ? (
          <p className="status-note" data-testid="project-not-found-state">{accessMessage}</p>
        ) : null}
      </div>
    </section>
  );
}
