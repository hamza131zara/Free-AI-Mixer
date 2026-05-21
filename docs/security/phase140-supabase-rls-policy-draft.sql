-- Phase 140 - Supabase RLS Policy Draft + Migration Audit Pack
--
-- DRAFT ONLY.
-- Do not apply this file directly to production.
-- This file is intentionally stored under docs/security, not supabase/migrations.
--
-- Safety boundaries:
-- - no service-role key usage
-- - no frontend Supabase/storage access
-- - no signed/download/storage URL behavior
-- - no public artifact delivery enablement
-- - no route behavior change
-- - no automatic RLS application

-- Future table assumptions:
-- - export_jobs contains: job_id, owner_id, workspace_id
-- - export_artifacts contains: artifact_id, job_id, workspace_id
-- - workspace_memberships contains: user_id, workspace_id, role, status

-- Future authenticated requester assumptions:
-- - auth.uid() maps to the authenticated user id
-- - workspace membership must be verified through workspace_memberships
-- - active membership means status = 'active'

-- Future migration draft:

-- alter table public.export_jobs enable row level security;
-- alter table public.export_artifacts enable row level security;
-- alter table public.workspace_memberships enable row level security;

-- create policy export_jobs_owner_select
-- on public.export_jobs
-- for select
-- using (
--   owner_id = auth.uid()::text
-- );

-- create policy export_jobs_workspace_member_select
-- on public.export_jobs
-- for select
-- using (
--   exists (
--     select 1
--     from public.workspace_memberships wm
--     where wm.workspace_id = export_jobs.workspace_id
--       and wm.user_id = auth.uid()::text
--       and wm.status = 'active'
--   )
-- );

-- create policy export_artifacts_workspace_member_select
-- on public.export_artifacts
-- for select
-- using (
--   exists (
--     select 1
--     from public.workspace_memberships wm
--     where wm.workspace_id = export_artifacts.workspace_id
--       and wm.user_id = auth.uid()::text
--       and wm.status = 'active'
--   )
-- );

-- create policy workspace_memberships_self_select
-- on public.workspace_memberships
-- for select
-- using (
--   user_id = auth.uid()::text
-- );

-- Deferred:
-- - insert/update/delete policies
-- - storage bucket policies
-- - signed URL policies
-- - remote Supabase verification
-- - route/runtime RLS enforcement wiring
