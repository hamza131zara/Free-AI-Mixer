# BYOK Local Browser Fake-Key Smoke Runbook

This runbook records the local/staging-only browser smoke for BYOK Provider Settings after the backend create/replace/revoke routes and frontend input boundary are available. It is not a production launch checklist and it must use fake placeholder provider keys only.

## Scope

Use this smoke to verify:

- Local Supabase, backend, and frontend can run together.
- A confirmed local/staging tester can log in.
- Provider Settings can save, replace, and remove a fake provider key through the backend.
- Provider Settings can validate the stored fake key through the backend mock/local adapter only when explicitly enabled.
- The browser does not retain the fake key in visible UI, URL, cookies, `localStorage`, or `sessionStorage`.
- Test connection remains disabled unless both mock/local validation env gates are enabled.
- Test connection remains unavailable unless both mock/local validation env gates are enabled.
- No fake connected, verified, or test-passed state appears.

## Required Local Preconditions

- Git status is clean before starting.
- Target environment is local or controlled staging only, never production.
- Local/staging Supabase is running.
- `app_users`, `workspaces`, `workspace_memberships`, and `provider_keys` exist.
- `provider_keys` RLS is enabled and has no permissive client policies.
- A confirmed local/staging test user exists.
- The tester has backend-derived workspace owner/admin authority.
- Backend service-role and BYOK encryption key values stay backend-only and are never printed, pasted, screenshotted, or committed.

## Processes

Start local Supabase:

```text
supabase start
```

Start the backend using the same local/staging auth, Supabase DB, workspace runtime, BYOK vault, and provider key route gate env used for the successful backend BYOK smoke.

Required backend env names are:

```text
FREE_AI_MIXER_AUTH_RUNTIME_ENABLED
FREE_AI_MIXER_AUTH_PROVIDER
FREE_AI_MIXER_AUTH_ISSUER
FREE_AI_MIXER_AUTH_AUDIENCE
FREE_AI_MIXER_AUTH_JWKS_URI
FREE_AI_MIXER_AUTH_JWT_KEY_MODE
FREE_AI_MIXER_AUTH_ALLOWED_ALGORITHMS
FREE_AI_MIXER_ENABLE_SUPABASE_DB
FREE_AI_MIXER_DB_PROVIDER
FREE_AI_MIXER_SUPABASE_URL
FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY
FREE_AI_MIXER_WORKSPACE_RUNTIME_ENABLED
FREE_AI_MIXER_BYOK_VAULT_ENABLED
FREE_AI_MIXER_BYOK_VAULT_PROVIDER
FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_VERSION
FREE_AI_MIXER_BYOK_ENCRYPTION_KEY_V1
FREE_AI_MIXER_BYOK_PROVIDER_KEYS_RUNTIME_ENABLED
FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED
FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER
```

Mock/local validation success requires both:

```text
FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED=1
FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER=mock_local
```

If the runtime gate is off, or if the adapter env is missing or anything other than `mock_local`, the backend must fail closed with validation unavailable. Do not use production Supabase, real provider keys, provider SDKs, or provider endpoints for this smoke.

Start the frontend with ignored local client env:

```text
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Required frontend env names are:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never define a `VITE_*SERVICE_ROLE*` value.

## Browser Smoke Steps

1. Open the local frontend URL.
2. Log in with the confirmed local/staging tester.
3. Confirm Dashboard shows authenticated backend session state.
4. Open Provider Settings.
5. Select `OpenAI`.
6. Enter `FAKE_PHASE79_OPENAI_KEY_DO_NOT_STORE`.
7. Click `Save key`.
8. Confirm the input clears and the UI shows only a redacted server-side stored/not-validated summary.
9. Enter `FAKE_PHASE79_OPENAI_REPLACEMENT_KEY_DO_NOT_STORE`.
10. Click `Replace key`.
11. Confirm the input clears and the UI shows only a redacted replacement summary.
12. Click `Validate stored key`.
13. With the two mock/local validation env gates enabled, confirm the UI shows `Validated by backend`.
14. With either validation env gate disabled, confirm the UI shows validation unavailable and no success state.
15. Click `Remove key`.
16. Confirm controls return to `Save key` / add-key state and remove is disabled until a new active key exists.
17. Confirm no connected, verified, test-passed, live-provider-ready, or generation-enabled wording appears.

## Browser No-Persistence Check

Use fake key strings only. Do not inspect, copy, screenshot, or share real request payloads, tokens, keys, or passwords.

```text
JSON.stringify({
  href: location.href,
  cookie: document.cookie,
  localStorage: { ...localStorage },
  sessionStorage: { ...sessionStorage },
  visibleText: document.body.innerText
}).includes("FAKE_PHASE79")
```

Expected result:

```text
false
```

The browser Network tab may show the fake key in the outgoing request payload because the key must be submitted once to the backend. Do not screenshot, copy, or share that request payload.

## Safe DB Verification

Do not select `encrypted_payload` or `secret_ref` values.

Allowed count/status check:

```sql
select
  provider_name,
  status,
  verification_status,
  last_verified_at is not null as has_last_verified_at,
  last_verification_error_code,
  count(*) as row_count
from provider_keys
group by provider_name, status, verification_status, has_last_verified_at, last_verification_error_code
order by provider_name, status, verification_status, has_last_verified_at, last_verification_error_code;
```

Allowed boolean presence check:

```sql
select
  provider_name,
  status,
  encrypted_payload is not null as has_encrypted_payload,
  secret_ref is not null as has_secret_ref,
  key_fingerprint_suffix is not null as has_key_fingerprint_suffix,
  masked_fingerprint is not null as has_masked_fingerprint,
  created_at,
  updated_at,
  revoked_at,
  deleted_at
from provider_keys
where provider_name = 'openai'
order by created_at desc
limit 5;
```

Allowed RLS posture check:

```sql
select relrowsecurity
from pg_class
where relname = 'provider_keys';
```

```sql
select count(*) as provider_keys_policy_count
from pg_policies
where tablename = 'provider_keys';
```

## Cleanup

- Revoke the fake key through the Provider Settings UI.
- Verify no active OpenAI key remains for the local/staging smoke account.
- If mock validation was enabled, remove or unset `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_ADAPTER` and `FREE_AI_MIXER_BYOK_PROVIDER_VALIDATION_RUNTIME_ENABLED` after the smoke.
- Stop local processes when the smoke is complete.
- Do not commit local env files, logs, screenshots, traces, or copied request payloads.

## Still Blocked

- Real provider keys.
- Provider SDK/API calls.
- Real provider validation.
- Production validation adapter selection.
- BYOK-backed generation or export routing.
- Credits, get-free-credits, wallet, checkout, subscription, or billing mutation.
- Production use without separate production security, RLS, secret-management, and rollback approval.
