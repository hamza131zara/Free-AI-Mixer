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

export function SignupPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authMessage = useAuthStore((state) => state.message);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const signup = useAuthStore((state) => state.signup);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  return (
    <section className="auth-page" data-testid="signup-page">
      <div className="auth-hero">
        <div className="auth-panel">
          <p className="eyebrow">Product Phase 2</p>
          <h1>Sign up</h1>
          <p className="placeholder-description">
            Signup remains email-verification-first. This route may create the auth
            provider account, but it does not claim Free AI Mixer account setup is complete
            until a later verified backend bootstrap succeeds.
          </p>
          <p className="placeholder-description">
            Use the newest verification email only. Older links may expire or stop
            working after another request, and repeated requests can hit provider
            email rate limits.
          </p>
          <p className="placeholder-description">
            Email delivery depends on the configured auth email provider. Check
            spam, junk, or promotions folders before requesting another message.
          </p>
          <form className="auth-form" onSubmit={(event) => handleCredentialsSubmit(event, signup)}>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
            <div className="hero-actions">
              <button type="submit" disabled={pendingAction === "signup"}>
                {pendingAction === "signup" ? "Creating account..." : "Sign up"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/login")}
              >
                Open login
              </button>
            </div>
          </form>
        </div>

        <div className="status-callout">
          <span className="status-kicker">Session state</span>
          <strong>{authStatus}</strong>
          <p>{authMessage}</p>
          <p>Workspace setup stays backend-owned and begins only after a verified login/session.</p>
        </div>
      </div>
    </section>
  );
}
