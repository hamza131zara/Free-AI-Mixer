begin;

create function public.free_ai_mixer_bootstrap_account_workspace(
  p_app_user_id uuid,
  p_auth_provider text,
  p_auth_subject text,
  p_email text,
  p_personal_workspace_id uuid,
  p_personal_workspace_name text
)
returns table (
  outcome text,
  app_user_id uuid,
  workspace_id uuid,
  workspace_created_by_user_id uuid,
  workspace_name text,
  workspace_deleted_at timestamptz,
  workspace_role text,
  membership_status text,
  app_user_created boolean,
  workspace_created boolean,
  membership_created boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_app public.app_users%rowtype;
  v_workspace public.workspaces%rowtype;
  v_membership public.workspace_memberships%rowtype;
  v_inserted_user_id uuid;
  v_inserted_workspace_id uuid;
  v_inserted_membership_workspace_id uuid;
  v_active_count integer;
  v_non_active_count integer;
  v_app_created boolean := false;
  v_workspace_created boolean := false;
  v_membership_created boolean := false;
begin
  if p_app_user_id is null
    or p_personal_workspace_id is null
    or p_auth_provider is distinct from 'supabase'
    or p_auth_subject is null
    or p_auth_subject is distinct from p_app_user_id::text
    or p_personal_workspace_name is distinct from 'Personal Workspace'
  then
    return query select
      'conflicting_state'::text, p_app_user_id, null::uuid, null::uuid,
      null::text, null::timestamptz, null::text, null::text,
      false, false, false;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.lower(pg_catalog.btrim(p_auth_provider)) || ':' || p_auth_subject,
      0
    )
  );

  lock table public.workspace_memberships in share row exclusive mode;

  begin
  select a.* into v_app
  from public.app_users as a
  where a.auth_provider = p_auth_provider
    and a.auth_subject = p_auth_subject
  for update;

  if not found then
    insert into public.app_users (id, auth_provider, auth_subject, email)
    values (p_app_user_id, p_auth_provider, p_auth_subject, p_email)
    on conflict do nothing
    returning id into v_inserted_user_id;

    v_app_created := v_inserted_user_id is not null;

    select a.* into v_app
    from public.app_users as a
    where a.auth_provider = p_auth_provider
      and a.auth_subject = p_auth_subject
    for update;
  end if;

  if v_app.id is null
    or v_app.id <> p_app_user_id
    or v_app.auth_provider <> p_auth_provider
    or v_app.auth_subject <> p_auth_subject
  then
    raise exception using
      errcode = 'P6001',
      message = 'account bootstrap conflicting state';
  end if;

  select
    count(*) filter (where m.status = 'active'),
    count(*) filter (where m.status <> 'active')
  into v_active_count, v_non_active_count
  from public.workspace_memberships as m
  where m.user_id = p_app_user_id;

  if v_active_count > 1 then
    return query select
      'multiple_active_memberships'::text, v_app.id, null::uuid, null::uuid,
      null::text, null::timestamptz, null::text, null::text,
      v_app_created, false, false;
    return;
  end if;

  if v_active_count = 0 and v_non_active_count > 0 then
    return query select
      'inactive_membership_blocked'::text, v_app.id, null::uuid, null::uuid,
      null::text, null::timestamptz, null::text, null::text,
      v_app_created, false, false;
    return;
  end if;

  if v_active_count = 1 then
    select m.* into v_membership
    from public.workspace_memberships as m
    join public.workspaces as w on w.id = m.workspace_id
    where m.user_id = p_app_user_id
      and m.status = 'active'
    for update of m, w;

    select w.* into v_workspace
    from public.workspaces as w
    where w.id = v_membership.workspace_id
    for update;

    if v_membership.workspace_id is null
      or v_workspace.id is null
      or v_workspace.deleted_at is not null
      or v_membership.role not in ('owner', 'admin', 'editor', 'viewer')
      or v_membership.status <> 'active'
    then
      raise exception using
        errcode = 'P6001',
        message = 'account bootstrap conflicting state';
    end if;

    return query select
      'existing_active_membership'::text, v_app.id, v_workspace.id,
      v_workspace.created_by_user_id, v_workspace.name, v_workspace.deleted_at,
      v_membership.role, v_membership.status, false, false, false;
    return;
  end if;

  select w.* into v_workspace
  from public.workspaces as w
  where w.id = p_personal_workspace_id
  for update;

  if not found then
    insert into public.workspaces (id, name, created_by_user_id)
    values (p_personal_workspace_id, p_personal_workspace_name, p_app_user_id)
    on conflict do nothing
    returning id into v_inserted_workspace_id;

    v_workspace_created := v_inserted_workspace_id is not null;

    select w.* into v_workspace
    from public.workspaces as w
    where w.id = p_personal_workspace_id
    for update;
  end if;

  if v_workspace.id is null
    or v_workspace.created_by_user_id <> p_app_user_id
    or v_workspace.name <> p_personal_workspace_name
    or v_workspace.deleted_at is not null
  then
    raise exception using
      errcode = 'P6001',
      message = 'account bootstrap conflicting state';
  end if;

  select m.* into v_membership
  from public.workspace_memberships as m
  where m.workspace_id = p_personal_workspace_id
    and m.user_id = p_app_user_id
  for update;

  if not found then
    insert into public.workspace_memberships (
      workspace_id, user_id, role, status
    ) values (
      p_personal_workspace_id, p_app_user_id, 'owner', 'active'
    )
    on conflict do nothing
    returning workspace_id into v_inserted_membership_workspace_id;

    v_membership_created := v_inserted_membership_workspace_id is not null;

    select m.* into v_membership
    from public.workspace_memberships as m
    where m.workspace_id = p_personal_workspace_id
      and m.user_id = p_app_user_id
    for update;
  end if;

  if v_membership.workspace_id is null
    or v_membership.user_id <> p_app_user_id
    or v_membership.role <> 'owner'
    or v_membership.status <> 'active'
  then
    raise exception using
      errcode = 'P6001',
      message = 'account bootstrap conflicting state';
  end if;

  return query select
    case
      when v_app_created and v_workspace_created and v_membership_created
        then 'created'::text
      else 'recovered_partial_state'::text
    end,
    v_app.id,
    v_workspace.id,
    v_workspace.created_by_user_id,
    v_workspace.name,
    v_workspace.deleted_at,
    v_membership.role,
    v_membership.status,
    v_app_created,
    v_workspace_created,
    v_membership_created;
  exception
    when sqlstate 'P6001' then
      return query select
        'conflicting_state'::text, p_app_user_id, null::uuid, null::uuid,
        null::text, null::timestamptz, null::text, null::text,
        false, false, false;
      return;
  end;
end;
$$;

revoke all on function public.free_ai_mixer_bootstrap_account_workspace(
  uuid, text, text, text, uuid, text
) from public;
revoke all on function public.free_ai_mixer_bootstrap_account_workspace(
  uuid, text, text, text, uuid, text
) from anon;
revoke all on function public.free_ai_mixer_bootstrap_account_workspace(
  uuid, text, text, text, uuid, text
) from authenticated;
grant execute on function public.free_ai_mixer_bootstrap_account_workspace(
  uuid, text, text, text, uuid, text
) to service_role;

comment on function public.free_ai_mixer_bootstrap_account_workspace(
  uuid, text, text, text, uuid, text
) is 'Backend-only atomic account, personal workspace, and owner membership bootstrap.';

commit;
