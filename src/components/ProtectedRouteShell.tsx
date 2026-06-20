import { useEffect, type ReactNode } from "react";
import { useNavigationStore } from "../store/navigationStore";
import { useAuthStore } from "../store/authStore";

export interface ProtectedRouteShellProps {
  routeLabel: string;
  children: ReactNode;
}

const resolveUnavailableMessage = (
  reasonCode: string | undefined,
  message: string,
): string => {
  if (reasonCode === "auth_service_unreachable") {
    return "This backend route is currently unavailable.";
  }

  if (
    reasonCode === "auth_not_configured" ||
    reasonCode === "auth_provider_unavailable"
  ) {
    return "Authentication is not configured on this backend yet.";
  }

  return message;
};

export function ProtectedRouteShell({
  routeLabel,
  children,
}: ProtectedRouteShellProps) {
  const authStatus = useAuthStore((state) => state.status);
  const authMessage = useAuthStore((state) => state.message);
  const authReasonCode = useAuthStore((state) => state.reasonCode);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  useEffect(() => {
    if (authStatus === "unknown") {
      void refreshSession();
    }
  }, [authStatus, refreshSession]);

  if (authStatus === "authenticated") {
    return <>{children}</>;
  }

  let headline = "Checking session";
  let body = "Restoring your secure session before showing protected account data.";

  if (authStatus === "unauthenticated") {
    headline = "Sign in required";
    body = "Sign in is required before this page can show verified account data.";
  }

  if (authStatus === "unavailable") {
    headline = "Authentication unavailable";
    body = resolveUnavailableMessage(authReasonCode, authMessage);
  }

  return (
    <section
      className="protected-route-shell"
      data-testid="protected-route-shell"
    >
      <div className="placeholder-hero">
        <div className="dashboard-copy">
          <p className="eyebrow">Protected route shell</p>
          <h1>{routeLabel}</h1>
          <p className="placeholder-description">{body}</p>
          <div className="hero-actions">
            {authStatus === "unauthenticated" ? (
              <button
                type="button"
                onClick={() => navigateTo("/login")}
              >
                Go to login
              </button>
            ) : null}
          </div>
        </div>

        <div
          className="status-callout"
          data-testid="protected-route-shell-status"
        >
          <span className="status-kicker">Shell state</span>
          <strong>{headline}</strong>
          <p>{body}</p>
          {authStatus === "unknown" ? (
            <p>Checking session with the backend auth boundary.</p>
          ) : null}
          {authStatus === "unauthenticated" ? (
            <p>Sign in through the configured auth provider before this page can show backend-owned data.</p>
          ) : null}
          {authStatus === "unavailable" ? <p>{authMessage}</p> : null}
        </div>
      </div>
    </section>
  );
}
