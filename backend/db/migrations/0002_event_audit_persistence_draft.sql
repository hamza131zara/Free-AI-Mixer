-- Phase 22 migration draft only.
-- This file is committed as a future migration-style SQL draft.
-- It is not executed by this phase.
-- Runtime persistence wiring, repository adapters, route hooks, worker hooks,
-- and admin analytics aggregation remain deferred.

create table if not exists analytics_events (
  id uuid primary key,
  event_id text not null unique,
  occurred_at timestamptz not null,
  event_type text not null,
  event_category text not null,
  request_id text,
  actor_kind text not null,
  actor_user_id uuid,
  workspace_id uuid,
  actor_role text,
  target_type text,
  target_id text,
  outcome text not null,
  failure_code text,
  source text not null,
  metadata_safe_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_events_event_category_check
    check (
      event_category in (
        'auth_account',
        'workspace',
        'byok_provider',
        'admin_platform',
        'product_usage',
        'generation_export',
        'credits_billing',
        'storage_artifact',
        'operational_error'
      )
    ),
  constraint analytics_events_actor_kind_check
    check (
      actor_kind in (
        'anonymous',
        'authenticated_user',
        'workspace_member',
        'platform_operator',
        'system'
      )
    ),
  constraint analytics_events_outcome_check
    check (
      outcome in (
        'accepted',
        'rejected',
        'succeeded',
        'failed',
        'unavailable',
        'skipped'
      )
    ),
  constraint analytics_events_source_check
    check (
      source in (
        'backend_route',
        'backend_worker',
        'backend_scheduler',
        'backend_admin',
        'frontend_opt_in_later'
      )
    ),
  constraint analytics_events_metadata_safe_json_object_check
    check (jsonb_typeof(metadata_safe_json) = 'object')
);

comment on table analytics_events is
  'Draft-only future analytics event table. The draft is not executed by Phase 22 and does not enable runtime persistence or admin analytics.';

comment on column analytics_events.metadata_safe_json is
  'Sanitized safe JSON metadata only. Raw prompts, secrets, tokens, cookies, provider secrets, signed URLs, local paths, request headers, provider error bodies, and raw payloads are forbidden.';

create index if not exists analytics_events_occurred_at_desc_idx
  on analytics_events (occurred_at desc);

create index if not exists analytics_events_category_occurred_at_desc_idx
  on analytics_events (event_category, occurred_at desc);

create index if not exists analytics_events_type_occurred_at_desc_idx
  on analytics_events (event_type, occurred_at desc);

create index if not exists analytics_events_workspace_occurred_at_desc_idx
  on analytics_events (workspace_id, occurred_at desc);

create index if not exists analytics_events_actor_user_occurred_at_desc_idx
  on analytics_events (actor_user_id, occurred_at desc);

create index if not exists analytics_events_request_id_idx
  on analytics_events (request_id);

create index if not exists analytics_events_target_type_target_id_idx
  on analytics_events (target_type, target_id);

create index if not exists analytics_events_outcome_failure_occurred_at_desc_idx
  on analytics_events (outcome, failure_code, occurred_at desc);

alter table analytics_events enable row level security;

comment on table analytics_events is
  'Draft-only future analytics event table. RLS is enabled with no client-facing policies in this draft; backend/server-side access remains a later phase.';

create table if not exists audit_log (
  id uuid primary key,
  audit_id text not null unique,
  occurred_at timestamptz not null,
  audit_type text not null,
  audit_category text not null,
  request_id text,
  actor_user_id uuid,
  actor_kind text not null,
  actor_platform_role text,
  workspace_id uuid,
  target_type text,
  target_id text,
  action text,
  outcome text not null,
  failure_code text,
  request_context_hash text,
  user_agent_hash text,
  metadata_safe_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_audit_category_check
    check (
      audit_category in (
        'auth_security',
        'workspace_security',
        'provider_key_security',
        'admin_access',
        'platform_role_change',
        'billing_sensitive_action',
        'credit_sensitive_action',
        'support_moderation_action'
      )
    ),
  constraint audit_log_actor_kind_check
    check (
      actor_kind in (
        'anonymous',
        'authenticated_user',
        'workspace_member',
        'platform_operator',
        'system'
      )
    ),
  constraint audit_log_actor_platform_role_check
    check (
      actor_platform_role is null
      or actor_platform_role in (
        'platform_admin',
        'platform_moderator',
        'support_agent',
        'read_only_analyst'
      )
    ),
  constraint audit_log_outcome_check
    check (
      outcome in (
        'accepted',
        'rejected',
        'succeeded',
        'failed',
        'unavailable',
        'skipped'
      )
    ),
  constraint audit_log_metadata_safe_json_object_check
    check (jsonb_typeof(metadata_safe_json) = 'object')
);

comment on table audit_log is
  'Draft-only future append-only audit log table. The draft is not executed by Phase 22 and does not enable persistence, route hooks, worker hooks, or admin analytics.';

comment on column audit_log.metadata_safe_json is
  'Sanitized safe JSON metadata only. Raw BYOK keys, prompts, tokens, cookies, service-role values, billing secrets, provider balances, signed URLs, local paths, request headers, and upstream provider error bodies are forbidden.';

create index if not exists audit_log_occurred_at_desc_idx
  on audit_log (occurred_at desc);

create index if not exists audit_log_category_occurred_at_desc_idx
  on audit_log (audit_category, occurred_at desc);

create index if not exists audit_log_type_occurred_at_desc_idx
  on audit_log (audit_type, occurred_at desc);

create index if not exists audit_log_actor_user_occurred_at_desc_idx
  on audit_log (actor_user_id, occurred_at desc);

create index if not exists audit_log_actor_platform_role_occurred_at_desc_idx
  on audit_log (actor_platform_role, occurred_at desc);

create index if not exists audit_log_workspace_occurred_at_desc_idx
  on audit_log (workspace_id, occurred_at desc);

create index if not exists audit_log_request_id_idx
  on audit_log (request_id);

create index if not exists audit_log_target_type_target_id_idx
  on audit_log (target_type, target_id);

alter table audit_log enable row level security;

comment on table audit_log is
  'Draft-only future append-only audit log table. RLS is enabled with no client-facing policies in this draft; backend/platform-admin-only access remains a later phase.';

-- Deferred:
-- - migration execution (local or remote)
-- - repository adapter implementation
-- - backendDependencies persistence wiring
-- - route and worker event hooks
-- - append-only enforcement triggers or policies
-- - backend/server-side access policies
-- - admin analytics aggregation and query routes
