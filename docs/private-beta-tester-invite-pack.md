# Private Beta Tester Invite Pack

## Purpose

This pack gives safe wording and operating rules for inviting a small group of trusted private beta testers.

Private beta is not public launch. Tester onboarding remains manual and controlled.

Use [Private Beta Final Manual Launch Runbook](./private-beta-final-manual-launch-runbook.md) before sending approved tester invitations.

## Who Can Be Invited

- Invite only approved staging testers.
- Start with 3-5 trusted testers after the manual staging smoke passes.
- Use approved staging tester accounts only.
- Prefer pre-confirmed tester accounts with known temporary passwords for the first dry run.
- Do not use personal, admin, customer, production owner, or shared team accounts.
- Do not expand beyond 5 testers until staging, custom SMTP, support process, and onboarding controls are hardened.

## Email And Account Guidance

- Email confirmation and password reset delivery depend on the configured auth email or custom SMTP provider.
- Custom SMTP must be manually verified before serious tester onboarding.
- Built-in Supabase email can rate-limit repeated signup and password reset testing.
- Ask testers to check spam, junk, or promotions folders.
- Ask testers to use only the newest confirmation or recovery email.
- Ask testers not to share passwords, full confirmation links, recovery links, URL hashes, access tokens, screenshots containing tokenized URLs, or secrets.

## Suggested Invite Copy

```text
You are invited to a controlled Free AI Mixer private beta.

This is not a public launch. The beta focuses on account access, login, password recovery, dashboard/account status, and honest protected-page boundaries.

Use only the staging account we approve for you. Do not use personal/admin accounts.

If you test signup or password reset, email delivery may not be instant. Check spam, junk, or promotions folders and use only the newest email. Never share full confirmation links, recovery links, URL hashes, passwords, or screenshots containing tokenized URLs.

Please report feedback only through the approved private beta feedback channel. Include visible messages, page names, browser/device, approximate time, expected result, actual result, and cropped screenshots that do not include secrets or tokenized links.
```

## Feedback Intake

Use [Private Beta Feedback Intake](./private-beta-feedback-intake.md) for approved channels, report templates, triage categories, stop criteria, and tester communication rules.

Use [Private Beta Issue Triage And Patch Planning](./private-beta-issue-triage-patch-planning.md) after feedback is reviewed and before any patch work is promised or implemented.

Use [Private Beta Launch Control And Tester Access Gate](./private-beta-launch-control.md) before sending approved tester access.

Use [Private Beta Controlled Tester Account Dry Run](./private-beta-controlled-tester-account-dry-run.md) to verify an approved staging/private beta tester account before inviting real testers.

Testers must never send API keys, provider keys, SMTP credentials, service-role keys, JWTs, webhook secrets, passwords, full confirmation links, recovery links, URL hashes, private env values, or screenshots/videos containing tokenized URLs.

## What Testers Should Try

- Open landing page.
- Open mixer page.
- Sign in with the approved staging tester account.
- Confirm dashboard/account status is understandable.
- Test logout and sign in again.
- Test forgot password/reset password sparingly unless custom SMTP is verified.
- Visit Projects and confirm empty/honest project state.
- Visit History and confirm empty/honest export-history state.
- Visit Provider Settings and confirm BYOK is not live.
- Visit Credits and confirm credits/billing are not live.
- Report confusing copy, broken navigation, auth failures, or unexpected states.

## Known Limitations To Tell Testers

- Provider Settings/BYOK remains pre-live and fail-closed.
- Credits and billing remain non-live unless separately verified.
- Generation/export account runtime is not public-SaaS-ready.
- Export/artifact delivery must not show fake downloads, fake signed URLs, fake artifacts, or fake success.
- Admin analytics remain readiness-only.
- Active workspace selection, OAuth, live billing, credits ledger, live BYOK, production artifact delivery, public launch, and broad onboarding are deferred.

## Stop Criteria During Tester Onboarding

Pause invitations and return to internal smoke only if:

- Testers receive confusing tokenized-link instructions.
- Testers are asked to paste secrets, passwords, confirmation links, recovery links, or URL hashes.
- Email rate limits block recovery testing.
- Login/account bootstrap fails for multiple approved accounts.
- Protected pages show fake authenticated access.
- Provider Settings, Credits, Export History, Projects, or Admin imply live behavior that is not separately verified.
- Any page or tester communication implies public launch.

## Revocation And Rollback

- Disable or delete tester users in Supabase if access must be removed.
- Reset tester passwords if an account may be compromised.
- Pause password reset testing if email rate limits occur.
- Pause all invitations if staging or auth becomes unstable.
- Do not run destructive database cleanup by default.
- Do not rotate production or staging keys unless compromise is suspected.
- If a secret is exposed, rotate that secret and treat screenshots/logs as sensitive.
