-- Phase 26-B draft only.
-- This schema is not executed in this phase.
-- It is a Postgres-compatible draft for future Supabase/Postgres persistence work.
-- Runtime DB adapters, auth middleware, signed URL generation, RLS policies,
-- BYOK encryption implementation, and production storage providers remain deferred.

create table if not exists app_users (
  id uuid primary key,
  auth_provider text not null,
  auth_subject text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_auth_provider_subject_unique unique (auth_provider, auth_subject)
);

comment on table app_users is
  'Draft app-level user table. Compatible with future Supabase auth.users identity mapping.';

create table if not exists workspaces (
  id uuid primary key,
  name text not null,
  created_by_user_id uuid not null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists workspaces_created_by_user_id_idx
  on workspaces (created_by_user_id);

create table if not exists workspace_memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_memberships_role_check
    check (role in ('owner', 'admin', 'editor', 'viewer')),
  constraint workspace_memberships_status_check
    check (status in ('active', 'invited', 'disabled'))
);

create index if not exists workspace_memberships_user_id_idx
  on workspace_memberships (user_id);

create index if not exists workspace_memberships_workspace_role_status_idx
  on workspace_memberships (workspace_id, role, status);

create table if not exists export_jobs (
  job_id uuid primary key,
  request_id text not null,
  timeline_id text not null,
  owner_id uuid not null references app_users(id),
  workspace_id uuid not null references workspaces(id),
  status text not null,
  attempt_count integer not null default 0,
  render_settings jsonb not null,
  failure_code text,
  failure_message text,
  failure_retryable boolean,
  submitted_at timestamptz,
  started_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint export_jobs_status_check
    check (status in ('queued', 'submitted', 'rendering', 'finalizing', 'success', 'error', 'expired')),
  constraint export_jobs_workspace_owner_request_unique
    unique (workspace_id, owner_id, request_id)
);

comment on table export_jobs is
  'Draft export job persistence table aligned to BackendExportJobRecord ownership and request idempotency.';

create index if not exists export_jobs_workspace_job_idx
  on export_jobs (workspace_id, job_id);

create index if not exists export_jobs_workspace_owner_status_idx
  on export_jobs (workspace_id, owner_id, status);

create table if not exists artifact_records (
  artifact_id text not null,
  job_id uuid not null references export_jobs(job_id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  kind text not null,
  format text not null,
  status text not null,
  size_bytes bigint,
  duration_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artifact_records_pkey primary key (job_id, artifact_id)
);

create index if not exists artifact_records_workspace_job_idx
  on artifact_records (workspace_id, job_id);

create table if not exists storage_refs (
  storage_ref_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  job_id uuid not null references export_jobs(job_id) on delete cascade,
  artifact_id text not null,
  storage_provider text not null,
  bucket_name text not null,
  object_key text not null,
  content_type text,
  byte_length bigint,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_refs_job_artifact_unique unique (job_id, artifact_id)
);

comment on table storage_refs is
  'Object storage metadata only. Durable signed_url values are intentionally not persisted here.';

create index if not exists storage_refs_workspace_job_idx
  on storage_refs (workspace_id, job_id);

create index if not exists storage_refs_provider_bucket_object_idx
  on storage_refs (storage_provider, bucket_name, object_key);

create table if not exists provider_keys (
  provider_key_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  provider_name text not null,
  encrypted_payload text not null,
  key_version integer not null,
  algorithm text not null,
  status text not null,
  created_by_user_id uuid not null references app_users(id),
  rotated_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_keys_status_check
    check (status in ('active', 'disabled', 'rotated'))
);

comment on table provider_keys is
  'Encrypted provider key metadata only. Plaintext provider secrets and KMS details remain deferred.';

create index if not exists provider_keys_workspace_provider_status_idx
  on provider_keys (workspace_id, provider_name, status);

create table if not exists credit_ledger (
  ledger_entry_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  entry_kind text not null,
  amount_delta integer not null,
  reason text not null,
  job_id uuid references export_jobs(job_id),
  reservation_entry_id uuid references credit_ledger(ledger_entry_id),
  charge_entry_id uuid references credit_ledger(ledger_entry_id),
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint credit_ledger_entry_kind_check
    check (entry_kind in ('reserve', 'charge', 'refund', 'grant', 'adjustment')),
  constraint credit_ledger_amount_delta_non_zero_check
    check (amount_delta <> 0)
);

comment on table credit_ledger is
  'Append-only credit ledger draft. Mutable balance tables and billing integration remain deferred.';

create index if not exists credit_ledger_workspace_created_at_idx
  on credit_ledger (workspace_id, created_at);

create index if not exists credit_ledger_workspace_entry_kind_idx
  on credit_ledger (workspace_id, entry_kind);

create index if not exists credit_ledger_job_id_idx
  on credit_ledger (job_id);

create unique index if not exists credit_ledger_workspace_idempotency_key_unique
  on credit_ledger (workspace_id, idempotency_key)
  where idempotency_key is not null;

-- Deferred:
-- - RLS policies
-- - service-role access rules
-- - auth middleware/session extraction
-- - Supabase Storage integration
-- - signed URL generation
-- - BYOK encryption/KMS implementation
-- - repository adapter implementation
