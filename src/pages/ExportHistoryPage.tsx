import { useEffect } from "react";
import { useNavigationStore } from "../store/navigationStore";
import { useExportHistoryStore } from "../store/exportHistoryStore";

export function ExportHistoryPage() {
  const accessStatus = useExportHistoryStore((state) => state.accessStatus);
  const accessMessage = useExportHistoryStore((state) => state.accessMessage);
  const activeWorkspaceId = useExportHistoryStore((state) => state.activeWorkspaceId);
  const exports = useExportHistoryStore((state) => state.exports);
  const pendingAction = useExportHistoryStore((state) => state.pendingAction);
  const refreshExportHistory = useExportHistoryStore(
    (state) => state.refreshExportHistory,
  );
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshExportHistory();
  }, [refreshExportHistory]);

  return (
    <section className="export-history-page" data-testid="export-history-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 4</p>
          <h1>Export history boundary</h1>
          <p className="placeholder-description">
            This route only shows verified backend export history status. It does
            not invent completed videos, artifact rows, download rows, or fake dates.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshExportHistory();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh export history"}
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

        <div className="status-callout" data-testid="history-access-state">
          <span className="status-kicker">Access status</span>
          <strong>{accessStatus}</strong>
          <p>{accessMessage}</p>
          {accessStatus === "unauthenticated" ? (
            <p>Sign in is required before verified backend export history can appear here.</p>
          ) : null}
          {accessStatus === "unavailable" ? (
            <p>Authentication is not configured on this backend yet.</p>
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
          <p className="eyebrow">Verified export jobs</p>
          <h2>Honest history state only</h2>
        </div>
        {accessStatus === "authenticated" && exports.length === 0 ? (
          <article className="info-card" data-testid="history-empty-state">
            <h3>Export history is not enabled yet</h3>
            <p>
              Export history appears only after verified backend exports exist for
              this account. Browser-local export handles are not shown as account history.
            </p>
          </article>
        ) : (
          <article className="info-card" data-testid="history-protected-state">
            <h3>Verified export history is not available yet</h3>
            <p>
              This route stays empty until a backend-verified session can load
              account-owned export history summaries.
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
            <h3>No fake export records</h3>
            <p>No fake completed videos, fake artifact rows, fake download rows, or fake timestamps appear here.</p>
          </article>
          <article className="info-card">
            <h3>No local handle ownership shortcut</h3>
            <p>Browser-local export handles are reconnect convenience only and are not ownership proof.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
