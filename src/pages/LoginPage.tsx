import type { FormEvent } from "react";
import { useAuthStore } from "../store/authStore";
import { useNavigationStore } from "../store/navigationStore";

const handleCredentialsSubmit = (
  event: FormEvent<HTMLFormElement>,
  submit: (credentials: { email: string; password: string }) => Promise<void>,
): void => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  void submit({ email, password });
};

export function LoginPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authMessage = useAuthStore((state) => state.message);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const login = useAuthStore((state) => state.login);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <section className="auth-page" data-testid="login-page">
      <div className="auth-hero">
        <div className="auth-panel">
          <p className="eyebrow">Product Phase 2</p>
          <h1>Log in</h1>
          <p className="placeholder-description">
            This route checks the backend auth boundary. If auth is not configured,
            the UI stays honest instead of inventing a session.
          </p>
          <form className="auth-form" onSubmit={(event) => handleCredentialsSubmit(event, login)}>
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
                {pendingAction === "login" ? "Checking backend auth..." : "Request login"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/signup")}
              >
                Open sign up
              </button>
            </div>
          </form>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Session state</span>
          <strong>{authStatus}</strong>
          <p>{authMessage}</p>
          <p>No fake user or local-only login is created in this route.</p>
        </div>
      </div>
    </section>
  );
}
