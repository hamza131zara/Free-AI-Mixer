# Local and Staging Auth Runtime Runbook

This runbook records the complete local/staging auth runtime checklist for Free AI Mixer. It is operational documentation only. It does not add auth behavior, backend routes, Supabase configuration, provider key storage, credits, billing, generation, export runtime, or public launch readiness.

Use this when browser signup, login, account bootstrap, or `/auth/session` look inconsistent between frontend, backend, and Supabase.

## Runtime Truths

- Frontend Supabase env missing means signup and login should show frontend auth unavailable.
- Supabase password login can work while Free AI Mixer backend auth is still not configured.
- JWT env alone is not enough for account bootstrap.
- Account bootstrap also requires backend Supabase DB, backend-only service-role access, and workspace runtime.
- Missing Supabase DB, service-role, or workspace runtime env can cause bootstrap unavailable / 503 instead of an authenticated app session.
- `/auth/session` becomes authenticated only after the backend can verify the JWT and map the Supabase subject to a bootstrapped app user/workspace.
- No secrets, JWTs, tokens, refresh tokens, passwords, service-role keys, SMTP credentials, or tokenized links should be committed or pasted into logs.

## Frontend Auth Env

These values belong in ignored local env or deployment client config. The anon key is public client config, not a service-role key.

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key-from-secret-store
```

If these are missing or stale, the frontend Supabase auth wrapper should fail closed and login/signup should remain honest instead of inventing a session.

Restart Vite after changing `VITE_*` values. Browser storage is origin-scoped, so clear site data for both `http://localhost:5173` and `http://127.0.0.1:5173` if you switched origins during testing.

## Backend JWT Env

These values belong in backend-only local env or deployment secret/config stores.

```text
FREE_AI_MIXER_AUTH_RUNTIME_ENABLED=1
FREE_AI_MIXER_AUTH_PROVIDER=jwt
FREE_AI_MIXER_AUTH_ISSUER=https://your-project.supabase.co/auth/v1
FREE_AI_MIXER_AUTH_AUDIENCE=authenticated
FREE_AI_MIXER_AUTH_JWKS_URI=https://your-project.supabase.co/auth/v1/.well-known/jwks.json
FREE_AI_MIXER_AUTH_JWT_KEY_MODE=remote_jwks
FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS=ES256
```

`FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS` must match the current Supabase access token algorithm. The current verified Supabase token algorithm for this environment is `ES256`, so local/staging backend verification should allow `ES256`. If Supabase changes the token signing algorithm later, update the backend allow-list intentionally and rerun the auth smoke.

Issuer and audience comparisons are exact. The issuer should match the token issuer exactly, for example `https://your-project.supabase.co/auth/v1`, and the audience should match `authenticated`.

## Backend Supabase DB And Workspace Env

JWT env alone does not create or load app account state. Account bootstrap needs the backend repository/runtime layer too.

```text
FREE_AI_MIXER_ENABLE_SUPABASE_DB=1
FREE_AI_MIXER_DB_PROVIDER=supabase
FREE_AI_MIXER_SUPABASE_URL=https://your-project.supabase.co
FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY=backend-only-service-role-key-from-secret-store
FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED=1
```

The service-role key is backend-only. Never create `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY`, or any other `VITE_*SERVICE_ROLE*` variable. Never paste the service-role key into browser devtools, frontend code, docs, screenshots, logs, issue reports, chat, or test snapshots.

## Expected Manual Flow

1. Start the backend with complete JWT, Supabase DB, service-role, and workspace runtime env.
2. Start the frontend with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Sign up with Supabase Auth or use an already confirmed test account.
4. Confirm the email if needed.
5. Log in with Supabase password auth.
6. The frontend gets the Supabase access token ephemerally through the Supabase auth wrapper.
7. The frontend calls `POST /account/bootstrap` with a bearer token.
8. The backend verifies the JWT, checks email verification through backend-only Supabase admin access, creates/reuses `app_users`, creates/reuses the default Personal Workspace, and creates/reuses owner membership.
9. The frontend refreshes `GET /auth/session`.
10. `/auth/session` returns `authenticated_session` only after backend account/workspace bootstrap is complete.

## Failure Mapping

- Missing frontend Supabase env: login/signup should show frontend auth unavailable.
- Supabase login succeeds but JWT env is missing or mismatched: backend session/bootstrap should fail closed.
- JWT env is present but Supabase DB/service-role env is missing: account bootstrap should be unavailable rather than fake account setup.
- Workspace runtime missing: bootstrap can return bootstrap unavailable / 503 because workspace authority is required.
- Wrong allowed algorithm, issuer, audience, or JWKS URI: backend JWT verification should reject the bearer safely.
- Multiple active workspace memberships: workspace selection remains blocked until a future active workspace selection phase.

## BYOK Boundary

BYOK API key input, storage, replacement, removal, test connection, encrypted vault runtime, and provider SDK calls are intentionally not live. Provider Settings must remain readiness-only until secure backend vault/storage and authorization are implemented.

Do not add raw provider API key fields, browser key storage, direct provider calls, fake connected state, or fake verification success while debugging auth.

For local/staging provider key schema preparation, use [BYOK Provider Keys Schema Apply Runbook](./byok-provider-keys-schema-apply-runbook.md). That runbook is local/staging-only and must not be used as a production migration approval.

## Credits Boundary

Credits, get-credits, refill, checkout, subscription, wallet mutation, ledger mutation, and billing runtime are intentionally not live. Credits pages must remain planning/readiness-only until a separately verified ledger and billing runtime exists.

Do not add fake balances, fake wallet state, fake refill buttons, fake checkout, fake ledger entries, or fake credit grants while debugging auth.

## Safe Verification Commands

Run local automated checks without real Supabase credentials:

```text
npm.cmd run test:e2e -- tests/e2e/phase55b-auth-runtime-regression-runbook.spec.ts
npm.cmd run test:e2e -- tests/e2e/phase55-authenticated-account-pages-ux-smoke.spec.ts
npm.cmd run test:e2e -- tests/e2e/post181-launch-qa-smoke.spec.ts
npm.cmd run typecheck
npm.cmd run build
git status --short
```

Run the opt-in real auth smoke only from a trusted local/staging shell with the required real env already loaded:

```text
npm.cmd run test:e2e -- tests/e2e/phase25-real-auth-runtime-smoke.spec.ts
```

Do not put real env values in committed docs or test source.
