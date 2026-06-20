import type { FormEvent } from "react";
import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useNavigationStore } from "../store/navigationStore";

export function ResetPasswordPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const recoveryStatus = useAuthStore((state) => state.recoveryStatus);
  const recoveryMessage = useAuthStore((state) => state.recoveryMessage);
  const pendingAction = useAuthStore((state) => state.pendingAction);
  const updateRecoveryPassword = useAuthStore(
    (state) => state.updateRecoveryPassword,
  );
  const [localMessage, setLocalMessage] = useState<string | undefined>();
  const isSubmitting = pendingAction === "password_reset";
  const recoveryReady = recoveryStatus === "recovery_ready";
  const passwordUpdated = recoveryStatus === "recovery_complete";
  const formDisabled = !recoveryReady || isSubmitting || passwordUpdated;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!recoveryReady || passwordUpdated) {
      setLocalMessage("Request a fresh password reset link before updating your password.");
      return;
    }

    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setLocalMessage("Passwords do not match.");
      return;
    }

    setLocalMessage(undefined);
    void updateRecoveryPassword(password).then(() => {
      form.reset();
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
          <p className="placeholder-description">
            If this reset link is expired, reused, or opened on the wrong local or
            staging port, request a fresh reset email and use the newest link only.
          </p>
          <p className="placeholder-description">
            If the email is missing, check spam, junk, or promotions folders before
            requesting another reset. Delivery depends on the configured auth email
            provider and may be rate-limited during testing.
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
                disabled={formDisabled}
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={formDisabled}
              />
            </label>
            <div className="hero-actions">
              <button type="submit" disabled={formDisabled}>
                {isSubmitting ? "Updating..." : "Update password"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/forgot-password")}
              >
                Request a fresh link
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
          <strong>{passwordUpdated ? "Password updated" : recoveryReady ? "Recovery ready" : "Recovery unavailable"}</strong>
          <p>{localMessage ?? recoveryMessage}</p>
          <p>After recovery, sign in again so backend /auth/session remains canonical.</p>
        </div>
      </div>
    </section>
  );
}
