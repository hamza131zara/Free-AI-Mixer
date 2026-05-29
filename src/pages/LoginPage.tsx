import type { FormEvent } from "react";
import { useAuthStore } from "../store/authStore";
import { useNavigationStore } from "../store/navigationStore";

export function LoginPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authMessage = useAuthStore((state) => state.message);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const login = useAuthStore((state) => state.login);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const handleCredentialsSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    void login({ email, password }).then(() => {
      if (useAuthStore.getState().status === "authenticated") {
        navigateTo("/dashboard");
      }
    });
  };

  return (
    <section className="auth-page" data-testid="login-page">
      <div className="auth-hero">
        <div className="auth-panel">
          <p className="eyebrow">Product Phase 2</p>
          <h1>Log in</h1>
          <p className="placeholder-description">
            This route signs in through Supabase Auth only when the frontend auth
            wrapper is configured, then waits for backend account verification and
            setup before treating the session as real app access.
          </p>
          <form className="auth-form" onSubmit={handleCredentialsSubmit}>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="hero-actions">
              <button type="submit" disabled={pendingAction === "login"}>
                {pendingAction === "login" ? "Signing in..." : "Log in"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/signup")}
              >
                Open sign up
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/forgot-password")}
              >
                Forgot password?
              </button>
            </div>
          </form>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Session state</span>
          <strong>{authStatus}</strong>
          <p>{authMessage}</p>
          <p>No fake user, fake session, or frontend-owned workspace is created in this route.</p>
        </div>
      </div>
    </section>
  );
}
