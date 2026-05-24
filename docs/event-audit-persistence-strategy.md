# Event And Audit Persistence Strategy

This document is a schema strategy only for future event and audit persistence.
It does not execute migrations, create live tables, enable runtime persistence,
add route hooks, add worker hooks, enable admin analytics, or allow frontend
Supabase access.

## Current Draft Status

Phase 22 adds a migration draft file only:

- `backend/db/migrations/0002_event_audit_persistence_draft.sql`

That draft is repository-tracked and intentionally not executed by default.
This phase does not:

- apply the draft to local Postgres or local Supabase
- apply the draft to remote Supabase
- wire event or audit recorders into runtime
- add repository adapters
- add route or worker event hooks
- make admin analytics real

Recommended next order after this draft:

1. local-only schema smoke
2. repository adapter audit
3. repository adapter implementation
4. no-op to DB recorder switch audit
5. route hook audit
6. worker hook audit
7. admin analytics aggregation audit

## Scope

Future persistence must keep `analytics_events` and `audit_log` separate.

- `analytics_events` is for aggregate product and operational analytics later.
- `audit_log` is for security, accountability, and privileged action history later.
- credit and billing ledgers remain separate from generic event storage.
- this strategy does not make admin analytics real by itself.

## analytics_events Strategy

Future `analytics_events` table shape:

- `id uuid primary key`
- `event_id text unique`
- `occurred_at timestamptz not null`
- `event_type text not null`
- `event_category text not null`
- `request_id text null`
- `actor_kind text not null`
- `actor_user_id uuid null`
- `workspace_id uuid null`
- `actor_role text null`
- `target_type text null`
- `target_id text null`
- `outcome text not null`
- `failure_code text null`
- `source text not null`
- `metadata_safe_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Rules:

- `metadata_safe_json` must contain sanitized safe JSON only.
- use check constraints for `event_type`, `event_category`, `actor_kind`,
  `outcome`, and `source` before considering hard Postgres enums.
- `actor_user_id` and `workspace_id` may remain nullable for public or
  anonymous events.
- no raw email, prompts, secrets, request headers, local paths, signed URLs,
  provider error blobs, or raw payload snapshots may be stored.
- the schema may support future aggregation, but it must not enable analytics
  by itself.

## audit_log Strategy

Future `audit_log` table shape:

- `id uuid primary key`
- `audit_id text unique`
- `occurred_at timestamptz not null`
- `audit_type text not null`
- `audit_category text not null`
- `request_id text null`
- `actor_user_id uuid null`
- `actor_kind text not null`
- `actor_platform_role text null`
- `workspace_id uuid null`
- `target_type text null`
- `target_id text null`
- `action text null`
- `outcome text not null`
- `failure_code text null`
- `request_context_hash text null later only if privacy-approved`
- `user_agent_hash text null later only if privacy-approved`
- `metadata_safe_json jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Rules:

- `audit_log` should be append-only later.
- audit repositories should expose no update or delete methods.
- no raw BYOK keys, prompts, JWTs, cookies, billing secrets, signed URLs, or
  local paths may be stored.
- audit data is for investigations and accountability later, not dashboards.
- audit retention should be longer than generic analytics retention.

## RLS And Access Strategy

Default access posture later:

- default-deny RLS for both tables
- backend-only writes
- no direct frontend reads
- no frontend Supabase client access
- `audit_log` stays backend and platform-admin only later
- `analytics_events` may later support backend-generated workspace-scoped
  summaries only after audit
- workspace owner/admin must never read platform audit logs
- moderator and support roles need narrow backend routes later, not direct
  table access

Phase 22 draft note:

- the migration draft enables RLS on both tables
- it creates no permissive anon or authenticated client policies
- backend/server-side access policies remain a later phase

## Indexing And Performance Strategy

Start with minimal indexes only.

Future `analytics_events` indexes:

- `occurred_at desc`
- `event_category + occurred_at desc`
- `event_type + occurred_at desc`
- `workspace_id + occurred_at desc`
- `actor_user_id + occurred_at desc`
- `request_id`
- `target_type + target_id`
- `outcome + failure_code + occurred_at desc`

Future `audit_log` indexes:

- `occurred_at desc`
- `audit_category + occurred_at desc`
- `audit_type + occurred_at desc`
- `actor_user_id + occurred_at desc`
- `actor_platform_role + occurred_at desc`
- `workspace_id + occurred_at desc`
- `request_id`
- `target_type + target_id`

Rules:

- start minimal
- avoid over-indexing
- use rollups or materialized summaries later
- defer partitioning until real volume exists

## Retention And Privacy Strategy

- product analytics may have shorter retention
- admin, BYOK, billing, credit, and security audit records need longer
  retention
- internal ids only
- prompts excluded by default
- IP and user-agent should be omitted initially or hashed only after privacy
  approval
- signed URLs and local paths must be rejected entirely
- account deletion and privacy requests must preserve minimized identifiers and
  audit accountability safely

## Relation To Existing Schema

This strategy must align later with:

- `app_users`
- `workspaces`
- `workspace_memberships`
- `provider_keys`
- `export_jobs`
- `artifact_records`
- `storage_refs`
- `credit_ledger`

Guidance:

- prefer nullable identifier fields and generic `target_type` / `target_id`
  first
- avoid `on delete cascade` for audit history
- keep `request_id` first-class for correlation
- avoid hard foreign keys initially if they risk destroying audit history

## Migration And Rollout Order

Recommended future order:

1. schema strategy docs
2. migration draft audit
3. local-only schema smoke
4. repository adapter audit
5. repository adapter implementation
6. no-op to DB recorder switch audit
7. backend route hook audit
8. worker/job lifecycle hook audit
9. admin analytics aggregation audit
10. frontend/admin UI audit

Rules:

- no migration execution in the strategy phase
- no runtime persistence in the strategy phase
- no route integration in the strategy phase
- no admin analytics changes in the strategy phase

## Security Rules

Never store:

- raw API keys
- encrypted provider payloads
- raw prompts by default
- JWTs
- cookies or session tokens
- service-role values
- provider balances
- billing secrets or raw payment details
- local file paths
- signed URLs
- full upstream provider error bodies
- spoofed header identity
- frontend localStorage identity

Use:

- `metadata_safe_json` only
- sanitized `failure_code` only
- no raw request headers
- no raw provider responses
- no raw payload snapshots
