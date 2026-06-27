-- H6-D.3 durable active-project preference.
-- Manual review/apply only. Never auto-apply from application startup.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_workspace_project_unique'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_workspace_project_unique
      unique (workspace_id, project_id);
  end if;
end;
$$;

create table public.workspace_user_preferences (
  workspace_id uuid not null,
  user_id uuid not null,
  active_project_id uuid,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  constraint workspace_user_preferences_membership_fk
    foreign key (workspace_id, user_id)
    references public.workspace_memberships (workspace_id, user_id)
    on delete cascade,
  constraint workspace_user_preferences_active_project_fk
    foreign key (workspace_id, active_project_id)
    references public.projects (workspace_id, project_id)
    on delete restrict
);

create index if not exists workspace_user_preferences_active_project_idx
  on public.workspace_user_preferences (workspace_id, active_project_id)
  where active_project_id is not null;

create or replace function public.set_workspace_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_workspace_user_preferences_updated_at() from public;
grant execute on function public.set_workspace_user_preferences_updated_at()
  to service_role;

drop trigger if exists workspace_user_preferences_updated_at
  on public.workspace_user_preferences;

create trigger workspace_user_preferences_updated_at
before update on public.workspace_user_preferences
for each row
execute function public.set_workspace_user_preferences_updated_at();

alter table public.workspace_user_preferences enable row level security;

revoke all on table public.workspace_user_preferences from public;
revoke all on table public.workspace_user_preferences from anon;
revoke all on table public.workspace_user_preferences from authenticated;
revoke all on table public.workspace_user_preferences from service_role;

grant select, insert, update, delete
  on table public.workspace_user_preferences
  to service_role;

comment on table public.workspace_user_preferences is
  'Backend-only per-user, per-workspace active-project preference. No browser authority or secret material.';

-- No backfill: existing users intentionally begin with no active project.