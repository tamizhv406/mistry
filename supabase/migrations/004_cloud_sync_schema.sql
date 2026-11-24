-- ==============================================================================
-- BUILDING MISTRY — SUPABASE CLOUD DATABASE SYNC & AUTH SCHEMA
-- Migration: 004_cloud_sync_schema.sql
--
-- Tables:
-- 1. profiles    - User profile details linked to auth.users.id
-- 2. projects    - Construction projects owned by users
-- 3. workers     - Laborers / technicians assigned to projects
-- 4. attendance  - Daily labor attendance records with wages earned
-- 5. materials   - Site procurement (cement, sand, steel, bricks, etc.)
-- 6. expenses    - Operational petty cash / site expenses
--
-- Security:
-- * Strict Row Level Security (RLS) on all tables
-- * Isolated tenant data: users can only view, insert, update and delete their own records
-- ==============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "pgcrypto";

-- ==============================================================================
-- 1. PROFILES TABLE
-- ==============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  phone       text default '',
  role        text not null default 'contractor' check (role in ('contractor', 'engineer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Contractor and Engineer user profiles linked to Supabase Auth.';

create index if not exists profiles_phone_idx on public.profiles (phone);

-- ==============================================================================
-- 2. PROJECTS TABLE
-- ==============================================================================
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  client_name   text default '',
  client_phone  text default '',
  location      text default '',
  building_type text default 'residential',
  budget        numeric not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.projects is 'Construction projects owned by contractors/engineers.';

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_created_at_idx on public.projects (created_at desc);

-- ==============================================================================
-- 3. WORKERS TABLE
-- ==============================================================================
create table if not exists public.workers (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  phone       text default '',
  trade       text not null default 'mason',
  daily_wage  numeric not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.workers is 'Construction workers assigned to project sites.';

create index if not exists workers_project_id_idx on public.workers (project_id);
create index if not exists workers_user_id_idx on public.workers (user_id);

-- ==============================================================================
-- 4. ATTENDANCE TABLE
-- ==============================================================================
create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  worker_id   uuid not null references public.workers (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null default current_date,
  status      text not null default 'P' check (status in ('P', 'A', 'half', 'OT')),
  wage_earned numeric not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.attendance is 'Daily labor attendance records with calculated wages.';

create index if not exists attendance_project_id_idx on public.attendance (project_id);
create index if not exists attendance_worker_id_idx on public.attendance (worker_id);
create index if not exists attendance_user_id_idx on public.attendance (user_id);
create index if not exists attendance_date_idx on public.attendance (date);
create index if not exists attendance_worker_date_idx on public.attendance (worker_id, date);

-- ==============================================================================
-- 5. MATERIALS TABLE
-- ==============================================================================
create table if not exists public.materials (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category        text not null default 'others' check (category in ('cement', 'sand', 'steel', 'bricks', 'others')),
  brand           text default '',
  quantity        numeric not null default 0,
  unit            text not null default 'bags',
  price_per_unit  numeric not null default 0,
  total_amount    numeric not null default 0,
  purchase_date   date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.materials is 'Site material purchases and delivery records.';

create index if not exists materials_project_id_idx on public.materials (project_id);
create index if not exists materials_user_id_idx on public.materials (user_id);
create index if not exists materials_category_idx on public.materials (category);

-- ==============================================================================
-- 6. EXPENSES TABLE
-- ==============================================================================
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category    text not null default 'others' check (category in ('tea_snacks', 'fuel', 'transport', 'others')),
  amount      numeric not null default 0,
  note        text default '',
  date        date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.expenses is 'Daily site operational expenses (tea/snacks, fuel, transport).';

create index if not exists expenses_project_id_idx on public.expenses (project_id);
create index if not exists expenses_user_id_idx on public.expenses (user_id);
create index if not exists expenses_date_idx on public.expenses (date);

-- ==============================================================================
-- 7. ENABLE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.workers enable row level security;
alter table public.attendance enable row level security;
alter table public.materials enable row level security;
alter table public.expenses enable row level security;

-- ── RLS POLICIES: PROFILES ───────────────────────────────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ── RLS POLICIES: PROJECTS ───────────────────────────────────────────────────
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ── RLS POLICIES: WORKERS ───────────────────────────────────────────────────
drop policy if exists "workers_select_own" on public.workers;
create policy "workers_select_own"
  on public.workers for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "workers_insert_own" on public.workers;
create policy "workers_insert_own"
  on public.workers for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "workers_update_own" on public.workers;
create policy "workers_update_own"
  on public.workers for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "workers_delete_own" on public.workers;
create policy "workers_delete_own"
  on public.workers for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ── RLS POLICIES: ATTENDANCE ────────────────────────────────────────────────
drop policy if exists "attendance_select_own" on public.attendance;
create policy "attendance_select_own"
  on public.attendance for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "attendance_insert_own" on public.attendance;
create policy "attendance_insert_own"
  on public.attendance for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own"
  on public.attendance for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "attendance_delete_own" on public.attendance;
create policy "attendance_delete_own"
  on public.attendance for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ── RLS POLICIES: MATERIALS ─────────────────────────────────────────────────
drop policy if exists "materials_select_own" on public.materials;
create policy "materials_select_own"
  on public.materials for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "materials_insert_own" on public.materials;
create policy "materials_insert_own"
  on public.materials for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "materials_update_own" on public.materials;
create policy "materials_update_own"
  on public.materials for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "materials_delete_own" on public.materials;
create policy "materials_delete_own"
  on public.materials for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ── RLS POLICIES: EXPENSES ──────────────────────────────────────────────────
drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own"
  on public.expenses for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own"
  on public.expenses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own"
  on public.expenses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own"
  on public.expenses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ==============================================================================
-- 8. EXPLICIT GRANTS FOR DATA API EXPOSURE
-- ==============================================================================
grant usage on schema public to anon, authenticated;
grant all on table public.profiles to anon, authenticated;
grant all on table public.projects to anon, authenticated;
grant all on table public.workers to anon, authenticated;
grant all on table public.attendance to anon, authenticated;
grant all on table public.materials to anon, authenticated;
grant all on table public.expenses to anon, authenticated;

-- ==============================================================================
-- 9. AUTH USER AUTO-PROFILE SYNC TRIGGER
-- ==============================================================================
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_phone     text;
  v_role      text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.phone,
    split_part(coalesce(new.email, ''), '@', 1),
    'Builder'
  );
  v_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone', '');
  v_role := coalesce(new.raw_user_meta_data->>'role', 'contractor');
  if v_role not in ('contractor', 'engineer') then
    v_role := 'contractor';
  end if;

  insert into public.profiles (id, full_name, phone, role, created_at, updated_at)
  values (new.id, v_full_name, v_phone, v_role, now(), now())
  on conflict (id) do update set
    full_name = excluded.full_name,
    phone = case when excluded.phone <> '' then excluded.phone else profiles.phone end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
