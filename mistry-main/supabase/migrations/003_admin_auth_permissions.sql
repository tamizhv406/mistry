-- Server-side account roles and record-level authorization for Supabase Auth.
-- Additive migration: existing auth users and mistry_records rows are preserved.

create table if not exists public.mistry_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text not null default '',
  full_name text not null default '',
  mobile text not null default '',
  role text not null default 'USER'
    check (role in ('USER', 'SUB_ADMIN', 'SUPER_ADMIN')),
  is_active boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mistry_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.mistry_members enable row level security;
alter table public.mistry_admin_audit enable row level security;

create or replace function public.mistry_permission_scope(record_table text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case record_table
    when 'sites' then 'projects'
    when 'siteComments' then 'projects'
    when 'workers' then 'labour'
    when 'attendance' then 'labour'
    when 'salaryPayments' then 'payroll'
    when 'labourAdvances' then 'payroll'
    when 'materials' then 'materials'
    when 'rodEntries' then 'materials'
    when 'stockMovements' then 'materials'
    when 'catalogItems' then 'materials'
    when 'tools' then 'expenses'
    when 'toolAssets' then 'expenses'
    when 'toolIssues' then 'expenses'
    when 'teaSnacksExpenses' then 'expenses'
    when 'poojaExpenses' then 'expenses'
    when 'electricityBills' then 'expenses'
    when 'waterBills' then 'expenses'
    when 'otherExpenses' then 'expenses'
    when 'payments' then 'expenses'
    when 'floorPlans' then 'floor_plans'
    when 'estimates' then 'estimates'
    when 'materialPrices' then 'estimates'
    else null
  end
$$;

create or replace function public.mistry_has_member_scope(scope_name text, access_name text default 'read')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select m.is_active and (
      m.role = 'SUPER_ADMIN'
      or (
        m.role = 'SUB_ADMIN'
        and (
          coalesce((m.permissions -> scope_name ->> access_name)::boolean, false)
          or (
            access_name = 'read'
            and coalesce((m.permissions -> scope_name ->> 'write')::boolean, false)
          )
        )
      )
    )
    from public.mistry_members as m
    where m.user_id = (select auth.uid())
  ), false)
$$;

create or replace function public.mistry_can_access_record(
  record_owner uuid,
  record_table text,
  access_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  actor_active boolean;
  permission_scope text;
  has_scope boolean;
begin
  select m.role, m.is_active
    into actor_role, actor_active
    from public.mistry_members as m
    where m.user_id = (select auth.uid());

  if not found or not actor_active then
    return false;
  end if;

  if record_owner = (select auth.uid()) then
    return true;
  end if;

  if actor_role = 'SUPER_ADMIN' then
    return true;
  end if;

  if actor_role <> 'SUB_ADMIN' then
    return false;
  end if;

  permission_scope := public.mistry_permission_scope(record_table);
  if permission_scope is null then
    return false;
  end if;

  select public.mistry_has_member_scope(permission_scope, access_name)
    into has_scope;
  return coalesce(has_scope, false);
end;
$$;

create or replace function public.mistry_create_member_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mistry_members (user_id, email, username, full_name, mobile)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'username', ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'mobile', '')
  )
  on conflict (user_id) do update
    set email = excluded.email,
    username = case
      when public.mistry_members.username = '' then excluded.username
      else public.mistry_members.username
        end,
    full_name = case
      when public.mistry_members.full_name = '' then excluded.full_name
      else public.mistry_members.full_name
    end,
    mobile = case
      when public.mistry_members.mobile = '' then excluded.mobile
      else public.mistry_members.mobile
    end,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists mistry_create_member_for_auth_user on auth.users;
create trigger mistry_create_member_for_auth_user
  after insert on auth.users
  for each row execute function public.mistry_create_member_for_auth_user();

-- Existing auth accounts become regular members; prior project rows are not rewritten.
insert into public.mistry_members (user_id, email, username, full_name, mobile)
select u.id,
       coalesce(u.email, ''),
       coalesce(u.raw_user_meta_data ->> 'username', ''),
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       coalesce(u.raw_user_meta_data ->> 'mobile', '')
from auth.users as u
on conflict (user_id) do nothing;

drop policy if exists "mistry_members read self or authorized admin" on public.mistry_members;
create policy "mistry_members read self or authorized admin"
  on public.mistry_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.mistry_has_member_scope('users', 'read')
  );

drop policy if exists "mistry_admin_audit read authorized admins" on public.mistry_admin_audit;
create policy "mistry_admin_audit read authorized admins"
  on public.mistry_admin_audit for select to authenticated
  using (public.mistry_has_member_scope('users', 'read'));

revoke all on public.mistry_members from anon, authenticated;
grant select on public.mistry_members to authenticated;
revoke all on public.mistry_admin_audit from anon, authenticated;
grant select on public.mistry_admin_audit to authenticated;

create or replace function public.mistry_set_member_access(
  target_user_id uuid,
  target_role text,
  target_active boolean,
  target_permissions jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target public.mistry_members%rowtype;
  cleaned_permissions jsonb;
  scope_name text;
  read_access boolean;
  write_access boolean;
begin
  if not public.mistry_has_member_scope('users', 'write')
    or not exists (
      select 1 from public.mistry_members
      where user_id = actor_id and role = 'SUPER_ADMIN' and is_active
    )
  then
    raise exception 'Only an active Super Admin can manage accounts';
  end if;

  if target_role not in ('USER', 'SUB_ADMIN') then
    raise exception 'The requested role is not manageable';
  end if;

  select * into target
    from public.mistry_members
    where user_id = target_user_id
    for update;
  if not found then
    raise exception 'Account not found';
  end if;

  if target.role = 'SUPER_ADMIN' then
    raise exception 'Super Admin accounts must be managed through the secure setup process';
  end if;
  if target_user_id = actor_id and not target_active then
    raise exception 'You cannot disable your own account';
  end if;

  cleaned_permissions := '{}'::jsonb;
  foreach scope_name in array array[
    'users', 'projects', 'labour', 'payroll', 'materials',
    'expenses', 'floor_plans', 'estimates'
  ]
  loop
    read_access := coalesce((target_permissions -> scope_name ->> 'read')::boolean, false);
    write_access := coalesce((target_permissions -> scope_name ->> 'write')::boolean, false);
    cleaned_permissions := cleaned_permissions || jsonb_build_object(
      scope_name,
      jsonb_build_object('read', read_access or write_access, 'write', write_access)
    );
  end loop;

  update public.mistry_members
    set role = target_role,
        is_active = target_active,
        permissions = case when target_role = 'SUB_ADMIN' then cleaned_permissions else '{}'::jsonb end,
        updated_at = now()
    where user_id = target_user_id;

  insert into public.mistry_admin_audit (actor_id, target_user_id, action, details)
  values (
    actor_id,
    target_user_id,
    'MEMBER_ACCESS_UPDATED',
    jsonb_build_object(
      'from_role', target.role,
      'to_role', target_role,
      'active', target_active,
      'permissions', case when target_role = 'SUB_ADMIN' then cleaned_permissions else '{}'::jsonb end
    )
  );
end;
$$;

revoke all on function public.mistry_set_member_access(uuid, text, boolean, jsonb) from public, anon;
grant execute on function public.mistry_set_member_access(uuid, text, boolean, jsonb) to authenticated;

create or replace function public.mistry_log_admin_action(
  action_name text,
  target_user_id uuid default null,
  action_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.mistry_members
    where user_id = actor_id and role = 'SUPER_ADMIN' and is_active
  ) then
    raise exception 'Only an active Super Admin can record this action';
  end if;
  if action_name not in ('PASSWORD_RECOVERY_SENT') then
    raise exception 'The requested audit action is not allowed';
  end if;

  insert into public.mistry_admin_audit (actor_id, target_user_id, action, details)
  values (actor_id, target_user_id, action_name, coalesce(action_details, '{}'::jsonb));
end;
$$;

revoke all on function public.mistry_log_admin_action(text, uuid, jsonb) from public, anon;
grant execute on function public.mistry_log_admin_action(text, uuid, jsonb) to authenticated;

drop policy if exists "mistry_records owner can read" on public.mistry_records;
drop policy if exists "mistry_records owner can insert" on public.mistry_records;
drop policy if exists "mistry_records owner can update" on public.mistry_records;

create policy "mistry_records owner or authorized admin can read"
  on public.mistry_records for select to authenticated
  using (public.mistry_can_access_record(owner_id, table_name, 'read'));

create policy "mistry_records owner or authorized admin can insert"
  on public.mistry_records for insert to authenticated
  with check (public.mistry_can_access_record(owner_id, table_name, 'write'));

create policy "mistry_records owner or authorized admin can update"
  on public.mistry_records for update to authenticated
  using (public.mistry_can_access_record(owner_id, table_name, 'write'))
  with check (public.mistry_can_access_record(owner_id, table_name, 'write'));

revoke all on function public.mistry_has_member_scope(text, text) from public, anon;
grant execute on function public.mistry_has_member_scope(text, text) to authenticated;
revoke all on function public.mistry_can_access_record(uuid, text, text) from public, anon;
grant execute on function public.mistry_can_access_record(uuid, text, text) to authenticated;
