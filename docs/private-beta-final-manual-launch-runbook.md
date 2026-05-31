# Private Beta Final Manual Launch Runbook

## Purpose

This runbook defines the final manual launch procedure for inviting approved Free AI Mixer private beta testers.

Private beta final manual launch is not public launch. Launch is controlled, manual, and reviewer-approved only.

This runbook does not deploy anything, add automatic deployment, add release automation, enable public signup, approve public launch, create invite APIs, create waitlist APIs, create tester databases, change auth runtime, or create fake private-beta launched status.

## Required Pre-Launch Gates

All gates must be reviewed before sending approved tester invitations:

- Git status clean.
- Current commit hash recorded.
- `npm.cmd run typecheck` passed.
- `npm.cmd run build` passed.
- `npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts` passed.
- Phase 37 readiness checks complete.
- Phase 38 readiness checks complete.
- Phase 39 readiness checks complete.
- Phase 40 readiness checks complete.
- Phase 41 readiness checks complete.
- Phase 42 readiness checks complete.
- Phase 43 readiness checks complete.
- Phase 44 readiness checks complete.
- Phase 45 readiness checks complete.
- Staging manual smoke complete.
- RC checklist complete.
- Launch control checklist complete.
- Controlled tester account dry-run complete.
- Custom SMTP/email delivery manually verified or limitation documented.
- Tester invite pack ready.
- Feedback intake ready.
- Issue triage/patch planning ready.

## Manual Launch Sequence

Use this sequence only after a manual go decision:

- Confirm staging/private-beta URL.
- Confirm approved tester group.
- Confirm approved staging tester accounts.
- Confirm no service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, tokens, passwords, tokenized auth links, or private env values are shared with testers.
- Send limited tester invite only after go decision.
- Monitor first tester login.
- Monitor auth/email issues.
- Monitor feedback intake.
- Pause launch if stop criteria triggers.

## Product Honesty Gates

The launch procedure must preserve these product truths:

- No fake auth/session.
- No fake credits/billing.
- BYOK/provider settings remain pre-live/fail-closed.
- Projects/history show honest state.
- Export/artifact delivery has no fake downloads, no fake signed URLs, no fake artifacts, and no fake success.
- Admin/analytics remains readiness-only.
- Public artifact delivery remains gated by production auth/RLS/storage readiness.
- No fake projects, provider connections, credit balances, usage metrics, exports, artifacts, downloads, progress, or public launch claims.

## Stop And Rollback Criteria

Stop or hold launch if any of these occur:

- Secret exposure.
- Service-role exposure.
- Broken auth/session.
- Email/SMTP failure that blocks onboarding.
- Fake billing/credits.
- Fake downloads/artifacts/signed URLs.
- Admin area exposed.
- Public launch claim.
- Staging outage.
- Tester access leak.
- Serious security/privacy report.

Rollback options remain manual:

- Pause launch.
- Pause new invitations.
- Revoke or stop access for affected tester accounts.
- Disable or delete tester users in Supabase when needed.
- Reset tester passwords if account access is uncertain.
- Return to internal smoke user only.
- Keep git rollback separate from Supabase auth/database cleanup.
- Do not run destructive database cleanup by default.

## Final Launch Decision Template

Use this template for the final manual launch decision:

```text
Commit hash placeholder:
Staging URL placeholder:
Tester group placeholder:
SMTP verified yes/no:
Smoke result pass/fail:
RC result pass/fail:
Tester dry-run pass/fail:
Known limitations:
Final decision: go / no-go / hold
Reviewer sign-off placeholder:
Timestamp placeholder:
```

Do not fill this template with real passwords, tokenized auth links, service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, private env values, or other secrets.

## Post-Launch Monitoring Checklist

For the first 24 hours after approved tester invitations:

- Monitor first tester login and session refresh.
- Monitor email delivery, confirmation, and password reset reports.
- Monitor feedback intake at the agreed review cadence.
- Review feedback for secrets or tokenized links before sharing internally.
- Triage issues at the agreed issue triage cadence.
- Pause or revoke access when stop criteria appears.
- Send pause/revoke communication when access changes.
- Keep patch planning manual and reviewed.
- Use audit-first handling for risky security, auth, storage, BYOK, billing, export/artifact, or admin issues.
- Do not promise automatic tester-facing fixes.
- Do not mark issues resolved until a verified patch phase is signed off.

## Related Documents

- [Private Beta Go/No-Go Checklist](./private-beta-go-no-go-checklist.md)
- [Private Beta Release Candidate Checklist](./private-beta-release-candidate-checklist.md)
- [Private Beta Launch Control And Tester Access Gate](./private-beta-launch-control.md)
- [Private Beta Controlled Tester Account Dry Run](./private-beta-controlled-tester-account-dry-run.md)
- [Private Beta Tester Invite Pack](./private-beta-tester-invite-pack.md)
- [Private Beta Feedback Intake](./private-beta-feedback-intake.md)
- [Private Beta Issue Triage And Patch Planning](./private-beta-issue-triage-patch-planning.md)
- [Staging Manual Smoke Runbook](./staging-manual-smoke-runbook.md)
- [Staging Deployment Readiness](./staging-deployment-readiness.md)
