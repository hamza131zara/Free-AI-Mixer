begin;

-- H6-D.4 transactional active-project selection and project soft deletion.
-- Manual review/apply only. Never auto-apply from application startup.

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'projects_deleted_state_check'
      and conrelid = 'public.projects'::pg_catalog.regclass
  ) then
    raise exception using
      message = 'projects_deleted_state_check already exists',
      hint = 'Review the existing constraint before applying H6-D.4; this migration never skips or replaces it.';
  end if;

  if pg_catalog.to_regprocedure(
    'public.set_active_project_for_workspace_user(uuid,uuid,uuid)'
  ) is not null then
    raise exception using
      message = 'set_active_project_for_workspace_user(uuid,uuid,uuid) already exists',
      hint = 'Review the existing function before applying H6-D.4; this migration never replaces it.';
  end if;

  if pg_catalog.to_regprocedure(
    'public.soft_delete_project_for_workspace_user(uuid,uuid,uuid)'
  ) is not null then
    raise exception using
      message = 'soft_delete_project_for_workspace_user(uuid,uuid,uuid) already exists',
      hint = 'Review the existing function before applying H6-D.4; this migration never replaces it.';
  end if;

  if exists (
    select 1
    from public.projects
    where (status = 'deleted' and deleted_at is null)
       or (status <> 'deleted' and deleted_at is not null)
  ) then
    raise exception using
      message = 'projects status/deleted_at preflight failed',
      hint = 'Review inconsistent project rows before applying H6-D.4; this migration never rewrites them.';
  end if;

end;
$$;

alter table public.projects
  add constraint projects_deleted_state_check
  check (
    status is not null
    and (
      (status = 'deleted' and deleted_at is not null)
      or (status <> 'deleted' and deleted_at is null)
    )
  );

grant select on table public.workspace_memberships to service_role;
grant update (updated_at)
on table public.workspace_memberships
to service_role;
grant select, update on table public.projects to service_role;
grant select, insert, update on table public.workspace_user_preferences
  to service_role;

create function public.set_active_project_for_workspace_user(
  p_workspace_id uuid,
  p_user_id uuid,
  p_project_id uuid
)
returns text
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_membership_role text;
  v_project_id uuid;
begin
  select membership.role
    into v_membership_role
    from public.workspace_memberships as membership
   where membership.workspace_id = p_workspace_id
     and membership.user_id = p_user_id
     and membership.status = 'active'
   for share;

  if not found then
    return 'forbidden';
  end if;

  select project.project_id
    into v_project_id
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.project_id = p_project_id
     and project.status = 'active'
     and project.deleted_at is null
   for update;

  if not found then
    return 'not_found';
  end if;

  insert into public.workspace_user_preferences (
    workspace_id,
    user_id,
    active_project_id
  ) values (
    p_workspace_id,
    p_user_id,
    v_project_id
  )
  on conflict (workspace_id, user_id)
  do update set active_project_id = excluded.active_project_id;

  return 'selected';
end;
$$;

create function public.soft_delete_project_for_workspace_user(
  p_workspace_id uuid,
  p_user_id uuid,
  p_project_id uuid
)
returns text
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_membership_role text;
  v_project_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select membership.role
    into v_membership_role
    from public.workspace_memberships as membership
   where membership.workspace_id = p_workspace_id
     and membership.user_id = p_user_id
     and membership.status = 'active'
   for share;

  if not found or v_membership_role not in ('owner', 'admin') then
    return 'forbidden';
  end if;

  select project.project_id
    into v_project_id
    from public.projects as project
   where project.workspace_id = p_workspace_id
     and project.project_id = p_project_id
     and project.status = 'active'
     and project.deleted_at is null
   for update;

  if not found then
    return 'not_found';
  end if;

  update public.workspace_user_preferences
     set active_project_id = null
   where workspace_id = p_workspace_id
     and active_project_id = v_project_id;

  update public.projects
     set status = 'deleted',
         deleted_at = v_now,
         updated_at = v_now
   where workspace_id = p_workspace_id
     and project_id = v_project_id;

  return 'deleted';
end;
$$;

revoke all on function public.set_active_project_for_workspace_user(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_active_project_for_workspace_user(uuid, uuid, uuid)
  to service_role;

revoke all on function public.soft_delete_project_for_workspace_user(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.soft_delete_project_for_workspace_user(uuid, uuid, uuid)
  to service_role;

comment on function public.set_active_project_for_workspace_user(uuid, uuid, uuid) is
  'Backend-only transactional active-project selection. Returns selected, forbidden, or not_found.';
comment on function public.soft_delete_project_for_workspace_user(uuid, uuid, uuid) is
  'Backend-only transactional project soft deletion. Preserves generation, history, artifact, preview, and storage records.';

commit;
