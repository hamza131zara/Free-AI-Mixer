# Private Beta First Tester Monitoring

## Purpose

This document defines the manual monitoring process for the first approved Free AI Mixer private beta tester session.

First tester monitoring is manual and reviewer-owned. Private beta monitoring is not public launch monitoring.

This document does not add automatic analytics, fake dashboards, fake metrics, fake success state, monitoring backend routes, analytics API routes, database tables, dashboard UI, deployment automation, or public launch approval.

Monitor only approved staging/private-beta testers.

Do not collect or store secrets, provider keys, SMTP credentials, tokens, JWTs, webhook secrets, service-role keys, private env values, passwords, tokenized auth links, or recovery links.

Use [Private Beta First Tester Feedback Review](./private-beta-first-tester-feedback-review.md) to classify first-session feedback before any patch planning.

## First Tester Monitoring Checklist

Run this checklist for the first approved tester session:

- Confirm launch decision record exists.
- Confirm staging URL.
- Confirm commit hash.
- Confirm approved tester account.
- Confirm tester invite sent manually.
- Monitor first login.
- Monitor auth/session behavior.
- Monitor email/custom SMTP issues.
- Monitor protected route access.
- Monitor credits/status honesty.
- Monitor BYOK/provider settings fail-closed behavior.
- Monitor project/history honest state.
- Monitor export/artifact no fake downloads/no fake artifacts/no fake success.
- Monitor admin/readiness-only boundaries.
- Confirm feedback intake received or tester knows how to report.

## First 24-Hour Cadence

For the first 24 hours after the first approved tester starts:

- First tester login check.
- Same-day feedback review.
- Blocker/security triage immediately.
- Daily triage summary.
- Hold/pause decision if needed.
- Review feedback for secrets or tokenized links before sharing internally.
- Keep patch planning manual and reviewed.

## Stop And Pause Criteria

Pause tester access and return to manual triage if any of these occur:

- Secret exposure.
- Service-role exposure.
- Broken auth/session.
- Email/SMTP failure blocking tester onboarding.
- Fake billing/credits.
- Fake downloads/artifacts/signed URLs.
- Admin exposure.
- Staging outage.
- Tester access leak.
- Serious privacy/security report.

## Monitoring Note Template

Use this template for manual notes:

```text
Tester ID placeholder:
Account email placeholder if safe:
Commit hash placeholder:
Staging URL placeholder:
Time window placeholder:
Pages tested:
Observed issues:
Severity:
Pause/go/hold recommendation:
Follow-up patch phase placeholder:
Reviewer sign-off placeholder:
```

Do not fill this template with secrets, provider keys, SMTP credentials, tokens, JWTs, webhook secrets, service-role keys, private env values, passwords, tokenized auth links, recovery links, or private screenshots.

## Product Honesty Boundaries

First tester monitoring must preserve:

- BYOK remains pre-live/fail-closed.
- Credits/billing remain non-live unless separately verified.
- Export/artifact delivery remains honest with no fake downloads, no fake signed URLs, no fake artifacts, and no fake success.
- Admin/analytics remains readiness-only.
- No fake analytics, fake dashboards, fake metrics, fake monitoring status, fake projects, fake provider connections, fake credit balances, fake usage metrics, fake artifacts, fake downloads, fake progress, or public launch claims.

## Related Documents

- [Private Beta Launch Decision Record](./private-beta-launch-decision-record.md)
- [Private Beta Final Manual Launch Runbook](./private-beta-final-manual-launch-runbook.md)
- [Private Beta Controlled Tester Account Dry Run](./private-beta-controlled-tester-account-dry-run.md)
- [Private Beta Launch Control And Tester Access Gate](./private-beta-launch-control.md)
- [Private Beta Feedback Intake](./private-beta-feedback-intake.md)
- [Private Beta First Tester Feedback Review](./private-beta-first-tester-feedback-review.md)
- [Private Beta Issue Triage And Patch Planning](./private-beta-issue-triage-patch-planning.md)
- [Private Beta Go/No-Go Checklist](./private-beta-go-no-go-checklist.md)
