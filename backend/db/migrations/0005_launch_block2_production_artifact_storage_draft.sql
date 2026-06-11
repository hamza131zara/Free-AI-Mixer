-- Launch Block 2 migration draft only.
-- Do not auto-apply this migration to production.
-- Manual local/staging/production review is required before applying.
-- This draft adds backend-only production storage metadata for generated artifacts.

alter table generated_artifact_records
  add column if not exists storage_provider text,
  add column if not exists storage_bucket text,
  add column if not exists storage_object_key text,
  add column if not exists storage_content_type text,
  add column if not exists storage_size_bytes bigint,
  add column if not exists storage_sha256 text,
  add column if not exists storage_created_at timestamptz;

comment on column generated_artifact_records.storage_provider is
  'Backend-only generated artifact storage provider metadata. Public JSON must never expose storage refs.';

comment on column generated_artifact_records.storage_bucket is
  'Backend-only private storage bucket name. Public JSON must never expose bucket names.';

comment on column generated_artifact_records.storage_object_key is
  'Backend-only private storage object key. Public JSON must never expose object keys.';

comment on column generated_artifact_records.storage_content_type is
  'Backend-only storage object content type for verification before backend-mediated preview.';

comment on column generated_artifact_records.storage_size_bytes is
  'Backend-only storage object size metadata. Image bytes/base64 must never be persisted here.';

comment on column generated_artifact_records.storage_sha256 is
  'Backend-only storage object checksum metadata.';

comment on column generated_artifact_records.storage_created_at is
  'Backend-only timestamp for production storage write tracking.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_artifact_records_storage_provider_check'
  ) then
    alter table generated_artifact_records
      add constraint generated_artifact_records_storage_provider_check
      check (storage_provider is null or storage_provider in ('supabase_storage'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_artifact_records_storage_content_type_check'
  ) then
    alter table generated_artifact_records
      add constraint generated_artifact_records_storage_content_type_check
      check (
        storage_content_type is null or
        storage_content_type in ('image/png', 'image/jpeg', 'image/webp')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_artifact_records_storage_size_positive_check'
  ) then
    alter table generated_artifact_records
      add constraint generated_artifact_records_storage_size_positive_check
      check (storage_size_bytes is null or storage_size_bytes > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'generated_artifact_records_storage_sha256_check'
  ) then
    alter table generated_artifact_records
      add constraint generated_artifact_records_storage_sha256_check
      check (storage_sha256 is null or storage_sha256 ~ '^[a-f0-9]{64}$');
  end if;
end $$;

create index if not exists generated_artifact_records_storage_lookup_idx
  on generated_artifact_records (workspace_id, owner_id, artifact_id)
  where storage_provider is not null;

-- RLS posture:
-- - No client-facing storage policies are added in this draft.
-- - Backend/service-role access remains server-only.
-- - Frontend direct Supabase DB/storage access remains forbidden.
-- - Public buckets, signed URLs, download URLs, local paths, internal refs,
--   storage refs, base64, and bytes remain forbidden in public JSON.
