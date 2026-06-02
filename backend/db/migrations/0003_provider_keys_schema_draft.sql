-- Phase 68 executable local/staging provider_keys schema prep.
-- This file prepares the BYOK provider key metadata table shape for local and
-- staging runtime smoke only. Applying it is a manual operation outside this phase.
-- Provider Settings routes, frontend API key input, provider SDK/API verification,
-- credits/billing, generation, and export integrations remain separately gated.

create table if not exists provider_keys (
  provider_key_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  provider_id text not null,
  provider_name text not null,
  encrypted_payload text,
  secret_ref text,
  storage_mode text not null default 'encrypted_payload',
  key_version text not null,
  encryption_algorithm text not null,
  algorithm text,
  status text not null default 'active',
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

alter table provider_keys
  add column if not exists provider_key_id uuid,
  add column if not exists workspace_id uuid references workspaces(id),
  add column if not exists owner_id uuid references app_users(id),
  add column if not exists provider_id text,
  add column if not exists provider_name text,
  add column if not exists encrypted_payload text,
  add column if not exists secret_ref text,
  add column if not exists storage_mode text not null default 'encrypted_payload',
  add column if not exists key_version text,
  add column if not exists encryption_algorithm text,
  add column if not exists algorithm text,
  add column if not exists status text not null default 'active',
  add column if not exists verification_status text not null default 'not_validated',
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_verification_error_code text,
  add column if not exists needs_reverification boolean not null default true,
  add column if not exists created_by_user_id uuid references app_users(id),
  add column if not exists updated_by_user_id uuid references app_users(id),
  add column if not exists rotated_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table provider_keys
  alter column encrypted_payload drop not null;

update provider_keys
  set provider_id = coalesce(provider_id, provider_name),
      provider_name = coalesce(provider_name, provider_id),
      encryption_algorithm = coalesce(encryption_algorithm, algorithm),
      algorithm = coalesce(algorithm, encryption_algorithm),
      storage_mode = coalesce(storage_mode, 'encrypted_payload'),
      verification_status = coalesce(verification_status, 'not_validated'),
      needs_reverification = coalesce(needs_reverification, true),
      status = coalesce(status, 'active'),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, now())
  where provider_id is null
     or provider_name is null
     or encryption_algorithm is null
     or algorithm is null
     or storage_mode is null
     or verification_status is null
     or needs_reverification is null
     or status is null
     or created_at is null
     or updated_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_keys_provider_id_check'
  ) then
    alter table provider_keys
      add constraint provider_keys_provider_id_check
      check (provider_id in ('openai', 'runway', 'luma', 'google', 'stability', 'replicate'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_keys_storage_mode_check'
  ) then
    alter table provider_keys
      add constraint provider_keys_storage_mode_check
      check (storage_mode in ('encrypted_payload', 'external_secret_ref'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_keys_status_check'
  ) then
    alter table provider_keys
      add constraint provider_keys_status_check
      check (status in ('active', 'disabled', 'rotated'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_keys_active_storage_reference_check'
  ) then
    alter table provider_keys
      add constraint provider_keys_active_storage_reference_check
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
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_keys_verification_status_check'
  ) then
    alter table provider_keys
      add constraint provider_keys_verification_status_check
      check (
        verification_status in (
          'not_validated',
          'validated',
          'validation_failed',
          'needs_reverification'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_keys_sanitized_verification_error_code_check'
  ) then
    alter table provider_keys
      add constraint provider_keys_sanitized_verification_error_code_check
      check (
        last_verification_error_code is null
        or last_verification_error_code ~ '^[a-z0-9_:-]{1,96}$'
      );
  end if;
end $$;

comment on table provider_keys is
  'Local/staging BYOK provider key metadata table. Plaintext provider keys, raw provider errors, service-role values, provider credentials, provider account metadata, and browser-visible secret material are forbidden.';

comment on column provider_keys.encrypted_payload is
  'Backend-only encrypted provider key payload. Never return to frontend responses, logs, screenshots, events, or docs examples.';

comment on column provider_keys.secret_ref is
  'Backend-only external secret manager reference. Never return to frontend responses, logs, screenshots, events, or docs examples.';

comment on column provider_keys.last_verification_error_code is
  'Sanitized verification error code only. Raw provider error bodies and account metadata are forbidden.';

comment on column provider_keys.storage_mode is
  'Storage mode must be encrypted_payload or external_secret_ref; active records must use exactly one backend-only storage reference.';

comment on column provider_keys.created_by_user_id is
  'Backend-derived app user id that created the provider key metadata record. Do not trust frontend user or workspace identifiers.';

comment on column provider_keys.updated_by_user_id is
  'Backend-derived app user id for the last mutation. Do not trust frontend user or workspace identifiers.';

create unique index if not exists provider_keys_one_active_per_workspace_provider_idx
  on provider_keys (workspace_id, provider_name)
  where status = 'active'
    and deleted_at is null;

create index if not exists provider_keys_workspace_provider_deleted_idx
  on provider_keys (workspace_id, provider_name, deleted_at);

create index if not exists provider_keys_workspace_verification_idx
  on provider_keys (workspace_id, verification_status, needs_reverification);

alter table provider_keys enable row level security;

-- RLS posture:
-- - No client-facing SELECT, INSERT, UPDATE, or DELETE policies are added here.
-- - Default-deny RLS posture remains until a later approved phase defines any
--   explicit backend/service-role-only access policy requirements.
-- - Supabase service-role access remains backend-only and must never be exposed
--   through VITE_* or any browser-visible configuration.
