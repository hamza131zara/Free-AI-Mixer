import { useEffect } from "react";
import { useNavigationStore } from "../store/navigationStore";
import { useProjectLibraryStore } from "../store/projectLibraryStore";

export function ProjectsPage() {
  const accessStatus = useProjectLibraryStore((state) => state.accessStatus);
  const accessMessage = useProjectLibraryStore((state) => state.accessMessage);
  const activeWorkspaceId = useProjectLibraryStore((state) => state.activeWorkspaceId);
  const projects = useProjectLibraryStore((state) => state.projects);
  const pendingAction = useProjectLibraryStore((state) => state.pendingAction);
  const refreshProjectLibrary = useProjectLibraryStore(
    (state) => state.refreshProjectLibrary,
  );
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshProjectLibrary();
  }, [refreshProjectLibrary]);

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
              Verified workspace: <strong>{activeWorkspaceId ?? "No workspace selected yet"}</strong>
            </p>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Saved projects</p>
          <h2>Honest empty state only</h2>
        </div>
        {accessStatus === "authenticated" && projects.length === 0 ? (
          <article className="info-card" data-testid="projects-empty-state">
            <h3>Saved projects are not enabled yet</h3>
            <p>
              No account-owned project records are available yet. Browser-local
              timelines in the mixer are not treated as saved cloud projects.
            </p>
          </article>
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
