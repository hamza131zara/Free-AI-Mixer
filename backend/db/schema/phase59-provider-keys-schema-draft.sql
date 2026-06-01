-- Phase 59 provider key schema draft mirror.
-- This schema mirror documents the intended BYOK provider key shape only.
-- It is not executed by this phase.

create table if not exists provider_keys (
  provider_key_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  provider_id text not null,
  provider_name text not null,
  encrypted_payload text,
  secret_ref text,
  storage_mode text not null,
  key_version text not null,
  encryption_algorithm text not null,
  status text not null,
  verification_status text not null default 'not_validated',
  last_verified_at timestamptz,
  last_verification_error_code text,
  needs_reverification boolean not null default true,
  created_by_user_id uuid not null references app_users(id),
  updated_by_user_id uuid references app_users(id),
  rotated_at timestamptz,
  revoked_at timestamptz,
  disabled_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_keys_provider_id_check
    check (provider_id in ('openai', 'runway', 'luma', 'google', 'stability', 'replicate')),
  constraint provider_keys_storage_mode_check
    check (storage_mode in ('encrypted_payload', 'external_secret_ref')),
  constraint provider_keys_status_check
    check (status in ('active', 'disabled', 'rotated')),
  constraint provider_keys_verification_status_check
    check (verification_status in ('not_validated', 'validated', 'validation_failed', 'needs_reverification')),
  constraint provider_keys_active_storage_reference_check
    check (
      status <> 'active'
      or (
        storage_mode = 'encrypted_payload'
        and encrypted_payload is not null
        and secret_ref is null
      )
      or (
        storage_mode = 'external_secret_ref'
        and secret_ref is not null
        and encrypted_payload is null
      )
    ),
  constraint provider_keys_sanitized_verification_error_code_check
    check (
      last_verification_error_code is null
      or last_verification_error_code ~ '^[a-z0-9_:-]{1,96}$'
    )
);

comment on table provider_keys is
  'Draft BYOK provider key metadata table. Plaintext provider keys, raw provider errors, service-role values, provider credentials, provider account metadata, and browser-visible secret material are forbidden.';

comment on column provider_keys.encrypted_payload is
  'Backend-only encrypted provider key payload. Never return to frontend responses, logs, screenshots, events, or docs examples.';

comment on column provider_keys.secret_ref is
  'Backend-only external secret manager reference. Never return to frontend responses, logs, screenshots, events, or docs examples.';

comment on column provider_keys.last_verification_error_code is
  'Sanitized verification error code only. Raw provider error bodies and account metadata are forbidden.';

create unique index if not exists provider_keys_one_active_per_workspace_provider_idx
  on provider_keys (workspace_id, provider_name)
  where status = 'active'
    and deleted_at is null;

alter table provider_keys enable row level security;

-- Default-deny RLS posture:
-- No client-facing policies are added in this draft.
-- Backend/service-role-only access rules remain deferred to a later approved phase.
