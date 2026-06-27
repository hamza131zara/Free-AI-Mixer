import { useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "../types/projectLibrary";
import { useNavigationStore } from "../store/navigationStore";
import { useProjectLibraryStore } from "../store/projectLibraryStore";

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
  const deleteDialogRef = useRef<HTMLElement>(null);
  const projectListPanelRef = useRef<HTMLElement>(null);
  const deleteTriggerRefs = useRef(new Map<string, HTMLButtonElement>());
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

  useEffect(() => {
    const requested = readProjectIdFromUrl();
    void refreshProjectLibrary(
      requested.invalid ? undefined : requested.projectId,
      requested.invalid,
    );
  }, [refreshProjectLibrary]);

  useEffect(() => {
    const reconcile = () => {
      if (
        reconciliationPending.current ||
        document.visibilityState === "hidden" ||
        useProjectLibraryStore.getState().pendingAction !== null
      ) {
        return;
      }

      reconciliationPending.current = true;
      const requested = readProjectIdFromUrl();
      void refreshProjectLibrary(
        requested.invalid ? undefined : requested.projectId,
        requested.invalid,
      )
        .then(() => {
          const state = useProjectLibraryStore.getState();
          const listResolved =
            state.accessStatus === "authenticated" &&
            (state.operationStatus === "idle" || state.operationStatus === "empty");

          if (!listResolved) {
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
        })
        .catch(() => undefined)
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
  }, [refreshProjectLibrary]);

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
    setDeleteTarget(undefined);

    if (accessStatus === "authenticated") {
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
                      void deleteProject(projectId).then((deleted) => {
                        if (!deleted) {
                          return;
                        }

                        const requested = readProjectIdFromUrl();
                        if (requested.projectId === projectId) {
                          updateProjectsProjectIdUrl();
                        }
                        closeDeleteDialog(projectId);
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
