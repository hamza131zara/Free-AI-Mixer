# Staging Deployment Readiness

## Purpose

This checklist prepares Free AI Mixer for a controlled staging/private-beta deployment. It does not deploy anything, configure SMTP, add secrets, enable public launch, or change runtime behavior.

Private beta is not public launch. Staging readiness means the team can manually verify account/auth flows and honest product boundaries in a stable environment before inviting a small tester group.

Use [Staging Environment Example](./staging-env-example.md) as a placeholder-only reference for required environment names. Use [Staging Manual Smoke Runbook](./staging-manual-smoke-runbook.md) for the human browser smoke. Use [Private Beta Tester Invite Pack](./private-beta-tester-invite-pack.md) for controlled tester communication. Use [Private Beta Release Candidate Checklist](./private-beta-release-candidate-checklist.md) before treating a staging build as ready for controlled tester review. These docs must never contain real secrets.

## Staging Publish Dry Run

The staging publish dry run is a manual readiness rehearsal, not a deployment command and not public launch approval.

Before any tester invitation:

- Confirm the staging frontend and backend URLs are stable.
- Confirm frontend variables contain only public client config.
- Confirm backend secrets are server-only.
- Confirm no service-role key exists in frontend config or `VITE_*` variables.
- Run the manual staging smoke checklist below.
- Run the private beta go/no-go checklist before inviting testers.
- Stop if any secret, tokenized link, fake product state, or public-launch claim appears.

## Required Staging URLs

- Stable frontend URL for the staging app.
- Stable backend URL for the staging API.
- Supabase Auth redirect allow-list entries for the staging frontend origin.
- Redirect allow-list entries for:
  - `/login`
  - `/signup`
  - `/reset-password`

Local Vite proxy behavior is local-development convenience only and must not be treated as staging routing.

## Required Environment Names

Backend auth and workspace runtime:

- `FREE_AI_MIXER_AUTH_RUNTIME_ENABLED`
- `FREE_AI_MIXER_AUTH_PROVIDER`
- `FREE_AI_MIXER_AUTH_ISSUER`
- `FREE_AI_MIXER_AUTH_AUDIENCE`
- `FREE_AI_MIXER_AUTH_JWKS_URI`
- `FREE_AI_MIXER_AUTH_JWT_KEY_MODE`
- `FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS`
- `FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED`

Backend Supabase database and service-role runtime:

- `FREE_AI_MIXER_ENABLE_SUPABASE_DB`
- `FREE_AI_MIXER_DB_PROVIDER`
- `FREE_AI_MIXER_SUPABASE_URL`
- `FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`

Frontend public Supabase Auth runtime:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Opt-in real auth smoke:

- `FREE_AI_MIXER_RUN_REAL_AUTH_SMOKE`
- `FREE_AI_MIXER_REAL_AUTH_SMOKE_EMAIL`
- `FREE_AI_MIXER_REAL_AUTH_SMOKE_PASSWORD`

Do not commit real values for any of these names. Do not create `VITE_*SERVICE_ROLE*` variables.

## Manual Verification Checklist

- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- `npm.cmd run test:e2e -- tests/e2e/phase37-private-beta-publish-readiness.spec.ts` passes.
- `npm.cmd run test:e2e -- tests/e2e/phase38-staging-deployment-readiness.spec.ts` passes.
- Public landing and mixer pages load without requiring the backend.
- Login works for an approved, verified staging tester account.
- `/account/bootstrap` completes or fails closed with a public-safe state.
- `/auth/session` returns backend-derived session truth.
- Selected protected account routes remain auth/workspace-gated:
  - `/project-library/projects`
  - `/project-library/history`
  - `/provider-settings/status`
  - `/credits/status`
- Provider Settings remains pre-live and fail-closed for BYOK/provider key storage.
- Credits and billing remain non-live unless separately verified.
- Export/artifact delivery does not show fake downloads, fake signed URLs, fake artifacts, or fake success.
- Admin analytics remain readiness-only and not publicly unlocked.

## Auth Email And Custom SMTP

Custom SMTP must be manually verified before serious tester onboarding. Built-in Supabase email can rate-limit repeated signup and password reset testing.

Use approved staging test accounts only. Do not use personal, admin, customer, or production owner accounts for smoke testing.

Never paste confirmation links, recovery links, URL hashes, passwords, JWTs, service-role keys, SMTP credentials, or screenshots containing tokenized URLs into docs, issue reports, logs, or chat.

## Product Honesty Gates

Staging must preserve these truths:

- BYOK remains pre-live and fail-closed.
- Credits and billing remain non-live unless a separate signed-off runtime phase verifies them.
- Generation/export account runtime is not public-SaaS-ready.
- Public artifact delivery remains gated by production auth, RLS, storage readiness, and explicit approval.
- Admin analytics remain readiness-only.
- No fake projects, provider connections, credit balances, downloads, signed URLs, artifacts, usage metrics, progress, or success states are allowed.

## Stop Criteria

Stop staging/private-beta preparation and return to internal smoke only if:

- A service-role key appears in frontend config, `VITE_*` env, docs, tests, logs, or screenshots.
- Real secrets, SMTP credentials, JWTs, passwords, confirmation links, recovery links, or URL hashes are committed or shared.
- Public pages require auth unexpectedly.
- Protected pages show fake authenticated access.
- Provider Settings claims live BYOK storage or fake verified provider connections.
- Credits or billing claim live balances, ledger mutation, checkout, or subscriptions without separate verification.
- Export/artifact surfaces show fake downloads, fake signed URLs, fake artifacts, or fake success.
- Admin analytics appear publicly unlocked.
- Public/open beta or production launch is implied without manual go/no-go approval.
