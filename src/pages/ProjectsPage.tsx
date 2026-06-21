import { useEffect, useState } from "react";
import { useNavigationStore } from "../store/navigationStore";
import { useProjectLibraryStore } from "../store/projectLibraryStore";

export function ProjectsPage() {
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [selectingProjectId, setSelectingProjectId] = useState<string | undefined>();
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

  useEffect(() => {
    void refreshProjectLibrary();
  }, [refreshProjectLibrary]);

  useEffect(() => {
    if (selectedProject) {
      setRenameTitle(selectedProject.title);
    }
  }, [selectedProject]);

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
                        selectedProject?.projectId === project.projectId
                          ? "true"
                          : undefined
                      }
                    >
                      <strong>{project.title}</strong>
                      <span>Status: {project.status}</span>
                      <span>Updated: {project.updatedAt}</span>
                      {selectedProject?.projectId === project.projectId ? (
                        <span aria-label="Currently selected project">Selected</span>
                      ) : null}
                      <button
                        type="button"
                        className="secondary"
                        aria-pressed={selectedProject?.projectId === project.projectId}
                        disabled={
                          pendingAction === "open" ||
                          selectingProjectId === project.projectId
                        }
                        onClick={() => {
                          setSelectingProjectId(project.projectId);
                          void openProject(project.projectId).finally(() => {
                            setSelectingProjectId(undefined);
                          });
                        }}
                      >
                        {selectingProjectId === project.projectId &&
                        pendingAction === "open"
                          ? "Selecting..."
                          : selectedProject?.projectId === project.projectId
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
              {selectedProject ? (
                <>
                  <p
                    className="status-note"
                    data-testid="project-selection-confirmation"
                    role="status"
                    aria-live="polite"
                  >
                    Selected project: {selectedProject.title}
                  </p>
                  <dl className="metadata-list">
                    <div>
                      <dt>Project ID</dt>
                      <dd>{selectedProject.projectId}</dd>
                    </div>
                    <div>
                      <dt>Title</dt>
                      <dd>{selectedProject.title}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selectedProject.status}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{selectedProject.createdAt}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{selectedProject.updatedAt}</dd>
                    </div>
                  </dl>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void renameProject(selectedProject.projectId, renameTitle);
                    }}
                  >
                    <label htmlFor="rename-project-title">Rename project</label>
                    <input
                      id="rename-project-title"
                      name="renameProjectTitle"
                      value={renameTitle}
                      onChange={(event) => setRenameTitle(event.target.value)}
                      placeholder={selectedProject.title}
                    />
                    <button
                      type="submit"
                      disabled={pendingAction === "rename"}
                    >
                      {pendingAction === "rename" ? "Renaming..." : "Rename Project"}
                    </button>
                  </form>
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
