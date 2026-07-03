begin;

-- Backend-only atomic generated-image persistence. Manual review/apply only.
do $$
begin
  if pg_catalog.to_regclass(
    'public.generated_image_bundle_idempotency'
  ) is not null then
    raise exception using
      message = 'generated_image_bundle_idempotency already exists',
      hint = 'Review the existing table before applying H6-JA; this migration never skips or replaces it.';
  end if;

  if pg_catalog.to_regprocedure(
    'public.free_ai_mixer_persist_generated_image_bundle(uuid,text,uuid,uuid,uuid,text,uuid,text,text,bigint,text,timestamptz,text,text,text,bigint,text,timestamptz,text,text)'
  ) is not null then
    raise exception using
      message = 'free_ai_mixer_persist_generated_image_bundle already exists',
      hint = 'Review the existing function before applying H6-JA; this migration never skips or replaces it.';
  end if;
end;
$$;

create table public.generated_image_bundle_idempotency (
  idempotency_key text primary key,
  generation_job_id uuid not null unique,
  artifact_id text not null,
  history_id uuid not null unique,
  workspace_id uuid not null references public.workspaces(id),
  owner_id uuid not null references public.app_users(id),
  project_id uuid not null references public.projects(project_id),
  provider_id text not null,
  prompt_summary text,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_at timestamptz not null,
  storage_provider text not null,
  storage_bucket text not null,
  storage_object_key text not null,
  storage_content_type text not null,
  storage_size_bytes bigint not null,
  storage_sha256 text not null,
  storage_created_at timestamptz not null,
  constraint generated_image_bundle_idempotency_content_type_check
    check (content_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint generated_image_bundle_idempotency_size_check
    check (size_bytes > 0 and storage_size_bytes > 0),
  constraint generated_image_bundle_idempotency_sha256_check
    check (
      sha256 ~ '^[a-f0-9]{64}$'
      and storage_sha256 ~ '^[a-f0-9]{64}$'
    ),
  constraint generated_image_bundle_idempotency_storage_provider_check
    check (storage_provider = 'supabase_storage'),
  constraint generated_image_bundle_idempotency_storage_identity_check
    check (
      storage_content_type = content_type
      and storage_size_bytes = size_bytes
      and storage_sha256 = sha256
    ),
  constraint generated_image_bundle_idempotency_artifact_fkey
    foreign key (generation_job_id, artifact_id)
    references public.generated_artifact_records(generation_job_id, artifact_id)
    on delete cascade,
  constraint generated_image_bundle_idempotency_history_fkey
    foreign key (history_id)
    references public.image_generation_history(history_id)
    on delete cascade
);

alter table public.generated_image_bundle_idempotency enable row level security;
revoke all on table public.generated_image_bundle_idempotency
  from public, anon, authenticated, service_role;

comment on table public.generated_image_bundle_idempotency is
  'Backend-only exact generated-image request identity. Never expose storage metadata through public responses.';

create function public.free_ai_mixer_persist_generated_image_bundle(
  p_generation_job_id uuid,
  p_idempotency_key text,
  p_workspace_id uuid,
  p_owner_id uuid,
  p_project_id uuid,
  p_artifact_id text,
  p_history_id uuid,
  p_provider_id text,
  p_prompt_summary text,
  p_size_bytes bigint,
  p_sha256 text,
  p_created_at timestamptz,
  p_content_type text,
  p_storage_provider text,
  p_storage_bucket text,
  p_storage_size_bytes bigint,
  p_storage_sha256 text,
  p_storage_created_at timestamptz,
  p_storage_object_key text,
  p_storage_content_type text
)
returns table (
  outcome text,
  generation_job_id uuid,
  artifact_id text,
  history_id uuid,
  generation_job_created boolean,
  artifact_created boolean,
  history_created boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_idempotency public.generated_image_bundle_idempotency%rowtype;
  v_job public.generation_jobs%rowtype;
  v_artifact public.generated_artifact_records%rowtype;
  v_history public.image_generation_history%rowtype;
begin
  if p_generation_job_id is null
    or p_workspace_id is null
    or p_owner_id is null
    or p_project_id is null
    or p_history_id is null
    or p_idempotency_key is null
    or pg_catalog.btrim(p_idempotency_key) = ''
    or p_artifact_id is null
    or pg_catalog.btrim(p_artifact_id) = ''
    or p_provider_id is null
    or pg_catalog.btrim(p_provider_id) = ''
    or p_content_type not in ('image/png', 'image/jpeg', 'image/webp')
    or p_size_bytes is null
    or p_size_bytes <= 0
    or p_sha256 is null
    or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_created_at is null
    or p_storage_provider is distinct from 'supabase_storage'
    or p_storage_bucket is null
    or pg_catalog.btrim(p_storage_bucket) = ''
    or p_storage_object_key is null
    or pg_catalog.btrim(p_storage_object_key) = ''
    or p_storage_content_type is distinct from p_content_type
    or p_storage_size_bytes is distinct from p_size_bytes
    or p_storage_sha256 is null
    or p_storage_sha256 is distinct from p_sha256
    or p_storage_created_at is null
  then
    raise exception using
      errcode = 'P6001',
      message = 'generated image bundle conflicting state';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_idempotency_key,
      0
    )
  );

  if not exists (
    select 1
    from public.app_users as app_user
    where app_user.id = p_owner_id
  ) or not exists (
    select 1
    from public.workspace_memberships as membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = p_owner_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ) or not exists (
    select 1
    from public.projects as project
    where project.project_id = p_project_id
      and project.workspace_id = p_workspace_id
      and project.status = 'active'
      and project.deleted_at is null
  ) then
    raise exception using
      errcode = 'P6001',
      message = 'generated image bundle conflicting state';
  end if;

  select identity_record.* into v_idempotency
  from public.generated_image_bundle_idempotency as identity_record
  where identity_record.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_idempotency.generation_job_id is distinct from p_generation_job_id
      or v_idempotency.artifact_id is distinct from p_artifact_id
      or v_idempotency.history_id is distinct from p_history_id
      or v_idempotency.workspace_id is distinct from p_workspace_id
      or v_idempotency.owner_id is distinct from p_owner_id
      or v_idempotency.project_id is distinct from p_project_id
      or v_idempotency.provider_id is distinct from p_provider_id
      or v_idempotency.prompt_summary is distinct from p_prompt_summary
      or v_idempotency.content_type is distinct from p_content_type
      or v_idempotency.size_bytes is distinct from p_size_bytes
      or v_idempotency.sha256 is distinct from p_sha256
      or v_idempotency.created_at is distinct from p_created_at
      or v_idempotency.storage_provider is distinct from p_storage_provider
      or v_idempotency.storage_bucket is distinct from p_storage_bucket
      or v_idempotency.storage_object_key is distinct from p_storage_object_key
      or v_idempotency.storage_content_type is distinct from p_storage_content_type
      or v_idempotency.storage_size_bytes is distinct from p_storage_size_bytes
      or v_idempotency.storage_sha256 is distinct from p_storage_sha256
      or v_idempotency.storage_created_at is distinct from p_storage_created_at
    then
      raise exception using
        errcode = 'P6001',
        message = 'generated image bundle conflicting state';
    end if;

    select job.* into v_job
    from public.generation_jobs as job
    where job.generation_job_id = v_idempotency.generation_job_id
    for update;

    select artifact.* into v_artifact
    from public.generated_artifact_records as artifact
    where artifact.generation_job_id = v_idempotency.generation_job_id
      and artifact.artifact_id = v_idempotency.artifact_id
    for update;

    select history.* into v_history
    from public.image_generation_history as history
    where history.history_id = v_idempotency.history_id
    for update;

    if v_job.generation_job_id is distinct from p_generation_job_id
      or v_job.workspace_id is distinct from p_workspace_id
      or v_job.owner_id is distinct from p_owner_id
      or v_job.project_id is distinct from p_project_id
      or v_job.generation_kind is distinct from 'image'
      or v_job.provider_id is distinct from p_provider_id
      or v_job.status is distinct from 'generated_metadata_ready'
      or v_job.lifecycle_state is distinct from 'metadata_ready'
      or v_job.prompt_summary is distinct from p_prompt_summary
      or v_artifact.generation_job_id is distinct from p_generation_job_id
      or v_artifact.artifact_id is distinct from p_artifact_id
      or v_artifact.workspace_id is distinct from p_workspace_id
      or v_artifact.owner_id is distinct from p_owner_id
      or v_artifact.provider_id is distinct from p_provider_id
      or v_artifact.generation_kind is distinct from 'image'
      or v_artifact.content_type is distinct from p_content_type
      or v_artifact.size_bytes is distinct from p_size_bytes
      or v_artifact.sha256 is distinct from p_sha256
      or v_artifact.delivery_status is distinct from 'unavailable'
      or v_artifact.storage_state is distinct from 'available'
      or v_artifact.created_at is distinct from p_created_at
      or v_artifact.storage_provider is distinct from p_storage_provider
      or v_artifact.storage_bucket is distinct from p_storage_bucket
      or v_artifact.storage_object_key is distinct from p_storage_object_key
      or v_artifact.storage_content_type is distinct from p_storage_content_type
      or v_artifact.storage_size_bytes is distinct from p_storage_size_bytes
      or v_artifact.storage_sha256 is distinct from p_storage_sha256
      or v_artifact.storage_created_at is distinct from p_storage_created_at
      or v_history.history_id is distinct from p_history_id
      or v_history.workspace_id is distinct from p_workspace_id
      or v_history.owner_id is distinct from p_owner_id
      or v_history.project_id is distinct from p_project_id
      or v_history.generation_job_id is distinct from p_generation_job_id
      or v_history.artifact_id is distinct from p_artifact_id
      or v_history.provider_id is distinct from p_provider_id
      or v_history.prompt_summary is distinct from p_prompt_summary
      or v_history.content_type is distinct from p_content_type
      or v_history.size_bytes is distinct from p_size_bytes
      or v_history.sha256 is distinct from p_sha256
      or v_history.delivery_status is distinct from 'unavailable'
      or v_history.status is distinct from 'metadata_ready'
      or v_history.created_at is distinct from p_created_at
    then
      raise exception using
        errcode = 'P6001',
        message = 'generated image bundle conflicting state';
    end if;

    return query select
      'replayed'::text,
      v_job.generation_job_id,
      v_artifact.artifact_id,
      v_history.history_id,
      false,
      false,
      false;
    return;
  end if;

  if exists (
    select 1 from public.generation_jobs as job
    where job.generation_job_id = p_generation_job_id
       or job.request_id = p_idempotency_key
  ) or exists (
    select 1 from public.image_generation_history as history
    where history.history_id = p_history_id
  ) then
    raise exception using
      errcode = 'P6001',
      message = 'generated image bundle conflicting state';
  end if;

  insert into public.generation_jobs (
    generation_job_id,
    request_id,
    workspace_id,
    owner_id,
    project_id,
    generation_kind,
    provider_id,
    status,
    lifecycle_state,
    prompt_summary,
    created_at,
    updated_at,
    completed_at
  ) values (
    p_generation_job_id,
    p_idempotency_key,
    p_workspace_id,
    p_owner_id,
    p_project_id,
    'image',
    p_provider_id,
    'generated_metadata_ready',
    'metadata_ready',
    p_prompt_summary,
    p_created_at,
    p_created_at,
    p_created_at
  );

  insert into public.generated_artifact_records (
    artifact_id,
    generation_job_id,
    workspace_id,
    owner_id,
    provider_id,
    generation_kind,
    content_type,
    size_bytes,
    sha256,
    delivery_status,
    storage_state,
    created_at,
    storage_provider,
    storage_bucket,
    storage_object_key,
    storage_content_type,
    storage_size_bytes,
    storage_sha256,
    storage_created_at
  ) values (
    p_artifact_id,
    p_generation_job_id,
    p_workspace_id,
    p_owner_id,
    p_provider_id,
    'image',
    p_content_type,
    p_size_bytes,
    p_sha256,
    'unavailable',
    'available',
    p_created_at,
    p_storage_provider,
    p_storage_bucket,
    p_storage_object_key,
    p_storage_content_type,
    p_storage_size_bytes,
    p_storage_sha256,
    p_storage_created_at
  );

  insert into public.image_generation_history (
    history_id,
    workspace_id,
    owner_id,
    project_id,
    generation_job_id,
    artifact_id,
    provider_id,
    prompt_summary,
    content_type,
    size_bytes,
    sha256,
    delivery_status,
    status,
    created_at
  ) values (
    p_history_id,
    p_workspace_id,
    p_owner_id,
    p_project_id,
    p_generation_job_id,
    p_artifact_id,
    p_provider_id,
    p_prompt_summary,
    p_content_type,
    p_size_bytes,
    p_sha256,
    'unavailable',
    'metadata_ready',
    p_created_at
  );

  insert into public.generated_image_bundle_idempotency (
    idempotency_key,
    generation_job_id,
    artifact_id,
    history_id,
    workspace_id,
    owner_id,
    project_id,
    provider_id,
    prompt_summary,
    content_type,
    size_bytes,
    sha256,
    created_at,
    storage_provider,
    storage_bucket,
    storage_object_key,
    storage_content_type,
    storage_size_bytes,
    storage_sha256,
    storage_created_at
  ) values (
    p_idempotency_key,
    p_generation_job_id,
    p_artifact_id,
    p_history_id,
    p_workspace_id,
    p_owner_id,
    p_project_id,
    p_provider_id,
    p_prompt_summary,
    p_content_type,
    p_size_bytes,
    p_sha256,
    p_created_at,
    p_storage_provider,
    p_storage_bucket,
    p_storage_object_key,
    p_storage_content_type,
    p_storage_size_bytes,
    p_storage_sha256,
    p_storage_created_at
  );

  return query select
    'created'::text,
    p_generation_job_id,
    p_artifact_id,
    p_history_id,
    true,
    true,
    true;
end;
$$;

revoke all on function public.free_ai_mixer_persist_generated_image_bundle(
  uuid, text, uuid, uuid, uuid, text, uuid, text, text, bigint, text,
  timestamptz, text, text, text, bigint, text, timestamptz, text, text
) from public;
revoke all on function public.free_ai_mixer_persist_generated_image_bundle(
  uuid, text, uuid, uuid, uuid, text, uuid, text, text, bigint, text,
  timestamptz, text, text, text, bigint, text, timestamptz, text, text
) from anon;
revoke all on function public.free_ai_mixer_persist_generated_image_bundle(
  uuid, text, uuid, uuid, uuid, text, uuid, text, text, bigint, text,
  timestamptz, text, text, text, bigint, text, timestamptz, text, text
) from authenticated;
grant execute on function public.free_ai_mixer_persist_generated_image_bundle(
  uuid, text, uuid, uuid, uuid, text, uuid, text, text, bigint, text,
  timestamptz, text, text, text, bigint, text, timestamptz, text, text
) to service_role;

comment on function public.free_ai_mixer_persist_generated_image_bundle(
  uuid, text, uuid, uuid, uuid, text, uuid, text, text, bigint, text,
  timestamptz, text, text, text, bigint, text, timestamptz, text, text
) is 'Backend-only transactional and idempotent generated-image metadata persistence.';

commit;
