# Private Beta Launch Decision Record

## Purpose

This document records a manual private beta launch decision for Free AI Mixer.

Launch decision record is manual and reviewer-owned. Private beta launch decision is not public launch approval.

The decision record does not deploy anything, invite testers automatically, add release automation, add deployment automation, create invite APIs, create waitlist APIs, create tester databases, change auth runtime, or create fake launched/approved state.

## Required Decision Inputs

Record these inputs before choosing go, no-go, or hold:

- Git status clean.
- Commit hash placeholder.
- Staging URL placeholder.
- Tester group placeholder.
- Typecheck result.
- Build result.
- post181 QA result.
- Phase 37-46 readiness result.
- Staging manual smoke result.
- RC checklist result.
- Controlled tester dry-run result.
- SMTP/email verification result or documented limitation.
- Feedback intake readiness.
- Issue triage/patch planning readiness.
- Known limitations.
- Stop/rollback owner.

## Decision Choices

The decision must be one of:

- go
- no-go
- hold

## Decision Template

Use this template for the manual decision record:

```text
Date/time placeholder:
Reviewer placeholder:
Commit hash placeholder:
Staging URL placeholder:
Tester group placeholder:
Decision: go/no-go/hold
Reasons:
Known limitations:
Required follow-up actions:
Rollback/pause owner:
Sign-off placeholder:
```

Do not fill this template with real passwords, tokenized auth links, service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, private env values, or other secrets.

## Go Decision Rules

A go decision only allows controlled private beta tester review:

- Only approved testers.
- Only staging/private beta URL.
- No public signup claim.
- Feedback intake ready.
- Monitoring cadence ready.
- Tester invite pack ready.
- Issue triage/patch planning ready.
- Stop/rollback owner known.

A go decision is not public launch approval and does not deploy anything.

## No-Go And Hold Rules

Choose no-go or hold if any of these are present:

- Blocker/security/auth/email/product-honesty issue.
- Fake billing/credits.
- Fake downloads/artifacts/signed URLs.
- Service-role/secret exposure.
- Admin exposure.
- Staging outage.
- Tester access leak.
- Custom SMTP/email delivery is required for onboarding but not manually verified.
- Feedback intake or issue triage is not ready.

## Product Honesty Gates

The decision record must preserve:

- No fake auth/session.
- No fake credits/billing.
- BYOK/provider settings remain pre-live/fail-closed.
- Export/artifact delivery has no fake downloads, no fake signed URLs, no fake artifacts, and no fake success.
- Admin/analytics remains readiness-only.
- Public artifact delivery remains gated by production auth/RLS/storage readiness.
- No fake projects, provider connections, credit balances, usage metrics, exports, artifacts, downloads, progress, or public launch claims.

## Post-Decision Recordkeeping

After the decision:

- Store decision in docs/manual tracker only.
- Do not store secrets.
- Do not store private tokens/env values.
- Do not store passwords, tokenized confirmation links, recovery links, service-role keys, SMTP credentials, provider keys, JWTs, or webhook secrets.
- Do not publish as public launch announcement.
- Do not treat go as deployment approval.
- Do not mark private beta launched/approved in runtime state.
- If decision is go, send tester invites only through the approved manual launch and tester invite process.
- If decision is no-go or hold, document reasons and required follow-up actions before another review.

## Related Documents

- [Private Beta Final Manual Launch Runbook](./private-beta-final-manual-launch-runbook.md)
- [Private Beta Controlled Tester Account Dry Run](./private-beta-controlled-tester-account-dry-run.md)
- [Private Beta Launch Control And Tester Access Gate](./private-beta-launch-control.md)
- [Private Beta Release Candidate Checklist](./private-beta-release-candidate-checklist.md)
- [Private Beta Go/No-Go Checklist](./private-beta-go-no-go-checklist.md)
- [Private Beta Feedback Intake](./private-beta-feedback-intake.md)
- [Private Beta Issue Triage And Patch Planning](./private-beta-issue-triage-patch-planning.md)
- [Staging Manual Smoke Runbook](./staging-manual-smoke-runbook.md)
- [Staging Deployment Readiness](./staging-deployment-readiness.md)
