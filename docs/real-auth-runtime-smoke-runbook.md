# Real Auth Runtime Smoke Runbook

Phase 25 adds an operational runbook and an opt-in real auth smoke test for the Phase 24 account bootstrap foundation. It does not change auth runtime behavior, signup behavior, bearer attachment, generation, exports, billing, credits mutations, admin access, event/audit persistence, or analytics.

Before inviting remote testers, use this smoke together with [the controlled private beta go/no-go checklist](./private-beta-go-no-go-checklist.md).

## Current Runtime Scope

Phase 24 is the signed-off real auth foundation:

- `POST /account/bootstrap` verifies a bearer token through the backend JWT boundary.
- The backend creates or reuses the mapped `app_users` row from the verified Supabase subject.
- The backend creates or reuses one default `Personal Workspace` and an active owner membership when the user has no active workspace.
- `/auth/session` remains read-only and backend-authoritative.
- Login can use Supabase password auth, then refresh backend session truth.
- Signup remains verification-first and must not claim the app account or workspace is ready.
- Bearer attachment is limited to `/project-library/projects`, `/project-library/history`, `/provider-settings/status`, and `/credits/status`.

## Required Backend Auth Env

Use placeholders only in committed files. Real values belong in local or deployment secret stores.

```bash
FREE_AI_MIXER_AUTH_RUNTIME_ENABLED=1
FREE_AI_MIXER_AUTH_PROVIDER=jwt
FREE_AI_MIXER_AUTH_ISSUER=https://your-project.supabase.co/auth/v1
FREE_AI_MIXER_AUTH_AUDIENCE=authenticated
FREE_AI_MIXER_AUTH_JWKS_URI=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
FREE_AI_MIXER_AUTH_JWT_KEY_MODE=remote_jwks
FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=RS256
FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED=1
```

## Required Backend Supabase DB Env

The service-role key is backend-only. Never create any `VITE_*SERVICE_ROLE*` env var.

```bash
FREE_AI_MIXER_ENABLE_SUPABASE_DB=1
FREE_AI_MIXER_DB_PROVIDER=supabase
FREE_AI_MIXER_SUPABASE_URL=https://your-project.supabase.co
FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=backend-service-role-key-from-secret-store
```

## Required Frontend Public Auth Env

The anon key is public and used only for frontend auth. It must not be a service-role key.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

## Password Reset Redirect Setup

Phase 27 added password reset and account recovery UX. The real auth smoke does not automate password reset, but beta environments must still configure the Supabase Auth redirect allow-list before testers use recovery flows.

Add the app origin, login, signup, and reset routes to the Supabase Auth redirect allow-list for each local, staging, and production beta environment.

Local app and auth route examples:

```text
http://localhost:5173
http://localhost:5173/login
http://localhost:5173/signup
http://localhost:5173/reset-password
```

If Vite is configured to run on another local port, add the same route set for that port. Do not assume `5173` when the dev server prints a different URL.

Staging and production beta examples should use the real app domain routes, for example:

```text
https://your-beta-domain.example
https://your-beta-domain.example/login
https://your-beta-domain.example/signup
https://your-beta-domain.example/reset-password
```

Do not paste keys, tokens, passwords, JWTs, anon keys, service-role keys, confirmation links, recovery links, or URL hashes into docs, chat, screenshots, logs, or issue reports. Password reset uses Supabase Auth only. The app does not store reset tokens, raw Supabase users, or raw Supabase sessions. After updating a password, the user signs in again normally.

## Auth Email Delivery And Custom SMTP

Supabase built-in email delivery can rate-limit repeated signup and password reset testing. For broader tester onboarding, configure custom SMTP manually in the Supabase dashboard before inviting more testers.

Custom SMTP setup is operational, not application code. Do not commit SMTP hosts, usernames, passwords, API keys, or real sender secrets. See `docs/auth-email-custom-smtp-onboarding.md`.

When manually testing email flows:

- Use a dedicated verified smoke user or pre-confirmed tester account with a known temporary password.
- Request signup and reset emails sparingly.
- Use only the newest confirmation or recovery email.
- Treat confirmation and recovery URLs as tokenized secrets.
- If a link is expired, reused, or opened on the wrong local/staging URL, request a fresh email instead of debugging with a shared tokenized URL.

## Opt-In Smoke Env

The real auth smoke is disabled unless the explicit opt-in flag is set.

```bash
FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE=1
FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL=dedicated-verified-test-user@example.com
FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD=dedicated-test-user-password
```

Use a dedicated verified test user. Do not use a personal account, admin account, customer account, or production owner account.

Prefer a pre-confirmed smoke user with a known password. The smoke should not depend on signup email delivery.

## How To Run

Run the smoke only from a trusted local or staging shell with the required env loaded:

```bash
npm.cmd run test:e2e -- tests/e2e/phase25-real-auth-runtime-smoke.spec.ts
```

The command does not set `FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE`; the operator must set it intentionally.

## What The Smoke Does

When enabled, the smoke:

- Signs in with the dedicated verified Supabase test user through public anon auth.
- Reads the access token ephemerally.
- Calls `POST /account/bootstrap`.
- Calls `GET /auth/session`.
- Verifies backend session truth is authenticated.
- Verifies selected protected account/status routes work with the bearer.
- Verifies public routes remain accessible without bearer.
- Reuses existing bootstrap rows on repeated runs.

The smoke may create or reuse an `app_users` row, a `Personal Workspace`, and an active owner membership for the dedicated test user.

## Expected Success States

Expected success is:

- `POST /account/bootstrap` returns `account_bootstrap_complete`.
- `GET /auth/session` returns `authenticated_session`.
- Selected protected routes return authenticated, truthful, non-live account/status payloads.
- Public routes remain accessible without bearer.

## Expected Fail-Closed States

Safe failures include:

- Missing opt-in flag: test is skipped.
- Missing env: test fails before remote calls with only env key names.
- Invalid credentials: test fails without printing password or token.
- Unverified email: bootstrap returns `email_verification_required`.
- Multiple active memberships: bootstrap returns `workspace_bootstrap_blocked`; active workspace selection remains deferred.
- Backend auth or Supabase DB config missing: bootstrap/session fails closed.

## Manual Recovery Guidance

Do not add automatic cleanup to the smoke. If the dedicated test user becomes ambiguous or blocked:

- Inspect that user's `app_users`, `workspaces`, and `workspace_memberships` rows manually in the staging Supabase project.
- Keep exactly one active membership for the smoke user until active workspace selection exists.
- Prefer a fresh dedicated smoke user if the prior user was used for manual experiments.
- Do not delete broad account/workspace data from a smoke test.

## What The Smoke Does Not Test

The smoke does not:

- Automate signup.
- Create real users by default.
- Delete real Supabase data.
- Automate password reset; run password reset manually with the private beta checklist.
- Verify OAuth.
- Unlock admin.
- Exercise generation, export rendering, billing checkout, billing webhook, credits ledger mutation, event/audit persistence, or analytics.
- Prove production launch readiness.

## Why Signup Is Not Automated

Signup can create real Supabase users and orphaned provider accounts if email delivery, verification, or downstream bootstrap fails. Phase 25 keeps signup manual and verification-first until a separately audited cleanup and test-user lifecycle plan exists.

## Why Cleanup Is Not Automatic

The bootstrap path is intentionally idempotent. Automatic cleanup would add destructive real-data behavior to a smoke test and could hide important operational states. Cleanup, if ever needed, should be manual and limited to a dedicated smoke account in a non-production environment.

## Deferred Items

- Active workspace selection.
- Automated password reset smoke.
- OAuth.
- Transactional account/workspace bootstrap.
- Event/audit persistence wiring.
- Admin analytics activation.
- Vite bundle-size/performance hardening.
