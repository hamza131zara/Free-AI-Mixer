import { useAuthStore } from "../store/authStore";
import { useNavigationStore } from "../store/navigationStore";

const notEnabledYetCards = [
  {
    title: "Workspace",
    body:
      "Workspace switching and durable workspace setup are not enabled yet in this phase.",
  },
  {
    title: "Projects and history",
    body:
      "Projects, export history, and saved account activity are not enabled yet.",
  },
  {
    title: "Provider settings and credits",
    body:
      "Provider key setup and real credits remain separate later product phases.",
  },
] as const;

export function DashboardPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authMessage = useAuthStore((state) => state.message);
  const identity = useAuthStore((state) => state.identity);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const logout = useAuthStore((state) => state.logout);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <section className="dashboard-page" data-testid="dashboard-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Product Phase 2</p>
          <h1>Account dashboard boundary</h1>
          <p className="placeholder-description">
            This route only shows backend-verified session information. It does not
            fabricate a logged-in user, credits, projects, or provider setup.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              onClick={() => {
                void refreshSession();
              }}
              disabled={pendingAction === "refresh"}
            >
              {pendingAction === "refresh" ? "Refreshing..." : "Refresh session"}
            </button>
            {authStatus === "authenticated" ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void logout();
                }}
                disabled={pendingAction === "logout"}
              >
                {pendingAction === "logout" ? "Signing out..." : "Log out"}
              </button>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/login")}
              >
                Go to login
              </button>
            )}
          </div>
        </div>

        <div className="status-callout" data-testid="dashboard-session-state">
          <span className="status-kicker">Session status</span>
          <strong>{authStatus}</strong>
          <p>{authMessage}</p>
          {authStatus === "unauthenticated" ? (
            <p>Sign in is required before this dashboard can show verified account data.</p>
          ) : null}
          {authStatus === "unavailable" ? (
            <p>Authentication is not configured on this backend yet.</p>
          ) : null}
          {authStatus === "unknown" ? (
            <p>The frontend is still waiting for backend session verification.</p>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Verified account</p>
          <h2>Identity summary</h2>
        </div>
        {authStatus === "authenticated" && identity ? (
          <article className="info-card" data-testid="verified-identity-card">
            <p>
              <strong>User ID:</strong> {identity.userId}
            </p>
            <p>
              <strong>Workspace:</strong> {identity.workspaceId ?? "No workspace selected yet"}
            </p>
            <p>
              <strong>Auth provider:</strong> {identity.authProvider ?? "Not reported"}
            </p>
            <p>
              <strong>Auth subject:</strong> {identity.authSubject ?? "Not reported"}
            </p>
          </article>
        ) : (
          <article className="info-card" data-testid="dashboard-protected-state">
            <h3>Verified account data is not available yet</h3>
            <p>
              This dashboard only shows account identity after backend session
              verification succeeds.
            </p>
          </article>
        )}
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Still not enabled yet</p>
          <h2>Later product modules stay honest here</h2>
        </div>
        <div className="placeholder-grid">
          {notEnabledYetCards.map((card) => (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
