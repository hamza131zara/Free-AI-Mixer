import { useEffect, useState } from "react";
import { useNavigationStore } from "../store/navigationStore";
import { useProjectLibraryStore } from "../store/projectLibraryStore";

const safeProjectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readProjectIdFromUrl = (): { invalid: boolean; projectId?: string } => {
  if (typeof window === "undefined") {
    return { invalid: false };
  }

  const projectId = new URLSearchParams(window.location.search).get("projectId");

  if (!projectId) {
    return { invalid: false };
  }

  if (!safeProjectIdPattern.test(projectId)) {
    return { invalid: true };
  }

  return { invalid: false, projectId };
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

  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextPath);
};

export function ProjectsPage() {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [selectingProjectId, setSelectingProjectId] = useState<string | undefined>();
  const [restoreAttemptedProjectId, setRestoreAttemptedProjectId] = useState<
    string | undefined
  >();
  const [urlProjectSelection, setUrlProjectSelection] = useState(
    readProjectIdFromUrl,
  );
  const accessStatus = useProjectLibraryStore((state) => state.accessStatus);
  const accessMessage = useProjectLibraryStore((state) => state.accessMessage);
  const activeWorkspaceId = useProjectLibraryStore((state) => state.activeWorkspaceId);
  const projects = useProjectLibraryStore((state) => state.projects);
  const selectedProject = useProjectLibraryStore((state) => state.selectedProject);
  const operationStatus = useProjectLibraryStore((state) => state.operationStatus);
  const pendingAction = useProjectLibraryStore((state) => state.pendingAction);
  const createProject = useProjectLibraryStore((state) => state.createProject);
  const openProject = useProjectLibraryStore((state) => state.openProject);
  const renameProject = useProjectLibraryStore((state) => state.renameProject);
  const refreshProjectLibrary = useProjectLibraryStore(
    (state) => state.refreshProjectLibrary,
  );
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const syncWithLocation = useNavigationStore((state) => state.syncWithLocation);

  useEffect(() => {
    void refreshProjectLibrary();
  }, [refreshProjectLibrary]);

  useEffect(() => {
    const handleLocationChange = () => {
      setUrlProjectSelection(readProjectIdFromUrl());
      setRestoreAttemptedProjectId(undefined);
    };

    window.addEventListener("popstate", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (
      urlProjectSelection.invalid &&
      accessStatus === "authenticated" &&
      pendingAction !== "refresh" &&
      operationStatus !== "loading"
    ) {
      updateProjectsProjectIdUrl();
      setUrlProjectSelection({ invalid: false });
      setRestoreAttemptedProjectId(undefined);
    }
  }, [
    accessStatus,
    operationStatus,
    pendingAction,
    urlProjectSelection.invalid,
  ]);

  useEffect(() => {
    const urlProjectId = urlProjectSelection.projectId;

    if (
      accessStatus !== "authenticated" ||
      !urlProjectId ||
      pendingAction === "refresh" ||
      operationStatus === "loading"
    ) {
      return;
    }

    const projectExists = projects.some(
      (project) => project.projectId === urlProjectId,
    );

    if (!projectExists) {
      updateProjectsProjectIdUrl();
      setUrlProjectSelection({ invalid: false });
      setRestoreAttemptedProjectId(undefined);
      return;
    }

    if (
      selectedProject?.projectId === urlProjectId ||
      restoreAttemptedProjectId === urlProjectId ||
      pendingAction === "open" ||
      selectingProjectId !== undefined
    ) {
      return;
    }

    setRestoreAttemptedProjectId(urlProjectId);
    setSelectingProjectId(urlProjectId);
    void openProject(urlProjectId).finally(() => {
      setSelectingProjectId(undefined);
    });
  }, [
    accessStatus,
    openProject,
    operationStatus,
    pendingAction,
    projects,
    restoreAttemptedProjectId,
    selectedProject?.projectId,
    selectingProjectId,
    urlProjectSelection.projectId,
  ]);

  const visibleSelectedProject =
    selectedProject &&
    urlProjectSelection.projectId === selectedProject.projectId &&
    projects.some((project) => project.projectId === selectedProject.projectId)
      ? selectedProject
      : undefined;

  useEffect(() => {
    if (visibleSelectedProject) {
      setRenameTitle(visibleSelectedProject.title);
    }
  }, [visibleSelectedProject]);

  return (
    <section className="projects-page" data-testid="projects-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 4</p>
          <h1>Project library boundary</h1>
          <p className="placeholder-description">
            This route only shows backend-owned project library status. Browser-local
            timelines in the mixer remain editor convenience only and are not
            account-owned saved projects.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshProjectLibrary();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh project library"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo(accessStatus === "authenticated" ? "/dashboard" : "/login")}
            >
              {accessStatus === "authenticated" ? "Back to dashboard" : "Go to login"}
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="projects-access-state">
          <span className="status-kicker">Access status</span>
          <strong>{accessStatus}</strong>
          <p>{accessMessage}</p>
          {accessStatus === "unauthenticated" ? (
            <p>Sign in is required before account-owned saved projects can appear here.</p>
          ) : null}
          {accessStatus === "forbidden" ? (
            <p>Workspace access is required before this page can show backend-owned data.</p>
          ) : null}
          {accessStatus === "unavailable" ? (
            <p>
              {accessMessage.includes("Workspace authority")
                ? "Workspace authority is not configured on this backend yet."
                : "Authentication is not configured on this backend yet."}
            </p>
          ) : null}
          {accessStatus === "authenticated" ? (
            <p>
              Verified workspace:{" "}
              <strong>
                {activeWorkspaceId ? "Available" : "No workspace selected yet"}
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
              <p>
                Private beta projects persist only safe metadata: title, status,
                and timestamps. Timelines, generated media, uploads, and exports
                are not persisted from this panel.
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void createProject(newProjectTitle).then(() => {
                    setNewProjectTitle("");
                  });
                }}
              >
                <label htmlFor="new-project-title">Project title</label>
                <input
                  id="new-project-title"
                  name="projectTitle"
                  value={newProjectTitle}
                  onChange={(event) => setNewProjectTitle(event.target.value)}
                  placeholder="Private beta project"
                />
                <button
                  type="submit"
                  disabled={pendingAction === "create"}
                >
                  {pendingAction === "create" ? "Creating..." : "Create Project"}
                </button>
              </form>
            </article>

            <article className="info-card" data-testid="project-list-panel">
              <h3>Workspace projects</h3>
              {projects.length === 0 ? (
                <p data-testid="projects-empty-state">
                  No durable project metadata exists for this workspace yet.
                </p>
              ) : (
                <ul className="metadata-list">
                  {projects.map((project) => (
                    <li
                      key={project.projectId}
                      aria-current={
                        visibleSelectedProject?.projectId === project.projectId
                          ? "true"
                          : undefined
                      }
                    >
                      <strong>{project.title}</strong>
                      <span>Status: {project.status}</span>
                      <span>Updated: {project.updatedAt}</span>
                      {visibleSelectedProject?.projectId === project.projectId ? (
                        <span aria-label="Currently selected project">Selected</span>
                      ) : null}
                      <button
                        type="button"
                        className="secondary"
                        aria-pressed={visibleSelectedProject?.projectId === project.projectId}
                        disabled={
                          pendingAction === "open" ||
                          selectingProjectId === project.projectId
                        }
                        onClick={() => {
                          const projectId = project.projectId;

                          setRestoreAttemptedProjectId(undefined);
                          setSelectingProjectId(projectId);

                          void openProject(projectId)
                            .then(() => {
                              const verifiedProject =
                                useProjectLibraryStore.getState().selectedProject;

                              if (verifiedProject?.projectId !== projectId) {
                                return;
                              }

                              updateProjectsProjectIdUrl(projectId);
                              setUrlProjectSelection({
                                invalid: false,
                                projectId,
                              });
                              setRestoreAttemptedProjectId(projectId);
                            })
                            .finally(() => {
                              setSelectingProjectId((currentProjectId) =>
                                currentProjectId === projectId
                                  ? undefined
                                  : currentProjectId,
                              );
                            });
                        }}
                      >
                        {selectingProjectId === project.projectId &&
                        pendingAction === "open"
                          ? "Selecting..."
                          : visibleSelectedProject?.projectId === project.projectId
                            ? "Selected"
                            : "Select"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="info-card" data-testid="project-selected-panel">
              <h3>Selected project</h3>
              {visibleSelectedProject ? (
                <>
                  <p
                    className="status-note"
                    data-testid="project-selection-confirmation"
                    role="status"
                    aria-live="polite"
                  >
                    Selected project: {visibleSelectedProject.title}
                  </p>
                  <dl className="metadata-list">
                    <div>
                      <dt>Project ID</dt>
                      <dd>{visibleSelectedProject.projectId}</dd>
                    </div>
                    <div>
                      <dt>Title</dt>
                      <dd>{visibleSelectedProject.title}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{visibleSelectedProject.status}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{visibleSelectedProject.createdAt}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{visibleSelectedProject.updatedAt}</dd>
                    </div>
                  </dl>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void renameProject(visibleSelectedProject.projectId, renameTitle);
                    }}
                  >
                    <label htmlFor="rename-project-title">Rename project</label>
                    <input
                      id="rename-project-title"
                      name="renameProjectTitle"
                      value={renameTitle}
                      onChange={(event) => setRenameTitle(event.target.value)}
                      placeholder={visibleSelectedProject.title}
                    />
                    <button
                      type="submit"
                      disabled={pendingAction === "rename"}
                    >
                      {pendingAction === "rename" ? "Renaming..." : "Rename Project"}
                    </button>
                  </form>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.history.pushState(
                          {},
                          "",
                          `/mixer?projectId=${encodeURIComponent(visibleSelectedProject.projectId)}`,
                        );
                        syncWithLocation("/mixer");
                      }
                    }}
                  >
                    Use in Mixer
                  </button>
                </>
              ) : (
                <p>Open a project to inspect its persisted metadata.</p>
              )}
            </article>
          </div>
        ) : accessStatus === "forbidden" ? (
          <article className="info-card" data-testid="projects-forbidden-state">
            <h3>Workspace access is required</h3>
            <p>
              This route only shows backend-owned project summaries for a verified
              workspace membership.
            </p>
          </article>
        ) : (
          <article className="info-card" data-testid="projects-protected-state">
            <h3>Verified project data is not available yet</h3>
            <p>
              This route stays empty until a backend-verified session can load
              account-owned project summaries.
            </p>
          </article>
        )}
        {operationStatus === "validation_error" ? (
          <p className="status-note" data-testid="project-validation-state">
            {accessMessage}
          </p>
        ) : null}
        {operationStatus === "not_found" ? (
          <p className="status-note" data-testid="project-not-found-state">
            {accessMessage}
          </p>
        ) : null}
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Boundary notes</p>
          <h2>What this route will not do</h2>
        </div>
        <div className="placeholder-grid">
          <article className="info-card">
            <h3>No local ownership shortcut</h3>
            <p>Timeline IDs and localStorage are not used as proof of account ownership.</p>
          </article>
          <article className="info-card">
            <h3>No fake saved work</h3>
            <p>No fake project cards, fake timestamps, or fake cloud persistence are shown here.</p>
          </article>
        </div>
      </div>
    </section>
  );
}