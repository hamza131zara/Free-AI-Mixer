import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test.describe("phase35 auth email onboarding docs and copy", () => {
  test("custom SMTP onboarding doc records manual setup, redirect, rate-limit, and tokenized-link guidance", () => {
    const doc = readSource("docs/auth-email-custom-smtp-onboarding.md");

    expect(doc).toContain("Configure custom SMTP manually in Supabase");
    expect(doc).toContain("SMTP provider choice");
    expect(doc).toContain("Sender and from address");
    expect(doc).toContain("DNS records");
    expect(doc).toContain("http://localhost:5173/login");
    expect(doc).toContain("http://localhost:5173/signup");
    expect(doc).toContain("http://localhost:5173/reset-password");
    expect(doc).toContain("If Vite runs on another local port");
    expect(doc).toContain("Use only the newest verification or recovery email");
    expect(doc).toContain("Confirmation and recovery links can contain temporary tokens");
    expect(doc).toContain("pre-confirmed tester accounts");
    expect(doc).toContain("dedicated verified smoke user");
    expect(doc).toContain("Disable the tester user");
    expect(doc).toContain("Do not run destructive database cleanup by default");
  });

  test("auth pages include rate-limit, newest-link, and tokenized-link safety copy without behavior changes", () => {
    const loginPage = readSource("src/pages/LoginPage.tsx");
    const signupPage = readSource("src/pages/SignupPage.tsx");
    const forgotPasswordPage = readSource("src/pages/ForgotPasswordPage.tsx");
    const resetPasswordPage = readSource("src/pages/ResetPasswordPage.tsx");

    expect(loginPage).toContain("confirmed account and known password");
    expect(loginPage).toContain("temporary auth tokens");
    expect(signupPage).toContain("Use the newest verification email only");
    expect(signupPage).toContain("email rate limits");
    expect(forgotPasswordPage).toContain("avoid provider");
    expect(forgotPasswordPage).toContain("Use the newest recovery email only");
    expect(resetPasswordPage).toContain("expired, reused, or opened on the wrong");
    expect(resetPasswordPage).toContain("newest link only");

    expect(loginPage).toContain("void login({ email, password })");
    expect(signupPage).toContain("void submit({ email, password })");
    expect(forgotPasswordPage).toContain("neutralResetCopy");
    expect(resetPasswordPage).toContain("updatePasswordWithSupabaseRuntime");
  });

  test("phase35 docs and source avoid real-looking secrets, token storage, and auth runtime expansion", () => {
    const docsAndPages = [
      "docs/auth-email-custom-smtp-onboarding.md",
      "docs/private-beta-readiness-checklist.md",
      "docs/real-auth-runtime-smoke-runbook.md",
      "src/pages/LoginPage.tsx",
      "src/pages/SignupPage.tsx",
      "src/pages/ForgotPasswordPage.tsx",
      "src/pages/ResetPasswordPage.tsx",
    ].map(readSource).join("\n");

    const authServiceSource = readSource("src/services/auth/authRuntimeService.ts");
    const supabaseAuthClientSource = readSource("src/services/auth/supabaseAuthClient.ts");
    const authStoreSource = readSource("src/store/authStore.ts");
    const backendSource = [
      readSource("backend/routes/auth.ts"),
      readSource("backend/routes/account.ts"),
    ].join("\n");

    expect(docsAndPages).not.toContain("smtp://");
    expect(docsAndPages).not.toContain("smtp.gmail.com");
    expect(docsAndPages).not.toContain("SG.");
    expect(docsAndPages).not.toContain("sk-");
    expect(docsAndPages).not.toContain("eyJhbGci");
    expect(docsAndPages).not.toContain("service_role");
    expect(docsAndPages).not.toContain("refresh_token=");
    expect(docsAndPages).not.toContain("access_token=");
    expect(docsAndPages).not.toContain("#access_token");
    expect(docsAndPages).not.toContain("#refresh_token");
    expect(docsAndPages).not.toContain("localStorage.setItem");
    expect(docsAndPages).not.toContain("sessionStorage.setItem");

    expect(authServiceSource).toContain("signUpWithSupabaseRuntime");
    expect(authServiceSource).toContain("requestPasswordResetWithSupabaseRuntime");
    expect(supabaseAuthClientSource).toContain("resetPasswordForEmail");
    expect(supabaseAuthClientSource).not.toContain("verifyOtp");
    expect(supabaseAuthClientSource).not.toContain("token_hash");
    expect(authStoreSource).not.toContain("smtp");
    expect(authStoreSource).not.toContain("tokenized");
    expect(backendSource).not.toContain("resetPasswordForEmail");
    expect(backendSource).not.toContain("smtp");
    expect(backendSource).not.toContain("verifyOtp");
  });
});
