# BYOK Provider Keys Schema Apply Runbook

This runbook is for controlled local/staging schema application only. It does not apply the schema by itself, does not change runtime behavior, does not make BYOK public, and does not add frontend API key input.

Use this only after Phase 68 schema prep is signed off and before any backend BYOK route runtime smoke.

## Scope

- Target file: `backend/db/migrations/0003_provider_keys_schema_draft.sql`
- Target environment: local or staging only
- Purpose: prepare the `provider_keys` table shape for backend route smoke
- Not included: production migration, frontend key input, provider SDK/API calls, test connection, fake connected state, credits, billing, generation, or export changes

## Pre-Checks

Run from the repository root:

```text
git status --short
```

Confirm manually:

- The target Supabase project is local or staging, never production.
- The target database has `app_users` and `workspaces`.
- The service-role key remains backend-only and is not exposed through `VITE_*`.
- The frontend does not have provider API key input fields.
- Provider SDK/API verification and test connection are still blocked.
- The route-live gate can remain off until schema verification is complete.

Safe table pre-check:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('app_users', 'workspaces', 'provider_keys')
order by table_name;
```

Expected before apply:

- `app_users` exists.
- `workspaces` exists.
- `provider_keys` may or may not exist.

## Manual Apply

Apply only the SQL from:

```text
backend/db/migrations/0003_provider_keys_schema_draft.sql
```

Use a trusted local/staging SQL tool such as the Supabase SQL Editor for the staging project or a local/staging `psql` session. Do not run this against production.

If using `psql`, keep the database connection string in a private shell or secret store and do not paste it into docs, issue reports, screenshots, logs, or chat:

```text
psql "<LOCAL_OR_STAGING_DB_CONNECTION_STRING_FROM_SECRET_STORE>" -f backend/db/migrations/0003_provider_keys_schema_draft.sql
```

Do not print or paste service-role keys, anon keys, JWTs, refresh tokens, passwords, encryption keys, provider API keys, `encrypted_payload` values, or `secret_ref` values.

## Verification

Verify the table exists:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'provider_keys';
```

Verify public-safe column shape without selecting secret-bearing values:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'provider_keys'
  and column_name not in ('encrypted_payload', 'secret_ref')
order by ordinal_position;
```

Verify secret-handle columns exist without selecting their values:

```sql
select
  count(*) filter (where column_name = 'encrypted_payload') as has_encrypted_payload_column,
  count(*) filter (where column_name = 'secret_ref') as has_secret_ref_column
from information_schema.columns
where table_schema = 'public'
  and table_name = 'provider_keys';
```

Verify RLS is enabled:

```sql
select relrowsecurity
from pg_class
where relname = 'provider_keys';
```

Expected result:

- `relrowsecurity` is true.

Verify no client-facing policies exist:

```sql
select count(*) as provider_keys_policy_count
from pg_policies
where schemaname = 'public'
  and tablename = 'provider_keys';
```

Expected result:

- `provider_keys_policy_count` is 0.

Verify indexes exist:

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'provider_keys'
order by indexname;
```

Expected index names include:

- `provider_keys_one_active_per_workspace_provider_idx`
- `provider_keys_workspace_provider_deleted_idx`
- `provider_keys_workspace_verification_idx`

## Rollback And Cleanup

Rollback guidance is for disposable local/staging only.

Before cleanup:

- Turn off `FREE_AI_MIXER_BYOK_PROVIDER_KEYS_RUNTIME_ENABLED`.
- Stop BYOK route smoke attempts.
- Confirm the target is local/staging, not production.

For disposable local/staging only:

```sql
drop table if exists provider_keys cascade;
```

For shared staging, prefer pausing route-gated BYOK smoke and removing only known test records through a reviewed cleanup step. Do not run broad destructive cleanup without a staging owner review.

## Production No-Go

Do not run this schema apply on production without a separate production migration review, backup/rollback plan, security review, and explicit production go/no-go approval.

Production remains blocked for:

- Frontend provider API key input.
- Provider SDK/API verification.
- Test connection.
- Fake connected or verified state.
- Credits or billing mutation.
- Generation/export integration.
- Public launch claims.

## Next Step After Verified Apply

After local/staging schema apply is verified, the next safe phase is a backend-only BYOK route runtime smoke using fake placeholder provider keys only. That smoke must still avoid provider SDK/API calls, test connection, frontend key input, and secret-bearing response output.
