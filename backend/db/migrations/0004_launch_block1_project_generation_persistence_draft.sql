-- Launch Block 1 migration draft only.
-- Do not auto-apply this migration to production.
-- Manual local/staging apply must be reviewed before any remote production apply.
-- This draft adds project/generation/generated artifact persistence boundaries
-- that were missing from earlier schema drafts.

create table if not exists projects (
  project_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  title text not null,
  status text not null default 'active',
  project_state_safe_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projects_status_check
    check (status in ('active', 'archived', 'deleted')),
  constraint projects_state_safe_json_object_check
    check (jsonb_typeof(project_state_safe_json) = 'object')
);

comment on table projects is
  'Launch Block 1 draft project metadata table. Raw provider responses, API keys, JWTs, service-role values, local paths, storage refs, base64, bytes, public URLs, signed URLs, and download URLs are forbidden.';

create index if not exists projects_workspace_updated_idx
  on projects (workspace_id, updated_at desc);

create table if not exists generation_jobs (
  generation_job_id uuid primary key,
  request_id text not null,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  project_id uuid references projects(project_id),
  generation_kind text not null,
  provider_id text not null,
  status text not null,
  lifecycle_state text not null,
  prompt_summary text,
  failure_code text,
  diagnostic_code text,
  failure_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint generation_jobs_kind_check
    check (generation_kind in ('image', 'video')),
  constraint generation_jobs_status_check
    check (
      status in (
        'submitted',
        'processing',
        'generated_metadata_ready',
        'delivery_unavailable',
        'artifact_storage_failed',
        'video_artifact_storage_unavailable',
        'failed',
        'rejected'
      )
    ),
  constraint generation_jobs_lifecycle_check
    check (lifecycle_state in ('submitted', 'processing', 'metadata_ready', 'failed'))
);

comment on table generation_jobs is
  'Launch Block 1 draft generation job metadata only. Store safe prompt summaries only; never store provider request bodies, provider response bodies, raw prompts containing secrets, API keys, JWTs, service-role keys, image/video bytes, base64, URLs, local paths, or internal refs.';

create unique index if not exists generation_jobs_workspace_owner_request_unique
  on generation_jobs (workspace_id, owner_id, request_id);

create index if not exists generation_jobs_workspace_created_idx
  on generation_jobs (workspace_id, created_at desc);

create table if not exists generated_artifact_records (
  artifact_id text not null,
  generation_job_id uuid not null references generation_jobs(generation_job_id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  provider_id text not null,
  generation_kind text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  delivery_status text not null default 'unavailable',
  storage_state text not null default 'internal_only',
  created_at timestamptz not null default now(),
  constraint generated_artifact_records_pkey primary key (generation_job_id, artifact_id),
  constraint generated_artifact_records_kind_check
    check (generation_kind in ('image', 'video')),
  constraint generated_artifact_records_content_type_check
    check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm')),
  constraint generated_artifact_records_delivery_status_check
    check (delivery_status in ('unavailable', 'descriptor_only', 'ready_later')),
  constraint generated_artifact_records_storage_state_check
    check (storage_state in ('internal_only', 'pending_verification', 'available', 'failed')),
  constraint generated_artifact_records_size_positive_check
    check (size_bytes > 0),
  constraint generated_artifact_records_sha256_check
    check (sha256 ~ '^[a-f0-9]{64}$')
);

comment on table generated_artifact_records is
  'Launch Block 1 draft generated artifact metadata only. Do not persist local paths, internal refs, storage refs, provider URLs, public URLs, signed URLs, download URLs, base64, or bytes.';

create index if not exists generated_artifact_records_workspace_job_idx
  on generated_artifact_records (workspace_id, generation_job_id);

create table if not exists image_generation_history (
  history_id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  owner_id uuid not null references app_users(id),
  project_id uuid references projects(project_id),
  generation_job_id uuid references generation_jobs(generation_job_id) on delete set null,
  artifact_id text,
  provider_id text not null,
  prompt_summary text,
  content_type text,
  size_bytes bigint,
  sha256 text,
  delivery_status text not null default 'unavailable',
  status text not null,
  created_at timestamptz not null default now(),
  constraint image_generation_history_status_check
    check (status in ('metadata_ready', 'failed', 'unavailable')),
  constraint image_generation_history_delivery_status_check
    check (delivery_status in ('unavailable', 'descriptor_only', 'ready_later'))
);

comment on table image_generation_history is
  'Launch Block 1 draft server-side image generation history metadata. Browser-local history may remain a fallback when this persistence boundary is unavailable.';

create index if not exists image_generation_history_workspace_created_idx
  on image_generation_history (workspace_id, created_at desc);

alter table projects enable row level security;
alter table generation_jobs enable row level security;
alter table generated_artifact_records enable row level security;
alter table image_generation_history enable row level security;

-- RLS posture:
-- - No client-facing policies are added in this draft.
-- - Backend/service-role access remains server-only.
-- - Frontend direct Supabase DB/storage access remains forbidden.
-- - Remote production migration auto-apply remains forbidden.
