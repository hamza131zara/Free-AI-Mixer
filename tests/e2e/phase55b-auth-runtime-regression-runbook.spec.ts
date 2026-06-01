import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const requiredAuthRuntimeEnvNames = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "FREE_AI_MIXER_AUTH_RUNTIME_ENABLED",
  "FREE_AI_MIXER_AUTH_PROVIDER",
  "FREE_AI_MIXER_AUTH_ISSUER",
  "FREE_AI_MIXER_AUTH_AUDIENCE",
  "FREE_AI_MIXER_AUTH_JWKS_URI",
  "FREE_AI_MIXER_AUTH_JWT_KEY_MODE",
  "FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS",
  "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  "FREE_AI_MIXER_DB_PROVIDER",
  "FREE_AI_MIXER_SUPABASE_URL",
  "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  "FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED",
] as const;

const forbiddenSecretLikePatterns = [
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,
  /sb_secret_[a-zA-Z0-9_-]+/,
  /sk-(?:live|test|proj)-[a-zA-Z0-9_-]+/,
  /SG\.[a-zA-Z0-9_-]{16,}/,
  /smtp:\/\/[^`\s]+:[^`\s]+@/i,
  /access_token=/i,
  /refresh_token=/i,
  /#access_token/i,
  /#refresh_token/i,
] as const;

test.describe("phase55b auth runtime regression runbook", () => {
  test("local/staging auth runtime runbook documents the complete env checklist without secrets", () => {
    const runbook = readSource("docs/local-auth-runtime-runbook.md");

    for (const envName of requiredAuthRuntimeEnvNames) {
      expect(runbook).toContain(envName);
    }

    expect(runbook).toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=ES256");
    expect(runbook).toContain("Frontend Supabase env missing");
    expect(runbook).toContain("Supabase password login can work while Free AI Mixer backend auth is still not configured");
    expect(runbook).toContain("JWT env alone is not enough for account bootstrap");
    expect(runbook).toContain("Missing Supabase DB, service-role, or workspace runtime env");
    expect(runbook).toContain("bootstrap unavailable / 503");
    expect(runbook).toContain("service-role key is backend-only");
    expect(runbook).toContain("Never create `VITE_SUPABASE_SERVICE_ROLE_KEY`");
    expect(runbook).toContain("`VITE_*SERVICE_ROLE*`");
    expect(runbook).toContain("BYOK API key input, storage");
    expect(runbook).toContain("intentionally not live");
    expect(runbook).toContain("Credits, get-credits, refill, checkout, subscription");

    for (const forbiddenPattern of forbiddenSecretLikePatterns) {
      expect(runbook).not.toMatch(forbiddenPattern);
    }
  });

  test("real auth smoke runbook aligns JWT algorithm guidance with current ES256 Supabase tokens", () => {
    const realAuthRunbook = readSource("docs/real-auth-runtime-smoke-runbook.md");

    expect(realAuthRunbook).toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=ES256");
    expect(realAuthRunbook).toContain("current Supabase access token algorithm");
    expect(realAuthRunbook).toContain("current verified local/staging Supabase Auth path uses `ES256`");
    expect(realAuthRunbook).not.toContain("FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=RS256");
  });

  test("login and signup copy stays truthful for configured and unconfigured auth states", () => {
    const loginPage = readSource("src/pages/LoginPage.tsx");
    const signupPage = readSource("src/pages/SignupPage.tsx");
    const forgotPasswordPage = readSource("src/pages/ForgotPasswordPage.tsx");
    const resetPasswordPage = readSource("src/pages/ResetPasswordPage.tsx");
    const combinedAuthPages = [
      loginPage,
      signupPage,
      forgotPasswordPage,
      resetPasswordPage,
    ].join("\n");

    expect(loginPage).toContain("only when the frontend auth");
    expect(loginPage).toContain("waits for backend account verification");
    expect(loginPage).toContain("confirmed account and known password");
    expect(loginPage).toContain("not guaranteed to be instant");
    expect(signupPage).toContain("email-verification-first");
    expect(signupPage).toContain("does not claim Free AI Mixer account setup is complete");
    expect(signupPage).toContain("Use the newest verification email only");
    expect(signupPage).toContain("email rate limits");
    expect(forgotPasswordPage).toContain("uses neutral copy and avoids account enumeration");
    expect(resetPasswordPage).toContain("does not mark backend app access as authenticated");
    expect(resetPasswordPage).toContain("backend /auth/session remains canonical");

    expect(combinedAuthPages).not.toContain("email delivery is guaranteed");
    expect(combinedAuthPages).not.toContain("instant email delivery");
    expect(combinedAuthPages).not.toContain("app account is ready after signup");
    expect(combinedAuthPages).not.toContain("workspace is ready after signup");
    expect(combinedAuthPages).not.toContain("frontend-authenticated app session");
  });

  test("provider settings remains non-live without fake API key input or storage", () => {
    const providerSettingsPage = readSource("src/pages/ProviderSettingsPage.tsx");
    const providerSettingsStore = readSource("src/store/providerSettingsStore.ts");
    const providerSettingsService = readSource("src/services/providerSettingsService.ts");
    const combinedProviderSource = [
      providerSettingsPage,
      providerSettingsStore,
      providerSettingsService,
    ].join("\n");

    expect(providerSettingsPage).toContain("Provider key setup is not enabled in this beta");
    expect(providerSettingsPage).toContain("future encrypted");
    expect(providerSettingsPage).toContain("API key fields are not persisted in localStorage or sessionStorage");
    expect(providerSettingsPage).not.toContain('type="password"');
    expect(providerSettingsPage).not.toContain("setApiKey");
    expect(providerSettingsPage).not.toContain("setProviderKey");
    expect(providerSettingsService).not.toContain("apiKey:");
    expect(providerSettingsService).not.toContain("providerKey:");
    expect(providerSettingsService).not.toContain("plaintextKey");
    expect(providerSettingsService).not.toContain("replacementPlaintextKey");
    expect(combinedProviderSource).not.toContain("localStorage.setItem");
    expect(combinedProviderSource).not.toContain("sessionStorage.setItem");
    expect(combinedProviderSource).not.toContain("Provider connected");
    expect(combinedProviderSource).not.toContain("Verified connection");
  });

  test("credits remains planning-only without fake wallet billing or get-credits mutation", () => {
    const creditsPage = readSource("src/pages/CreditsPage.tsx");
    const creditsStore = readSource("src/store/creditsStore.ts");
    const creditsService = readSource("src/services/creditsService.ts");
    const combinedCreditsSource = [creditsPage, creditsStore, creditsService].join("\n");

    expect(creditsPage).toContain("Credits are not enabled yet");
    expect(creditsPage).toContain("planning-only in this beta");
    expect(creditsPage).toContain("No live balance, refill");
    expect(creditsPage).toContain("ledger mutation exists yet");
    expect(creditsPage).toContain("No live credit balance, ledger, or remaining-credit value");
    expect(combinedCreditsSource).not.toMatch(/\bgetCredits\s*[:=(]/);
    expect(combinedCreditsSource).not.toContain("buyCredits");
    expect(combinedCreditsSource).not.toContain("createCheckout");
    expect(combinedCreditsSource).not.toContain("checkoutSession");
    expect(combinedCreditsSource).not.toContain("walletBalance");
    expect(combinedCreditsSource).not.toContain("mutateLedger");
  });

  test("phase55b does not expand backend auth runtime or expose frontend service role env", () => {
    const backendAuthRuntimeSources = [
      "backend/routes/auth.ts",
      "backend/routes/account.ts",
      "backend/auth/jwtProviderVerificationStrategy.ts",
      "backend/auth/jwtVerificationConfiguration.ts",
      "src/services/auth/authRuntimeService.ts",
      "src/services/auth/supabaseAuthClient.ts",
      "src/store/authStore.ts",
    ].map(readSource).join("\n");

    expect(backendAuthRuntimeSources).not.toContain("phase55b");
    expect(backendAuthRuntimeSources).not.toContain("VITE_SUPABASE_SERVICE_ROLE");
    expect(backendAuthRuntimeSources).not.toContain("VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE");
    expect(backendAuthRuntimeSources).not.toContain("localStorage.setItem");
    expect(backendAuthRuntimeSources).not.toContain("sessionStorage.setItem");
    expect(backendAuthRuntimeSources).not.toContain("app_metadata");
    expect(backendAuthRuntimeSources).not.toContain("platform_admin");

    for (const forbiddenPattern of forbiddenSecretLikePatterns) {
      expect(backendAuthRuntimeSources).not.toMatch(forbiddenPattern);
    }
  });
});
