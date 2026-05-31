import type { FormEvent } from "react";
import { useState } from "react";
import { requestPasswordResetWithSupabaseRuntime } from "../services/auth/authRuntimeService";
import { useNavigationStore } from "../store/navigationStore";

const neutralResetCopy = "If an account exists, reset instructions have been sent.";

const getResetRedirectUrl = (): string | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/reset-password`;
};

export function ForgotPasswordPage() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const [message, setMessage] = useState(
    "Enter your email to request reset instructions.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    setIsSubmitting(true);
    void requestPasswordResetWithSupabaseRuntime({
      email,
      redirectTo: getResetRedirectUrl(),
    }).then((result) => {
      setMessage(result.kind === "unavailable" ? result.message : neutralResetCopy);
      setIsSubmitting(false);
    });
  };

  return (
    <section className="auth-page" data-testid="forgot-password-page">
      <div className="auth-hero">
        <div className="auth-panel">
          <p className="eyebrow">Account recovery</p>
          <h1>Reset your password</h1>
          <p className="placeholder-description">
            Password recovery uses Supabase Auth only. Free AI Mixer does not store reset
            tokens or claim backend app access from this request.
          </p>
          <p className="placeholder-description">
            If email is delayed, wait before requesting again to avoid provider
            rate limits. Use the newest recovery email only and never share the
            full recovery link.
          </p>
          <p className="placeholder-description">
            Delivery depends on the configured auth email provider. Check spam,
            junk, or promotions folders; reset emails are not guaranteed to arrive
            instantly.
          </p>
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <div className="hero-actions">
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send reset instructions"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => navigateTo("/login")}
              >
                Back to login
              </button>
            </div>
          </form>
        </div>

        <div className="status-callout" data-testid="forgot-password-status">
          <span className="status-kicker">Recovery state</span>
          <strong>Password reset</strong>
          <p>{message}</p>
          <p>For safety, this page uses neutral copy and avoids account enumeration.</p>
        </div>
      </div>
    </section>
  );
}
