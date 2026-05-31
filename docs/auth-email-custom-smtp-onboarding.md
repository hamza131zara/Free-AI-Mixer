# Auth Email, Custom SMTP, And Tester Onboarding

## Purpose

Phase 35 documents the operational email path for controlled private beta auth testing. It does not configure SMTP in code, change Supabase Auth behavior, or automate signup, confirmation, password reset, or tester cleanup.

Free AI Mixer currently uses Supabase Auth for signup verification and password recovery. Supabase built-in email delivery is acceptable for tiny dry runs, but serious tester onboarding requires a manually configured custom SMTP provider in the Supabase dashboard.

Do not promise instant email delivery. Testers may need to wait and check spam, junk, or promotions folders before requesting another confirmation or recovery email.

Before inviting remote testers, pair this email checklist with [the controlled private beta go/no-go checklist](./private-beta-go-no-go-checklist.md).

## Custom SMTP Setup Is Manual

Configure custom SMTP manually in Supabase. Do not commit SMTP credentials, provider passwords, tokens, or real hostnames to the repository.

Before enabling custom SMTP, decide and record:

- SMTP provider choice.
- Sender and from address.
- Reply-to address, if different.
- Domain ownership and verification process.
- DNS records required by the provider, such as SPF, DKIM, DMARC, and provider verification records.
- Provider rate limits and daily send limits.
- Test email process for signup confirmation and password recovery.
- Rollback or disable process if delivery fails.

Keep SMTP credentials in Supabase or deployment secret storage only. Do not add SMTP credentials to frontend `VITE_*` env vars.

## Redirect URL Checklist

Supabase Auth redirect settings must match the app URL testers actually use.

Required local URLs:

```text
http://localhost:5173
http://localhost:5173/login
http://localhost:5173/signup
http://localhost:5173/reset-password
```

If Vite runs on another local port, add the same route set for that port. Do not assume `5173` if the dev server prints a different URL.

Required staging and production beta URLs:

```text
https://your-beta-domain.example
https://your-beta-domain.example/login
https://your-beta-domain.example/signup
https://your-beta-domain.example/reset-password
```

Use placeholders in docs. Real domains belong in environment-specific runbooks or deployment records, not generic repository examples.

## Rate Limits And Email Link Rules

Supabase built-in email delivery can rate-limit repeated signup and password reset testing. Custom SMTP may also have provider-specific limits. Email confirmation and password reset delivery depend on the configured Supabase Auth email provider or custom SMTP provider for the target environment.

Tester guidance:

- Request signup or password reset emails sparingly.
- Wait before repeated requests if an email is delayed.
- Check spam, junk, and promotions folders before requesting another email.
- Use only the newest verification or recovery email.
- Older confirmation and recovery links can expire, become single-use, or stop working after a newer email is requested.
- If a link was reused, expired, or opened on the wrong local/staging URL, request a fresh email.

Do not implement custom OTP or code confirmation in this phase. OTP/code confirmation remains deferred.

## Tokenized Link Safety

Confirmation and recovery links can contain temporary tokens in the URL or URL hash. Treat these links as secrets.

Never paste or share:

- Confirmation URLs.
- Recovery URLs.
- URL hashes from auth pages.
- Screenshots that expose full auth links.
- Tokens, JWTs, passwords, anon keys, service-role keys, or SMTP credentials.

When reporting issues, testers should share the page, visible safe message, approximate time, and whether they used signup, login, forgot password, reset password, or logout. They should not share tokenized links.

## Tester Onboarding Flow

For controlled private beta, use 3-5 trusted testers only. Use approved local or staging test accounts only; do not use personal, admin, production owner, or unapproved customer accounts.

Recommended flow:

1. Create a dedicated tester account or invite a tester to create one.
2. Prefer pre-confirmed tester accounts with known temporary passwords for dry runs when email delivery itself is not under test.
3. Require email verification before login and account bootstrap.
4. Ask the tester to log in from the app URL that matches the redirect allow-list.
5. Confirm the dashboard shows backend-derived session and workspace state.
6. Test forgot password/reset password sparingly.
7. Ask the tester to log out and log in again after password reset.
8. Ask the tester to visit dashboard, projects, export history, provider settings, credits, and public pages.
9. Ask the tester to report confusing states without sharing secrets or tokenized links.

The beta remains account/auth focused. Testers should not expect real projects, provider key storage, live credits, billing, export delivery, admin analytics, OAuth, or public launch behavior.

## Dedicated Smoke User

Keep a dedicated verified smoke user separate from personal, admin, customer, and production owner accounts.

The real auth smoke may create or reuse:

- An `app_users` row.
- A `Personal Workspace` row.
- An active owner `workspace_memberships` row.

Do not use the smoke user for broad manual experiments. If the smoke user becomes ambiguous, inspect its app user, workspace, and membership rows carefully or create a fresh dedicated smoke user.

## Revocation And Rollback

To remove tester access, prefer Supabase user management:

- Disable the tester user.
- Delete the tester user when appropriate.
- Change or reset the tester password.
- Remove the tester from the beta project if the provider supports it.

Do not run destructive database cleanup by default. Do not delete `app_users`, workspaces, or memberships casually during auth testing. Keep git rollback separate from Supabase data cleanup.

If a secret or tokenized link was shared publicly, rotate the affected secret or revoke the affected auth session immediately.

## Boundaries

This document does not make auth email production-ready by itself. Do not claim production auth email is fully configured unless the environment-specific Supabase Auth email or custom SMTP provider setup has been manually verified.

Still deferred:

- Custom OTP or code confirmation flow.
- Automated signup smoke.
- Automated password reset smoke.
- Public launch email operations.
- OAuth.
- Active workspace selection.
- Real billing, credits ledger, provider key storage, generation/export account runtime, event/audit persistence, and analytics.
