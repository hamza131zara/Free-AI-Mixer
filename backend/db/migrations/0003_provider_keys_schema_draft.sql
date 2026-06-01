-- Phase 59 migration draft only.
-- This file is committed as a migration-style SQL draft in the repository.
-- It is not executed by this phase.
-- Provider Settings routes are not wired to live provider-key storage by this phase.
-- Live vault encryption, provider SDK/API verification, frontend API key input,
-- credits/billing, generation, and export integrations remain deferred.

alter table provider_keys
  add column if not exists provider_id text,
  add column if not exists secret_ref text,
  add column if not exists storage_mode text not null default 'encrypted_payload',
  add column if not exists encryption_algorithm text,
  add column if not exists verification_status text not null default 'not_validated',
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_verification_error_code text,
  add column if not exists needs_reverification boolean not null default true,
  add column if not exists revoked_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_by_user_id uuid references app_users(id);

alter table provider_keys
  alter column encrypted_payload drop not null;

update provider_keys
  set provider_id = coalesce(provider_id, provider_name),
      encryption_algorithm = coalesce(encryption_algorithm, algorithm)
  where provider_id is null
     or encryption_algorithm is null;

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
  'Draft BYOK provider key metadata table. Plaintext provider keys, raw provider errors, service-role values, provider credentials, provider account metadata, and browser-visible secret material are forbidden.';

comment on column provider_keys.encrypted_payload is
  'Backend-only encrypted provider key payload. Never return to frontend responses, logs, screenshots, events, or docs examples.';

comment on column provider_keys.secret_ref is
  'Backend-only external secret manager reference. Never return to frontend responses, logs, screenshots, events, or docs examples.';

comment on column provider_keys.last_verification_error_code is
  'Sanitized verification error code only. Raw provider error bodies and account metadata are forbidden.';

comment on column provider_keys.storage_mode is
  'Storage mode must be encrypted_payload or external_secret_ref; active records must use exactly one backend-only storage reference.';

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
-- - No client-facing SELECT, INSERT, UPDATE, or DELETE policies are added in this draft.
-- - Default-deny RLS posture must remain until a later approved phase defines
--   backend/service-role-only access rules and verifies no frontend Supabase DB access.
-- - Service-role access remains backend-only and must never be exposed through VITE_*.
