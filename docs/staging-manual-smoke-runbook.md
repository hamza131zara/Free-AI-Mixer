# Staging Manual Smoke Runbook

## Purpose

This runbook guides a human staging smoke test before controlled private beta tester invitations. It is manual, controlled, and not public launch approval.

Private beta is not public launch. Do not invite testers until the private beta go/no-go checklist passes.

## Preconditions

- Stable staging frontend URL is available.
- Stable staging backend URL is available.
- Supabase project and redirect allow-list are configured for staging.
- Approved staging tester account exists.
- Custom SMTP/email delivery status is known.
- Custom SMTP must be manually verified before serious tester onboarding.
- Use the newest auth email only.
- Check spam, junk, or promotions folders during email testing.
- Do not share confirmation links, recovery links, URL hashes, passwords, JWTs, service-role keys, SMTP credentials, provider API keys, webhook secrets, or screenshots containing tokenized URLs.

## Automated Checks Before Manual Smoke

Run these locally before the browser smoke:

```powershell
npm.cmd run test:e2e -- tests/e2e/phase39-staging-publish-dry-run-safety.spec.ts
npm.cmd run test:e2e -- tests/e2e/phase38-staging-deployment-readiness.spec.ts
npm.cmd run test:e2e -- tests/e2e/phase37-private-beta-publish-readiness.spec.ts
npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts
npm.cmd run typecheck
npm.cmd run build
```

For a real staging auth smoke, follow `docs/real-auth-runtime-smoke-runbook.md` and keep it opt-in only.

Use [Private Beta Feedback Intake](./private-beta-feedback-intake.md) for feedback channels, templates, triage categories, stop criteria, and communication rules during or after the manual smoke.

Use [Private Beta Release Candidate Checklist](./private-beta-release-candidate-checklist.md) after the manual smoke passes and before treating the build as a private beta RC candidate.

## Manual Browser Smoke Checklist

### Public Shell

- Open the landing page.
- Confirm it loads without requiring sign-in.
- Open the mixer page.
- Confirm the mixer shell loads and does not claim public launch readiness.

### Auth And Recovery

- Visit login.
- Confirm login copy is honest about confirmed accounts and email delivery.
- Visit signup.
- Confirm signup is verification-first and does not promise instant email delivery.
- Visit forgot password.
- Confirm neutral anti-enumeration copy and newest-link guidance.
- Visit reset password.
- Confirm expired/reused/wrong-port guidance.
- Test password reset sparingly unless custom SMTP is manually verified.

### Account Session And Bootstrap

- Log in with an approved staging tester account.
- Confirm successful login redirects to dashboard.
- Confirm dashboard shows backend-derived account/session status.
- Confirm account bootstrap/setup status is clear.
- Retry account setup only if the UI says setup is incomplete.
- Log out and confirm authenticated UI state clears.

### Protected Routes

- Visit Projects.
- Confirm projects are empty or honest and do not show fake user data.
- Visit History.
- Confirm export history is empty or honest and does not show fake rows.
- Visit Provider Settings.
- Confirm BYOK/provider key storage remains pre-live and fail-closed.
- Visit Credits.
- Confirm credits/status remains honest and non-live unless separately verified.
- Confirm selected protected route behavior remains auth/workspace-gated:
  - `/project-library/projects`
  - `/project-library/history`
  - `/provider-settings/status`
  - `/credits/status`

### Export And Artifact Honesty

- Confirm export/artifact surfaces do not show fake downloads.
- Confirm export/artifact surfaces do not show fake signed URLs.
- Confirm export/artifact surfaces do not show fake artifacts.
- Confirm export/artifact surfaces do not show fake success.

### Admin And Analytics

- Visit Admin only as a readiness page.
- Confirm admin/analytics remain readiness-only and not publicly unlocked.
- Confirm no real metrics, users, jobs, revenue, moderation queues, or support backlog are shown.

## Stop And Rollback Criteria

Stop the staging smoke and return to internal-only testing if:

- Any secret appears in frontend config, docs, logs, screenshots, issue reports, or `VITE_*` variables.
- A tester is asked to share a password, confirmation link, recovery link, URL hash, JWT, or tokenized screenshot.
- Public pages require auth unexpectedly.
- Protected pages show fake authenticated access.
- Provider Settings claims live BYOK storage or fake connected/verified providers.
- Credits or billing claim live balances, checkout, ledger mutation, subscriptions, or refill behavior without separate verification.
- Export/artifact surfaces show fake downloads, fake signed URLs, fake artifacts, or fake success.
- Admin/analytics appear publicly unlocked.
- Any page claims public launch or production readiness without the manual go/no-go checklist.

Rollback options:

- Pause tester invitations.
- Return to the internal smoke user only.
- Disable or delete affected tester users in Supabase.
- Reset tester passwords if account access is uncertain.
- Disable password reset testing temporarily if email rate limits occur.
- Keep git rollback separate from Supabase auth/database cleanup.
