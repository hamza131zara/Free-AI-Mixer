# Launch Block 7 Final QA, Private Beta, And Public Launch Matrix

## Purpose

Launch Block 7 is the final launch decision boundary for Free AI Mixer.

This document does not deploy, launch, enable billing, enable real providers, enable platform-paid generation, enable video providers, add public/signed/download URLs, or approve public launch by itself.

Private beta is controlled testing, not public launch.

## Final QA Checklist

- Git status is clean.
- Commit hash is recorded.
- Block 0-7 focused tests pass.
- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes.
- Staging frontend URL is stable.
- Staging backend URL is stable.
- `/monitoring/health`, `/monitoring/readiness`, and `/monitoring/deployment-readiness` return safe JSON.
- Supabase Auth redirect allow-list is checked for staging.
- Service-role key is backend-only and absent from frontend env, docs, logs, screenshots, and tests.
- Protected routes reject unauthenticated users.
- Provider settings, BYOK, credits, and billing copy remains honest.
- Mock image generation works in the approved mock/local path.
- Real video generation remains unavailable.
- Artifact access has no unsafe URL, path, ref, base64, or byte exposure.
- Feedback intake and triage owner are ready.
- Decision is recorded as `go`, `hold`, or `no-go`.

## Private Beta Go/No-Go Boundary

Private beta may proceed only as a controlled tester review after a manual go decision.

Go requires:

- Approved tester list.
- Dedicated tester accounts.
- Real auth smoke with a dedicated tester.
- Custom SMTP/email status known and documented.
- Feedback intake ready.
- Issue triage owner ready.
- Rollback/pause owner ready.
- First tester monitoring plan ready.

Hold or no-go is required if auth, email, secret handling, artifact access, provider honesty, billing honesty, monitoring, rollback, or tester support is not ready.

## Public Launch Blocker Matrix

| Area | Public launch status | Required before public launch |
| --- | --- | --- |
| Real provider generation | Blocked | Provider billing/quota/access must be broadly verified and safely gated. |
| Platform-paid generation | Blocked | Billing, credits, platform provider credentials, reservation, and refund paths must be audited. |
| Real video providers | Blocked | Video providers, polling, verification, storage, and playback must be audited. |
| Billing/credits/subscriptions | Blocked | Live payment processor, checkout, webhooks, ledger, and subscriptions must be approved. |
| Public/signed/download URLs | Blocked unless separately audited | Delivery policy, auth, expiry, and user-triggered behavior must be approved. |
| Production auth/RLS/storage | Manual verification required | Hosted Supabase policies, buckets, auth redirects, and migrations must be reviewed/applied manually. |
| SMTP/onboarding/support | Manual verification required | Email delivery, support intake, privacy review, and legal copy must be complete. |
| Admin/legal/privacy | Manual final review required | Admin exposure, analytics, privacy, terms, and support surfaces must be signed off. |
| Public launch approval | Manual only | Private beta go is not public launch approval. |

## Production Smoke Checklist

- Verify frontend public env contains only public values.
- Verify backend server-only env contains secrets only in backend secret storage.
- Verify production CORS uses explicit allowed origins and does not allow arbitrary origins.
- Verify remote migrations are manually reviewed and applied; no app startup auto-apply.
- manual migration review/apply remains required; no app startup auto-apply is allowed.
- Verify protected routes fail closed for unauthenticated users.
- Verify no direct frontend Supabase DB/storage calls.
- Verify real providers remain quota/billing/access-gated.
- Verify platform-paid generation remains disabled.
- Verify video providers remain unavailable.
- Verify billing/subscriptions are not live unless separately approved.
- Verify downloads/public delivery are not promised unless separately audited.

## Rollback Checklist

- Pause tester invitations.
- Revert frontend hosting to the previous approved build.
- Revert backend hosting to the previous approved revision.
- Disable risky runtime gates before retesting.
- Revoke or disable affected tester accounts if needed.
- Keep database rollback separate from git rollback.
- Do not run destructive database cleanup by default.
- Record the rollback owner and follow-up action.

## Status And Product Honesty Copy

Use this meaning in UI/docs/support responses:

- Private beta is controlled testing, not public launch.
- Some features are intentionally unavailable.
- BYOK real generation depends on user provider billing/quota/access.
- Platform-paid generation is not enabled.
- Real video generation is not enabled.
- Billing/subscriptions are not live unless separately approved.
- Downloads/public delivery are not promised unless separately audited.

## Stop Conditions

Stop or hold launch if any of the following occur:

- Service-role, provider, billing, JWT, SMTP, webhook, or other secret exposure.
- Tokenized auth links or recovery links appear in docs, screenshots, logs, or reports.
- Fake provider, billing, credits, video, artifact, download, progress, or success claim.
- Real provider calls occur from Codex/test automation.
- Platform-paid generation or live billing becomes enabled unexpectedly.
- Public/signed/download URLs appear without separate approval.
- Direct frontend Supabase DB/storage access appears.
- CORS allows arbitrary production origins.
- Remote migrations are auto-applied by app startup.
- Private beta is described as public launch.
