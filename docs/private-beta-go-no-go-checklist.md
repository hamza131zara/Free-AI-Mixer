# Controlled Private Beta Staging And Go/No-Go Checklist

## Purpose

This checklist decides whether Free AI Mixer can invite controlled private beta testers. It is docs-only and does not configure deployment, SMTP, auth runtime, backend routes, provider storage, credits, billing, generation, export, or public launch behavior.

The beta is account/auth focused. It validates real Supabase auth, backend session authority, account bootstrap, password reset, logout, protected account pages, and fail-closed states.

## Beta Readiness Matrix

| Scope | Status | Required controls |
| --- | --- | --- |
| Local/manual dry run | Ready | Local frontend/backend running, Supabase redirects match local URL, manual QA checklist complete. |
| 1 internal smoke user | Ready | Dedicated verified smoke user, opt-in real auth smoke passes, no personal/admin account use. |
| 3-5 trusted testers | Ready with restrictions | Stable staging or controlled shared environment, redirect allow-list verified, manual QA complete, pre-confirmed tester accounts preferred, sparse password reset testing unless custom SMTP is configured. |
| 5-15 testers | Blocked | Requires staging hardening, custom SMTP configured and verified, repeatable tester onboarding/revocation process, and support triage process. |
| Public/open beta | Blocked | Requires broader production readiness, live product runtime decisions, security hardening, billing/credits/BYOK/export readiness, and explicit public launch approval. |

## Staging Readiness Checklist

Complete this before inviting any remote tester.

- Stable frontend URL exists.
- Stable backend URL exists.
- Frontend uses the correct public Supabase URL and anon key.
- Backend uses the correct Supabase URL.
- Backend has the service-role key only in backend secret storage.
- No service-role key is present in frontend config or any `VITE_*` env var.
- Supabase Auth redirect allow-list includes the staging app origin.
- Supabase Auth redirect allow-list includes `/login`.
- Supabase Auth redirect allow-list includes `/signup`.
- Supabase Auth redirect allow-list includes `/reset-password`.
- CORS or deployment routing allows the frontend to reach the backend account/auth/protected routes.
- Local Vite proxy assumptions are not mistaken for staging routing.
- Real auth smoke runbook has been followed for the target environment.
- Real auth smoke command is available:

```powershell
npm.cmd run test:e2e -- tests/e2e/phase25-real-auth-runtime-smoke.spec.ts
```

- No secrets, passwords, JWTs, service-role keys, SMTP credentials, confirmation links, recovery links, or URL hashes are pasted into docs, tests, logs, screenshots, or issue reports.

## Local Dry-Run Checklist

Complete this before staging or tester invitations.

- Signup shows verification-first behavior.
- Email confirmation works through the newest confirmation email.
- Login works for a verified account.
- Successful login redirects to the dashboard.
- Dashboard shows backend-derived account bootstrap and session status.
- Logout clears authenticated UI state.
- Forgot password uses neutral anti-enumeration copy.
- Reset password works and requires fresh login.
- Expired, reused, or wrong-port reset link guidance is visible and understandable.
- Provider Settings clearly says provider key/BYOK storage is non-live.
- Credits clearly says balances, billing, refill, and ledger mutation are non-live.
- Protected route behavior is truthful for signed-out, unavailable, forbidden, and workspace-required states.
- Public pages remain available without auth.
- Mobile or narrow viewport quick check passes for login, dashboard, and recovery pages.
- No page claims fake downloads, credits, provider connections, projects, artifacts, usage metrics, billing, or public launch readiness.
- Tester reports do not include passwords, full confirmation links, recovery links, URL hashes, tokens, or secrets.

## Tester Invitation Checklist

Use this before sending invitations.

- Use dedicated tester accounts.
- Prefer pre-confirmed tester accounts with known temporary passwords for the first dry run.
- Do not use personal, admin, customer, or production owner accounts.
- Tell testers this is an account/auth beta only.
- Tell testers password reset testing should be sparse unless custom SMTP is configured.
- Tell testers to use only the newest confirmation or recovery email.
- Tell testers not to share passwords, full confirmation links, recovery links, or URL hashes.
- Tell testers to report visible messages, page names, approximate time, and screenshots with tokenized links cropped or hidden.
- Confirm a rollback path exists before invitations are sent.

## Go/No-Go Matrix

### Go For 3-5 Trusted Testers

All of the following must pass:

- Staging or controlled shared environment is stable.
- Real auth smoke passes for the target environment.
- Redirect allow-list matches the app URL testers use.
- At least one dedicated verified smoke user works.
- Tester accounts are dedicated and preferably pre-confirmed.
- Login, dashboard redirect, account bootstrap/status, logout, forgot password, and reset password have passed manual QA.
- Provider Settings and Credits remain visibly non-live.
- Public routes remain public.
- Protected routes remain auth/workspace-gated.
- No secrets or tokenized links are included in docs, tests, logs, screenshots, or issue reports.

### Block More Than 5 Testers

Any of the following blocks expansion beyond 5 testers:

- Custom SMTP is not configured and verified.
- Built-in Supabase email rate limits are affecting onboarding or recovery.
- Tester invitation/revocation process is not repeatable.
- Support triage asks testers to paste tokenized links or secrets.
- Staging URL or redirect settings are unstable.
- Password reset flow cannot be verified reliably.
- Multiple tester accounts get stuck in workspace/account bootstrap states without clear recovery.

### Block Public/Open Beta

Any of the following blocks public/open beta:

- BYOK/provider key storage is not live.
- Credits and billing are not live.
- Generation/export account runtime is not public-SaaS-ready.
- Public artifact delivery, signed URLs, or download behavior are not production-approved.
- Active workspace selection is not implemented.
- OAuth remains deferred.
- Event/audit persistence and analytics remain deferred.
- Security/privacy checklist is incomplete.
- Public launch has not received explicit go/no-go approval.

## Product Honesty Checklist

The beta must clearly preserve these truths:

- Provider Settings is non-live.
- Credits are non-live.
- BYOK storage is not live.
- Billing is not live.
- Generation/export account runtime is not public-ready.
- No fake projects.
- No fake provider connections.
- No fake credit balances.
- No fake downloads.
- No fake artifacts.
- No fake usage metrics.
- No fake progress or success states.

## Security And Privacy Checklist

The beta must preserve:

- No raw JWT storage.
- No raw Supabase session storage.
- No raw Supabase user storage.
- No reset token storage.
- No frontend Supabase DB usage.
- No frontend Supabase storage usage.
- No service-role key in frontend config.
- No `VITE_*SERVICE_ROLE*` env var.
- No trusted `x-user-id` shortcut.
- No trusted `x-workspace-id` shortcut.
- No fake auth, workspace, or admin state.
- No provider keys or raw API keys.
- No tokenized confirmation or recovery links in docs, logs, screenshots, or reports.
- No public artifact delivery or signed/download URLs by default.

## Disable And Rollback Guidance

If beta access becomes unsafe:

- Pause new invitations.
- Return to internal smoke user only.
- Disable or delete tester users in Supabase.
- Reset tester passwords if account access is uncertain.
- Disable password reset testing temporarily if email rate limits occur.
- Disable auth/workspace/Supabase DB runtime gates for the affected environment if needed.
- Keep git rollback separate from Supabase auth/database cleanup.
- Do not run destructive database cleanup by default.

Useful runtime gates for a controlled environment:

```text
FREE_AI_MIXER_AUTH_RUNTIME_ENABLED=0
FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED=0
FREE_AI_MIXER_ENABLE_SUPABASE_DB=0
```

If auth, staging, or email delivery fails, stop tester onboarding and rerun the internal smoke path before retrying invitations.
