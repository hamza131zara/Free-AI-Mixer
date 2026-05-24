import { useEffect } from "react";
import {
  fallbackAdminAnalyticsReadiness,
  fallbackAdminMetricCatalog,
} from "../services/adminReadinessFallback";
import { useAdminReadinessStore } from "../store/adminReadinessStore";
import { useNavigationStore } from "../store/navigationStore";

const adminRoleNotes = [
  "Platform admin is a future backend-verified internal role only.",
  "Platform moderator is lower privilege than platform admin and cannot access secrets, signed delivery URLs, or unrestricted billing tools.",
  "Workspace roles are separate from platform roles and must not be treated as platform-wide privileges.",
  "Platform admin verification is not enabled yet, so authenticated workspace owners and workspace admins still fail closed here.",
] as const;

const readinessDependencyNotes = [
  "Unavailable until real auth/workspace data",
  "Unavailable until event logging",
  "Unavailable until BYOK vault/storage",
  "Unavailable until generation/export runtime",
  "Unavailable until credit ledger/billing runtime",
  "Unavailable until storage/artifact provider",
] as const;

export function AdminPage() {
  const status = useAdminReadinessStore((state) => state.status);
  const message = useAdminReadinessStore((state) => state.message);
  const summary = useAdminReadinessStore((state) => state.summary);
  const pendingAction = useAdminReadinessStore((state) => state.pendingAction);
  const refreshStatus = useAdminReadinessStore((state) => state.refreshStatus);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const analyticsReadiness =
    summary?.analyticsReadiness ?? fallbackAdminAnalyticsReadiness;
  const metricCatalog = summary?.metricCatalog ?? fallbackAdminMetricCatalog;

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  return (
    <section className="admin-page" data-testid="admin-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 19</p>
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
          <p>Platform admin verification is not enabled yet.</p>
          <p>
            {summary?.verifiedAdminSessionRequired
              ? "A verified backend session will be required later."
              : "Admin readiness is not available."}
          </p>
        </article>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Readiness indicators</p>
          <h2>Truthful analytics prerequisites only</h2>
        </div>
        <div className="placeholder-grid" data-testid="admin-readiness-grid">
          {analyticsReadiness.indicators.map((indicator) => (
            <article key={indicator.indicatorId} className="info-card">
              <p className="info-card-label">{indicator.label}</p>
              <h3>{indicator.displayName}</h3>
              <p>{indicator.summary}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Metric availability</p>
          <h2>Future metrics grouped by required dependency</h2>
        </div>
        <div className="note-grid" data-testid="admin-metric-catalog">
          {metricCatalog.groups.map((group) => (
            <article key={group.groupId} className="info-card">
              <p className="info-card-label">{group.displayName}</p>
              <h3>{group.description}</h3>
              {group.metrics.map((metric) => (
                <p key={metric.metricId}>
                  <strong>{metric.displayName}:</strong> {metric.dependencyLabel}
                </p>
              ))}
            </article>
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Safety labels</p>
          <h2>How this page avoids fake analytics</h2>
        </div>
        <div className="placeholder-grid">
          {readinessDependencyNotes.map((note) => (
            <article key={note} className="info-card">
              <p>{note}</p>
            </article>
          ))}
          <article className="info-card">
            <p>Readiness indicator</p>
          </article>
        </div>
      </div>
    </section>
  );
}
