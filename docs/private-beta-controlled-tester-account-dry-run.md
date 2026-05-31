# Private Beta Controlled Tester Account Dry Run

## Purpose

This document defines the manual dry-run for an approved staging/private beta tester account before inviting real testers.

Controlled tester account dry-run is manual. Private beta is not public launch.

This document does not create tester accounts automatically, change auth runtime, add tester databases, add invite/waitlist APIs, add release automation, or create fake tester account success.

## Account Safety Rules

- Use approved staging/private-beta tester accounts only.
- Do not use personal accounts for tester dry-run.
- Do not use admin accounts for tester dry-run.
- Do not use service-role accounts for tester dry-run.
- Do not share service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, tokens, passwords, tokenized auth links, or private env values with testers.
- Custom SMTP/email delivery must be manually verified before serious onboarding.
- If email delivery is not verified, document the limitation and avoid broad password-reset testing.

## Tester Account Dry-Run Checklist

Run this checklist manually before inviting real testers:

- Create/approve staging tester account manually.
- Confirm email delivery or document email limitation.
- Login smoke.
- Logout smoke.
- Password reset smoke if SMTP is verified.
- Dashboard/account bootstrap check.
- Protected route access check.
- Credits/status honesty check.
- Provider settings/BYOK fail-closed check.
- Projects/history honest empty state check.
- Export/artifact no fake downloads/no fake artifacts/no fake success check.
- Admin/analytics blocked or readiness-only check.
- Feedback intake link/process shared.
- Access pause/revoke path documented.

## Product Honesty Gates

The tester account dry-run must preserve:

- BYOK remains pre-live/fail-closed.
- Credits/billing remain non-live unless separately verified.
- Export/artifact delivery remains honest with no fake downloads, no fake signed URLs, no fake artifacts, and no fake success.
- Admin/analytics remains blocked or readiness-only.
- No fake projects, fake provider connections, fake credit balances, fake artifacts, fake downloads, fake usage metrics, or public launch claims.

## Stop And Rollback Criteria

Stop the dry-run and hold tester invitations if any of these occur:

- Tester cannot authenticate.
- Email delivery is broken or unknown.
- Secret exposure.
- Service-role exposure.
- Fake billing/credits.
- Fake downloads/artifacts/signed URLs.
- Admin area exposed.
- Public launch claim.
- Tester access leak.

Rollback options remain manual:

- Hold the tester account dry-run decision.
- Pause tester invitations.
- Revoke or stop access for affected tester accounts.
- Disable or delete tester users in Supabase when needed.
- Reset tester passwords if account access is uncertain.
- Return to the internal smoke user only.
- Keep git rollback separate from Supabase auth/database cleanup.
- Do not run destructive database cleanup by default.

## Dry-Run Result Template

Use this template for the manual dry-run result:

```text
Tester account placeholder:
Staging URL placeholder:
Commit hash placeholder:
SMTP verified yes/no:
Auth/session pass/fail:
Protected routes pass/fail:
Product honesty pass/fail:
Feedback intake pass/fail:
Decision: go / no-go / hold
Reviewer sign-off placeholder:
```

Do not fill this template with real passwords, tokenized auth links, service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, private env values, or other secrets.

## After The Dry Run

If the dry run passes:

- Keep tester access limited to the approved tester list.
- Send only the approved private beta invite text.
- Share the feedback intake process.
- Remind testers not to send secrets or tokenized auth links.

If the dry run fails:

- Do not invite testers.
- Record the failure without secrets.
- Use private beta issue triage and patch planning before any fix.
- Rerun the dry-run checklist after the fix is verified.

