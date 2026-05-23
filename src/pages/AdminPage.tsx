import { useEffect } from "react";
import { useAdminReadinessStore } from "../store/adminReadinessStore";
import { useNavigationStore } from "../store/navigationStore";

const adminRoleNotes = [
  "Platform admin is a future backend-verified internal role only.",
  "Platform moderator is lower privilege than platform admin and cannot access secrets, signed delivery URLs, or unrestricted billing tools.",
  "Workspace roles are separate from platform roles and must not be treated as platform-wide privileges.",
] as const;

export function AdminPage() {
  const status = useAdminReadinessStore((state) => state.status);
  const message = useAdminReadinessStore((state) => state.message);
  const summary = useAdminReadinessStore((state) => state.summary);
  const pendingAction = useAdminReadinessStore((state) => state.pendingAction);
  const refreshStatus = useAdminReadinessStore((state) => state.refreshStatus);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  return (
    <section className="admin-page" data-testid="admin-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 10</p>
          <h1>Admin readiness shell</h1>
          <p className="placeholder-description">
            This route is reserved for future backend-verified platform admin and
            moderator workflows. It stays fail closed in this phase and does not
            expose any real or fake operational data.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshStatus();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh admin readiness"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/dashboard")}
            >
              Back to dashboard
            </button>
          </div>
        </div>

        <div className="status-callout" data-testid="admin-status-card">
          <span className="status-kicker">Admin state</span>
          <strong>{status}</strong>
          <p>{message}</p>
          <p>No metrics, users, jobs, projects, revenue, moderation queues, or support backlog are shown here.</p>
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Role readiness</p>
          <h2>Platform roles stay backend-verified only</h2>
        </div>
        <div className="placeholder-grid">
          {adminRoleNotes.map((note) => (
            <article key={note} className="info-card">
              <p>{note}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Current limitation</p>
          <h2>No real privileged access is enabled yet</h2>
        </div>
        <article className="info-card">
          <p>Admin tools are not enabled yet.</p>
          <p>Moderator tools are not enabled yet.</p>
          <p>
            {summary?.verifiedAdminSessionRequired
              ? "A verified backend session will be required later."
              : "Admin readiness is not available."}
          </p>
        </article>
      </div>
    </section>
  );
}
