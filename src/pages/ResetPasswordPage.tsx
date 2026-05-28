import type { FormEvent } from "react";
import { useState } from "react";
import { updatePasswordWithSupabaseRuntime } from "../services/auth/authRuntimeService";
import { useAuthStore } from "../store/authStore";
import { useNavigationStore } from "../store/navigationStore";

export function ResetPasswordPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const [message, setMessage] = useState(
    "Enter a new password from the recovery link. After the update, sign in again.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    void updatePasswordWithSupabaseRuntime(password).then((result) => {
      setMessage(result.message);
      setPasswordUpdated(result.kind === "logged_out");
      setIsSubmitting(false);
      void refreshSession();
    });
  };

  return (
    <section className="auth-page" data-testid="reset-password-page">
      <div className="auth-hero">
        <div className="auth-panel">
          <p className="eyebrow">Account recovery</p>
          <h1>Choose a new password</h1>
          <p className="placeholder-description">
            The recovery session is handled by Supabase Auth. Free AI Mixer does not
            store reset tokens and does not mark backend app access as authenticated
            from this page.
          </p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>New password</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <div className="hero-actions">
              <button type="submit" disabled={isSubmitting || passwordUpdated}>
                {isSubmitting ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/login")}
              >
                Go to login
              </button>
            </div>
          </form>
        </div>

        <div className="status-callout" data-testid="reset-password-status">
          <span className="status-kicker">Recovery state</span>
          <strong>{passwordUpdated ? "Password updated" : "Awaiting update"}</strong>
          <p>{message}</p>
          <p>After recovery, sign in again so backend /auth/session remains canonical.</p>
        </div>
      </div>
    </section>
  );
}
