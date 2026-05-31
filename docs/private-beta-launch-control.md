# Private Beta Launch Control And Tester Access Gate

## Purpose

This document controls who may enter the Free AI Mixer private beta after a release candidate is reviewed.

Private beta launch control is manual and reviewed. Private beta is not public launch.

This document does not deploy anything, approve production launch, create open public signup, add invite automation, add waitlist automation, add tester-access APIs, add database tables, or create fake tester access success.

Use [Private Beta Controlled Tester Account Dry Run](./private-beta-controlled-tester-account-dry-run.md) to manually verify an approved staging/private beta tester account before sending real tester invitations.

## Launch Control Rules

- Tester access must use an approved tester list.
- Tester access must use approved staging accounts only.
- Use only the staging/private beta URL.
- Do not claim open public signup is available.
- Do not claim automatic invite automation exists.
- Do not claim waitlist approval exists.
- Do not claim tester access succeeded until a human verifies the approved tester account can access the staging/private beta environment.
- Do not approve production launch without manual RC and go/no-go sign-off.

## Launch Control Checklist

Use this checklist before sending tester access:

```text
Current commit hash placeholder:
Staging URL placeholder:
Approved tester group placeholder:
Tester account list placeholder:
SMTP/email verified yes/no:
Auth/session smoke yes/no:
Protected routes checked yes/no:
Credits/billing honesty checked yes/no:
BYOK/provider settings fail-closed checked yes/no:
Export/artifact honesty checked yes/no:
Admin/readiness-only checked yes/no:
Feedback intake ready yes/no:
Triage/patch planning ready yes/no:
Rollback owner placeholder:
Final decision: go / no-go / hold
```

Do not fill this checklist with passwords, tokenized auth links, service-role keys, SMTP credentials, provider keys, JWTs, webhook secrets, private env values, or other secrets.

## Tester Access Gate Rules

- Use only the staging/private beta URL.
- Invite only approved testers.
- Use approved staging/private beta accounts only.
- Revoke or stop access if a blocker, security/privacy issue, auth/session issue, or secret exposure appears.
- Do not share service-role keys or admin secrets with testers.
- Do not share backend admin credentials, SMTP credentials, provider keys, JWTs, webhook secrets, or private env values.
- Testers must not submit provider keys, SMTP credentials, tokens, JWTs, webhook secrets, private env values, passwords, confirmation links, recovery links, or URL hashes.
- Tester reports must use the approved feedback intake channel.
- Tester issues must pass manual triage before patch planning.
- A controlled tester account dry-run must pass before inviting real testers.

## Stop And Rollback Criteria

Pause tester access and return to internal-only smoke if any of these appear:

- Secret exposure.
- Service-role exposure.
- Broken auth/session.
- Fake billing/credits.
- Fake downloads/artifacts/signed URLs.
- Public launch claim.
- Staging outage.
- Tester access leak.

Rollback options remain manual:

- Pause invitations.
- Revoke or stop access for affected tester accounts.
- Disable or delete tester users in Supabase when needed.
- Reset tester passwords if account access is uncertain.
- Return to the internal smoke user only.
- Keep git rollback separate from Supabase auth/database cleanup.
- Do not run destructive database cleanup by default.

## Communication Templates

### Approved Tester Invite

```text
You are approved for the controlled Free AI Mixer private beta.

This is not a public launch. Use only the staging/private beta URL and the approved tester account provided to you.

Do not share passwords, confirmation links, recovery links, URL hashes, tokens, SMTP credentials, provider keys, service-role keys, JWTs, webhook secrets, or private env values.

Please report feedback through the approved feedback channel using visible messages, expected result, actual result, reproduction steps, browser/device/OS, and screenshots only after secrets or tokenized links are cropped or hidden.
```

### Hold/No-Go Notice

```text
Free AI Mixer private beta access is currently on hold.

This is not a public launch. We are pausing tester access while we review staging readiness, auth/session behavior, product honesty boundaries, or operational issues.

Please do not retry signup, password reset, or access links until we send updated instructions.
```

### Access Revoked/Paused Notice

```text
Your Free AI Mixer private beta access has been paused or revoked for now.

This may happen during a staging outage, security/privacy review, auth/session issue, secret exposure concern, or rollback.

Do not share old links, passwords, tokenized URLs, screenshots containing secrets, or account details. We will follow up with safe next steps if access can resume.
```

### Known Limitations Reminder

```text
Reminder: this private beta is not public launch.

Provider Settings/BYOK remains pre-live and fail-closed. Credits and billing are non-live. Export/artifact delivery must not show fake downloads, fake signed URLs, fake artifacts, or fake success. Admin/analytics remains readiness-only.

Please report confusing states, but do not submit provider keys, SMTP credentials, tokens, private env values, or tokenized auth links.
```

## Non-Live Boundaries

Launch control must preserve:

- BYOK remains pre-live/fail-closed.
- Credits/billing remain non-live unless separately verified.
- Export/artifact delivery remains honest with no fake downloads, no fake signed URLs, no fake artifacts, and no fake success.
- Admin/analytics remains readiness-only.
- Public launch remains blocked until separate production readiness and go/no-go approval.
