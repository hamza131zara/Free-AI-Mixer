# Controlled Private Beta Readiness Checklist

## Status

Free AI Mixer is ready for a controlled private beta with 3-5 trusted testers only.

This is an account/auth beta, not a public launch. The current beta validates real Supabase authentication, backend session authority, account bootstrap, password reset, logout, protected account page visibility, and fail-closed states.

Use [the controlled private beta go/no-go checklist](./private-beta-go-no-go-checklist.md) before inviting remote testers. The checklist separates local dry runs, one internal smoke user, 3-5 trusted testers, broader tester groups, and public/open beta.

## What Is Ready

- Login with Supabase Auth.
- Signup with verification-first behavior.
- Password reset and account recovery UX.
- Logout and backend session refresh.
- Backend account bootstrap through `/account/bootstrap`.
- Retry account setup from authenticated beta surfaces.
- Protected account page visibility after backend-derived session authority.
- Public route separation from authenticated routes.

## What Is Not Ready

- Real saved projects.
- Provider key or BYOK storage.
- Live credits or billing.
- Generation/export runtime expansion.
- Download or public artifact delivery.
- Active workspace selection.
- Team, invite, or multi-workspace UX.
- OAuth.
- Admin analytics.
- Event/audit persistence wiring.
- Public launch behavior.

## Tester Instructions

Use a dedicated beta test account. Do not use a personal, admin, or production owner account.

If Supabase built-in email delivery is being used, keep signup and password reset testing sparse because provider email rate limits can block repeated requests. Before broader beta, configure and verify custom SMTP manually in Supabase; see `docs/auth-email-custom-smtp-onboarding.md`.

1. Create an account if invited to test signup, or use a pre-confirmed tester account with a known temporary password for dry runs.
2. Verify the account email before continuing.
3. Log in from the app.
4. Check the dashboard account status panel.
5. Use forgot password and reset password once, then wait before requesting more emails.
6. Log out, then log in again with the updated password.
7. Visit protected beta pages: dashboard, projects, export history, provider settings, and credits.
8. Visit public pages without auth and confirm they remain accessible.
9. Report confusing auth, setup, workspace, reset, or unavailable states without sharing passwords, full confirmation links, recovery links, or URL hashes.

Tester expectation warning: this beta is for account/auth readiness only. Testers should not expect real projects, credits, exports, provider keys, billing, admin features, or public launch behavior. The app should not fake any of those states.

## Password Reset Redirect Setup

Supabase Auth redirect allow-list must include the app reset route.

Supabase Auth redirect settings must match the app URL testers actually use. Include login, signup, and reset routes for each local, staging, or production beta origin.

Local app URL:

```text
http://localhost:5173
```

Local login and signup URLs:

```text
http://localhost:5173/login
http://localhost:5173/signup
```

Local reset URL:

```text
http://localhost:5173/reset-password
```

If Vite is configured to use another local port, add that reset route too.

Staging or production beta environments should use the real app domain reset route, for example:

```text
https://your-beta-domain.example/reset-password
```

Password reset uses Supabase Auth only. Free AI Mixer must not store reset tokens, raw Supabase sessions, or raw Supabase user objects. After updating a password, the user signs in again normally.

Confirmation and recovery links can expire, be single-use, or stop working after a newer email is requested. Use only the newest email. Never paste real keys, tokens, tokenized confirmation links, tokenized recovery links, passwords, JWTs, anon keys, or service-role keys into docs, tickets, screenshots, or chat.

## Operational Recovery Notes

Keep the dedicated smoke user separate from personal and admin accounts.

The real auth smoke and beta login path may create or reuse:

- an `app_users` row
- a `Personal Workspace` row
- an active owner `workspace_memberships` row

Do not delete these rows casually. If testing gets stuck, inspect the related app user, workspace, and membership rows carefully before changing anything.

Multiple active workspaces intentionally block active workspace authority until workspace selection exists. For this beta, use single-workspace accounts whenever possible.

Do not run destructive cleanup scripts by default. Prefer disabling a test user or creating a fresh dedicated test account over deleting database rows.

## Disable And Rollback Guidance

If beta access needs to be paused, disable the runtime gates for the affected environment rather than changing application code.

Useful backend gates include:

```text
FREE_AI_MIXER_AUTH_RUNTIME_ENABLED=0
FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED=0
FREE_AI_MIXER_ENABLE_SUPABASE_DB=0
```

Remove tester access by disabling the Supabase user, changing the tester password, or removing the test user from the beta project. Do not rotate staging or production keys casually unless compromise is suspected.

If a secret was shared publicly, rotate it immediately. Keep git rollback separate from Supabase data cleanup so code recovery does not accidentally destroy auth or workspace data.

## Security Checklist

- No token storage.
- No raw Supabase user/session storage.
- No reset token storage.
- No token logs.
- No frontend Supabase DB/storage usage.
- No frontend service-role exposure.
- No `VITE_*SERVICE_ROLE*` env var.
- No Supabase metadata authority for workspace or platform roles.
- No `platform_admin` inference from workspace ownership.
- No admin unlock.
- No bearer leakage to external URLs.
- Public routes remain public.

## Manual QA Checklist

Before inviting testers, run the default-safe smoke and local regression set.

The real auth smoke is skipped by default unless explicitly enabled through the environment documented in `docs/real-auth-runtime-smoke-runbook.md`.

```powershell
npm.cmd run test:e2e -- tests/e2e/phase25-real-auth-runtime-smoke.spec.ts
```

Use the explicit Phase 27 auth files. Do not use `tests/e2e/phase27-*.spec.ts` blindly because older unrelated Phase 27 artifacts may exist.

```powershell
npm.cmd run test:e2e -- tests/e2e/phase27-password-reset-source-boundary.spec.ts tests/e2e/phase27-forgot-password-page.spec.ts tests/e2e/phase27-reset-password-page.spec.ts tests/e2e/phase27-dashboard-account-status.spec.ts tests/e2e/phase27-bootstrap-retry-ux.spec.ts tests/e2e/phase27-logout-session-ux.spec.ts tests/e2e/phase27-no-runtime-expansion.spec.ts
```

```powershell
npm.cmd run test:e2e -- tests/e2e/phase24-account-bootstrap-auth-boundary.spec.ts tests/e2e/phase24-account-bootstrap-idempotency.spec.ts tests/e2e/phase24-account-workspace-auth-contract.spec.ts tests/e2e/phase24-bootstrap-no-platform-admin-inference.spec.ts tests/e2e/phase24-bootstrap-spoofing-regression.spec.ts tests/e2e/phase24-login-runtime-boundary.spec.ts tests/e2e/phase24-no-bearer-leakage-or-token-storage.spec.ts tests/e2e/phase24-no-runtime-expansion.spec.ts tests/e2e/phase24-selected-service-bearer-attachment.spec.ts tests/e2e/phase24-signup-verification-or-deferred.spec.ts tests/e2e/phase24-workspace-membership-bootstrap.spec.ts
```

```powershell
npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts
npm.cmd run typecheck
npm.cmd run build
git status --short
```

Manual browser checks:

1. Confirm signup shows verification-first behavior.
2. Confirm login works for a verified test user.
3. Confirm dashboard account status reflects backend-derived session state.
4. Confirm retry account setup calls the backend path and does not fake readiness on failure.
5. Confirm forgot password uses neutral copy.
6. Confirm reset password returns the user to normal sign-in.
7. Confirm logout clears authenticated UI state.
8. Confirm protected beta pages show honest empty, unavailable, unauthorized, or workspace-blocked states.
9. Confirm public routes remain accessible without auth.
10. Confirm no tester-facing page claims real credits, billing, provider keys, projects, exports, admin analytics, or public launch readiness.
