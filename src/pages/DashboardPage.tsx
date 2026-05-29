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
  {
    title: "Templates and onboarding",
    body:
      "Templates, first-run onboarding, and template-driven generation stay planning-only until later product phases.",
  },
] as const;

const quickLinks = [
  {
    label: "Projects",
    path: "/projects",
    summary: "View the protected saved-projects boundary. No cloud project saves yet.",
  },
  {
    label: "History",
    path: "/history",
    summary: "Review the protected export-history boundary. No account export rows yet.",
  },
  {
    label: "Provider Settings",
    path: "/settings/providers",
    summary: "Inspect provider catalog and BYOK readiness. Key storage is not live.",
  },
  {
    label: "Credits",
    path: "/credits",
    summary: "Read planned credit policy. No live balance, refill, or ledger mutation.",
  },
  {
    label: "Mixer",
    path: "/mixer",
    summary: "Return to the local mixer workbench.",
  },
  {
    label: "Help",
    path: "/help",
    summary: "Find beta guidance, limitations, and support notes.",
  },
  {
    label: "Onboarding",
    path: "/onboarding",
    summary: "Review product setup guidance without claiming completed setup.",
  },
] as const;

const betaLimitations = [
  "No real saved projects yet.",
  "No real credits, billing, refill, or ledger mutation yet.",
  "No provider key or BYOK storage yet.",
  "No real export/download account history yet.",
  "No active workspace switching yet.",
  "No OAuth or public launch behavior yet.",
] as const;

const multipleWorkspaceBlockedCopy =
  "Your account has more than one active workspace. Workspace selection is not available in this beta yet, so Free AI Mixer cannot choose one safely. Use a single-workspace beta account or contact support.";

const getWorkspaceStatusLabel = (
  identity: ReturnType<typeof useAuthStore.getState>["identity"],
  reasonCode?: string,
): string => {
  if (identity?.workspaceAuthority === "verified") {
    return "Workspace authority verified by backend membership.";
  }

  if (
    identity?.workspaceAuthorityReason === "multiple_active_workspace_memberships" ||
    reasonCode === "workspace_bootstrap_blocked"
  ) {
    return multipleWorkspaceBlockedCopy;
  }

  if (identity?.workspaceAuthorityReason === "no_active_workspace_membership") {
    return "No active workspace membership is available yet. Retry account setup after your account is verified.";
  }

  if (identity?.workspaceAuthorityReason === "workspace_runtime_not_enabled") {
    return "Workspace authority is not configured on this backend yet.";
  }

  return "Workspace authority is not available yet.";
};

const shouldShowRetrySetup = (authStatus: string, reasonCode?: string): boolean =>
  authStatus === "unavailable" ||
  reasonCode === "email_verification_required" ||
  reasonCode === "workspace_bootstrap_blocked" ||
  reasonCode === "account_bootstrap_unavailable";

export function DashboardPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authMessage = useAuthStore((state) => state.message);
  const identity = useAuthStore((state) => state.identity);
  const reasonCode = useAuthStore((state) => state.reasonCode);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const retryAccountBootstrap = useAuthStore((state) => state.retryAccountBootstrap);
  const logout = useAuthStore((state) => state.logout);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const workspaceStatusLabel = getWorkspaceStatusLabel(identity, reasonCode);
  const retrySetupVisible = shouldShowRetrySetup(authStatus, reasonCode);
  const handleLogout = (): void => {
    void logout().then(() => {
      if (useAuthStore.getState().status === "unauthenticated") {
        navigateTo("/login");
      }
    });
  };

  return (
    <section className="dashboard-page" data-testid="dashboard-page">
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Controlled private beta</p>
          <h1>Private beta account dashboard</h1>
          <p className="placeholder-description">
            This dashboard shows backend-verified account setup and gives beta
            testers clear next steps. It does not fabricate projects, credits,
            provider connections, exports, usage metrics, or workspace choices.
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
            {retrySetupVisible ? (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  void retryAccountBootstrap();
                }}
                disabled={pendingAction === "bootstrap"}
              >
                {pendingAction === "bootstrap" ? "Retrying setup..." : "Retry account setup"}
              </button>
            ) : null}
            {authStatus === "authenticated" ? (
              <button
                type="button"
                className="secondary"
                onClick={handleLogout}
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
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/templates")}
            >
              Browse templates
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/onboarding")}
            >
              Review onboarding
            </button>
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
            <p>
              Authentication or account setup is unavailable. If you are signed in
              with Supabase Auth, retry account setup after the backend is available.
            </p>
          ) : null}
          {authStatus === "unknown" ? (
            <p>The frontend is still waiting for backend session verification.</p>
          ) : null}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Backend account status</p>
          <h2>Session and setup summary</h2>
        </div>
        <article className="info-card" data-testid="dashboard-account-status-panel">
          <p>
            <strong>Backend session:</strong> {authStatus}
          </p>
          <p>
            <strong>Setup state:</strong>{" "}
            {authStatus === "authenticated" ? "Setup complete" : "Setup required"}
          </p>
          <p>
            <strong>Email:</strong> {identity?.email ?? "Only shown after backend session verification"}
          </p>
          <p>
            <strong>User ID:</strong> {identity?.userId ?? "Not available"}
          </p>
          <p>
            <strong>Workspace:</strong> {identity?.workspaceId ?? "No backend-verified workspace"}
          </p>
          <p>
            <strong>Workspace authority:</strong> {workspaceStatusLabel}
          </p>
          <p>
            This panel uses backend /auth/session identity only. It does not infer
            workspace or platform authority from Supabase metadata.
          </p>
        </article>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Beta shortcuts</p>
          <h2>Where to look during this account beta</h2>
        </div>
        <div className="placeholder-grid" data-testid="dashboard-beta-quick-links">
          {quickLinks.map((link) => (
            <article key={link.path} className="info-card">
              <h3>{link.label}</h3>
              <p>{link.summary}</p>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo(link.path)}
              >
                Open {link.label}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Beta limitations</p>
          <h2>What this beta will not pretend is ready</h2>
        </div>
        <div className="note-grid" data-testid="dashboard-beta-limitations">
          {betaLimitations.map((limitation) => (
            <article key={limitation} className="info-card">
              <p>{limitation}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-section">
        <div className="section-header">
          <p className="eyebrow">Support</p>
          <h2>Report confusing beta states</h2>
        </div>
        <article className="info-card" data-testid="dashboard-support-guidance">
          <h3>Help us harden the account flow</h3>
          <p>
            Please report confusing login, signup, password reset, setup, workspace,
            provider, credits, project, or export states. Include the page you were
            on, the visible status message, and whether you had just signed in,
            reset a password, or retried setup.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/help")}
            >
              Open help
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigateTo("/forgot-password")}
            >
              Account recovery
            </button>
          </div>
        </article>
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
