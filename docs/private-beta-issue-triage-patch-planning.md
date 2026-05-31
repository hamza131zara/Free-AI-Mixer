# Private Beta Issue Triage And Patch Planning

## Purpose

This document defines how Free AI Mixer private beta feedback is classified, reviewed, and converted into safe patch phases.

Private beta issue triage is manual and reviewed. Private beta is not public launch, and feedback intake does not automatically become implementation.

This document does not add an issue tracker, in-app feedback submission, backend issue routes, database tables, automation, deployment, or public launch approval.

## Triage Principles

- Feedback must be reviewed before any code changes.
- Issues must be classified before any patch planning.
- Security/privacy, auth/session, storage, BYOK, billing, credits, export/artifact, and admin/readiness issues need extra caution.
- Do not promise tester-facing fixes before a patch is scoped, implemented, verified, and signed off.
- Do not mark an issue resolved until the relevant patch phase is verified and signed off.
- Do not use fake resolved status, fake progress, fake deployment, or fake public launch readiness.

## Patch Planning Lifecycle

Use the existing project pattern:

1. Audit first for risky issues.
2. Focused implementation.
3. Focused tests.
4. Docs included in the same phase when safe.
5. Commit after verification.
6. Final sign-off.

Risky issues include security/privacy, auth/session, storage, BYOK/provider settings, credits/billing, generation/export runtime, artifact delivery, admin/readiness, and anything that could expose secrets or create fake product state.

## Severity Levels

Use exactly one severity for each issue:

- Blocker.
- Critical.
- High.
- Medium.
- Low.
- Docs/copy only.

## Triage Categories

Use one or more categories:

- Security/privacy.
- Auth/session.
- Email/SMTP.
- Credits/billing honesty.
- BYOK/provider settings.
- Generation/mixer.
- Export/artifact honesty.
- Admin/readiness.
- UI/UX.
- Docs/copy.

## Stop And Rollback Criteria

Stop tester onboarding, pause patch work, or return to internal-only smoke if any of these appear:

- Secret exposure.
- Service-role exposure.
- Broken auth/session.
- Fake billing/credits.
- Fake downloads/artifacts.
- Public launch claim.
- Major staging outage.

Escalate security/privacy and secret exposure findings before normal triage. Redact sensitive material before sharing issue details.

## Patch Planning Template

Use this template before any implementation prompt:

```text
Issue summary:
Source feedback link/reference placeholder:
Severity:
Category:
Affected page/feature:
Reproduction steps:
Expected result:
Actual result:
Proposed safe phase:
Files likely affected:
Tests required:
Rollback notes:
Strict exclusions:
```

The source feedback link/reference must be a placeholder or approved internal reference. Do not paste tokenized links, passwords, private environment values, service-role keys, provider keys, SMTP credentials, JWTs, webhook secrets, or other secrets.

## Grouping Rules

- Group docs/copy-only issues together when safe.
- Group low-risk wording or checklist fixes only when they share the same safety boundary.
- Separate security/privacy issues.
- Separate auth/session issues.
- Separate storage, BYOK/provider settings, billing/credits, generation/export, artifact delivery, and admin/readiness runtime issues.
- Do not mix risky runtime work with docs-only cleanup.
- Do not combine unrelated tester reports just to reduce phase count.

## Patch Promise Rules

Private beta patches are manual and reviewed.

- No automatic deployment.
- No automatic tester-facing fix promises.
- No fake resolved status.
- No fake issue tracker state.
- No fake patch automation.
- Public launch remains manually gated.

Tester communication should say whether an issue is being reviewed, accepted for planning, known limitation, or blocked by a deferred feature. Avoid promising a date or public launch outcome.

## Manual Review Before Patch Creation

Before writing an implementation prompt:

- Confirm the report is reproducible or clearly actionable.
- Confirm the issue is not already a known limitation.
- Confirm the severity and category.
- Confirm whether an audit-only phase is needed first.
- Confirm affected files and strict exclusions.
- Confirm tests that prove the patch without expanding runtime behavior.
- Confirm rollback notes.

Accepted issues should become narrow phase prompts with explicit allowed scope, strict exclusions, verification commands, and final sign-off expectations.

Use [Private Beta Release Candidate Checklist](./private-beta-release-candidate-checklist.md) after patch verification and before treating a staging build as ready for controlled tester review.
