# Private Beta Release Candidate Checklist

## Purpose

This checklist decides whether the current staging/private beta build is safe to treat as a private beta release candidate.

Private beta RC is not public launch. RC candidate means ready for controlled tester review only.

This document does not deploy anything, approve public launch, add release automation, configure SMTP, change runtime behavior, or create fake RC-approved status.

Use [Private Beta Launch Control And Tester Access Gate](./private-beta-launch-control.md) after the RC decision and before sending tester access.

Use [Private Beta Controlled Tester Account Dry Run](./private-beta-controlled-tester-account-dry-run.md) before inviting real testers.

Use [Private Beta Final Manual Launch Runbook](./private-beta-final-manual-launch-runbook.md) only after RC, launch control, and controlled tester account dry-run are complete.

## Required Checks Before RC

All required checks must pass before a build can be treated as a private beta RC candidate:

- Manual staging smoke must pass.
- `npm.cmd run typecheck` must pass.
- `npm.cmd run build` must pass.
- `npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts` must pass.
- Phase 37 private beta publish readiness checks must be complete.
- Phase 38 staging deployment readiness checks must be complete.
- Phase 39 staging publish dry-run safety checks must be complete.
- Phase 40 staging manual smoke and tester invite checks must be complete.
- Phase 41 feedback intake checks must be complete.
- Phase 42 issue triage and patch planning checks must be complete.
- Custom SMTP/email delivery must be manually verified before serious tester onboarding.
- Tester invite pack must be ready.
- Feedback intake must be ready.
- Issue triage/patch planning must be ready.

## Security And Privacy RC Gates

The RC candidate must preserve:

- No committed secrets or real env values.
- No SMTP credentials.
- No service-role exposure.
- No service-role key in frontend config or `VITE_*` env.
- No provider API keys.
- No JWT secrets.
- No webhook secrets.
- No frontend Supabase DB access.
- No frontend Supabase storage access.
- No fake auth/session.
- No tokenized confirmation or recovery links in docs, logs, screenshots, or reports.

## Product Honesty RC Gates

The RC candidate must preserve:

- No fake credits/billing.
- Credits and billing remain non-live unless separately verified.
- BYOK remains pre-live/fail-closed.
- Provider Settings remain honest.
- No fake provider connection state.
- No fake provider verification.
- Export/artifact delivery remains honest:
  - no fake downloads
  - no fake signed URLs
  - no fake artifacts
  - no fake success
- Public artifact delivery remains gated by production auth/RLS/storage readiness.
- Admin/analytics remains readiness-only.
- No fake projects, usage metrics, public launch claims, or production readiness claims.

## Operational RC Gates

- Stable staging frontend URL is known.
- Stable staging backend URL is known.
- Supabase redirect allow-list matches the staging frontend URL.
- Approved tester accounts are ready.
- Tester invite instructions are ready.
- Launch control and tester access gate are ready.
- Controlled tester account dry-run is ready.
- Private beta final manual launch runbook is ready.
- Feedback intake channel is ready and secret-safe.
- Issue triage and patch planning are ready.
- Stop/rollback owner is known.
- Known limitations have been reviewed before invitation.

## Stop And Rollback Criteria

Do not mark a build as private beta RC if any of these occur:

- Secret exposure.
- Service-role exposure.
- Broken auth/session.
- Fake billing/credits.
- Fake downloads/artifacts.
- Fake signed URLs.
- Public launch claim.
- Fake RC-approved status.
- Major staging outage.
- Custom SMTP/email delivery is required for onboarding but has not been manually verified.
- Tester feedback channel or issue triage process is not ready.

Rollback options remain manual:

- Hold the RC decision.
- Return to internal smoke only.
- Pause tester invitations.
- Disable or delete affected tester users in Supabase.
- Reset tester passwords if account access is uncertain.
- Keep git rollback separate from Supabase auth/database cleanup.
- Do not run destructive database cleanup by default.

## Final Manual RC Decision Template

Use this template for the manual RC decision:

```text
Candidate date:
Commit hash placeholder:
Staging URL placeholder:
Tester group placeholder:

Pass/fail checklist:
- Manual staging smoke:
- Typecheck:
- Build:
- post181 launch QA smoke:
- Phase 37 readiness:
- Phase 38 readiness:
- Phase 39 readiness:
- Phase 40 readiness:
- Phase 41 feedback intake:
- Phase 42 issue triage/patch planning:
- Custom SMTP/email delivery manual verification:
- Tester invite pack:
- Feedback intake:
- Issue triage/patch planning:
- No committed secrets/env values:
- No service-role exposure:
- No frontend Supabase DB/storage access:
- Product honesty gates:
- Stop/rollback owner:

Known limitations:

Decision: go / no-go / hold

Reviewer sign-off placeholder:
```

Do not fill this template with secrets, real passwords, tokenized auth links, service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, or private env values.
