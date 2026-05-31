# Private Beta Feedback Intake

## Purpose

This document defines the safe feedback intake process for controlled Free AI Mixer private beta testers.

Private beta feedback intake is not a public support launch. It does not add in-app feedback submission, backend feedback routes, database tables, live email sending, automation, or public launch approval.

All feedback must be reviewed manually before it becomes implementation work.

## Approved Feedback Channels

Use only channels approved by the project owner or staging coordinator:

- Private beta feedback email placeholder.
- Approved form placeholder.
- Manual tracker placeholder.

Do not invent new channels during the beta. Do not ask testers to paste secrets into chat, issue trackers, docs, forms, screenshots, or videos.

## Do Not Send Secrets

Testers and reviewers must never send or store:

- API keys.
- Provider keys.
- SMTP credentials.
- Access tokens.
- Refresh tokens.
- Reset tokens.
- Service-role keys.
- JWTs.
- Webhook secrets.
- Private environment values.
- Passwords.
- Full confirmation links.
- Recovery links.
- URL hashes from auth flows.
- Screenshots or videos that show tokenized URLs.

If a report contains a secret or tokenized link, stop normal triage, redact the material, and treat the report as sensitive.

## Feedback Template

Use this template for every private beta report:

```text
Tester name or approved tester ID:
Test account email, if safe:
Browser/device/OS:
Staging URL or environment label, without secrets:
Page/feature tested:
Expected result:
Actual result:
Steps to reproduce:
Screenshot/video optional, with secret redaction warning:
Severity:
Blocker/non-blocker:
Auth/email issue category:
Billing/credits honesty issue category:
BYOK/provider settings issue category:
Export/artifact honesty issue category:
Admin/readiness issue category:
```

Screenshots and videos are optional. Before sending them, crop or blur passwords, tokens, confirmation links, recovery links, URL hashes, private env values, provider keys, SMTP credentials, service-role keys, and any other secrets.

## Triage Categories

Classify each report with one or more categories:

- Blocker.
- Security/privacy.
- Auth/session.
- Email/SMTP.
- Credits/billing.
- BYOK/provider settings.
- Generation/mixer.
- Export/artifact.
- UI/UX.
- Docs/copy.

## Stop And Rollback Criteria

Pause tester onboarding and return to internal-only smoke if any severe finding appears:

- A secret, token, recovery link, confirmation link, URL hash, provider key, SMTP credential, service-role key, JWT, webhook secret, or private env value is exposed.
- Testers are asked to submit tokenized links or secrets.
- Authentication or account bootstrap fails for multiple approved tester accounts.
- Protected pages show fake authenticated access.
- Credits, billing, BYOK/provider settings, export/artifact delivery, admin, or analytics imply live behavior that is not separately verified.
- Export/artifact surfaces show fake downloads, fake signed URLs, fake artifacts, or fake success.
- Admin or analytics appears publicly unlocked.
- Any beta communication implies public launch or production launch approval.

Rollback options remain manual:

- Pause invitations.
- Return to the internal smoke user only.
- Disable or delete affected tester users in Supabase.
- Reset tester passwords when account access is uncertain.
- Stop password reset testing if email rate limits occur.
- Keep git rollback separate from Supabase auth/database cleanup.
- Do not run destructive database cleanup by default.

## Tester Communication Flow

After feedback is received:

- Acknowledge receipt manually.
- Redact secrets before triage or sharing.
- Ask for sanitized reproduction steps when needed.
- Classify severity and triage category.
- Tell the tester whether the issue is a blocker, known limitation, confusing copy, or fix candidate.
- Avoid promising a fix date, production launch date, or public launch readiness.
- Keep follow-up messages focused on visible behavior, safe screenshots, and non-secret environment labels.

## Known Limitations Testers Should Understand

Private beta testers should understand these current limits before reporting them as defects:

- BYOK/provider key storage remains pre-live and fail-closed.
- Provider verification is not live.
- Credits and billing remain non-live unless separately verified.
- Generation/export account runtime is not public-SaaS-ready.
- Export/artifact delivery must not show fake downloads, fake signed URLs, fake artifacts, or fake success.
- Admin analytics remain readiness-only.
- Active workspace selection is deferred.
- OAuth is deferred.
- Public launch is blocked until a separate go/no-go approval.

## Manual Review Before Implementation

Feedback does not automatically become an implementation phase.

Use [Private Beta Issue Triage And Patch Planning](./private-beta-issue-triage-patch-planning.md) before converting accepted feedback into patch work.

Use [Private Beta Release Candidate Checklist](./private-beta-release-candidate-checklist.md) before inviting testers to review a new RC candidate build.

Use [Private Beta Launch Control And Tester Access Gate](./private-beta-launch-control.md) to confirm access remains limited to approved testers and approved staging accounts.

Before implementation:

- Review the report manually.
- Remove or redact sensitive material.
- Confirm whether the issue is reproducible.
- Check whether it is already a known limitation.
- Prioritize security/privacy and blocker reports first.
- Convert accepted work into a narrow implementation prompt with explicit safety boundaries.
