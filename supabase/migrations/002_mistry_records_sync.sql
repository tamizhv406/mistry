-- ==============================================================================
-- MISTRY — CLOUD COPY OF APP RECORDS (one JSONB document per record)
--
-- NOT APPLIED AUTOMATICALLY. Review, then run it once in the Supabase SQL editor
-- (or with `supabase db push`) on the project the app should use.
--
-- What it does
--   * Adds ONE new table, public.mistry_records. It does not alter, rename or drop
--     anything that already exists, and it is safe to run more than once.
--   * Every row belongs to the signed-in Supabase user (owner_id = auth.uid()).
--     Row Level Security lets a user read and write only their own rows.
--   * An older copy of a record can never overwrite a newer one (trigger below),
--     so two phones syncing the same account do not lose each other's newer work.
--
-- Why JSONB
--   The app keeps ~20 record types in IndexedDB whose fields still change between
--   releases. Each is stored here as the same JSON document the app uses locally,
--   keyed by (owner, table, id). Floor plans (walls, rooms, floors) fit naturally.
--
-- Never stored here: local password hashes, OTP sessions, security audit logs.
-- ==============================================================================

create table if not exists public.mistry_records (
  owner_id          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  table_name        text        not null,
  record_id         text        not null,
  site_id           text,
  data              jsonb       not null,
  is_deleted        boolean     not null default false,
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (owner_id, table_name, record_id),
  constraint mistry_records_table_name_len check (char_length(table_name) between 1 and 40),
  constraint mistry_records_record_id_len  check (char_length(record_id) between 1 and 200)
);

comment on table public.mistry_records is
  'Cloud copy of Mistry app records. One JSONB document per (owner, table, record). RLS: owner only.';

-- Pull = "rows of mine changed on the server since my last pull".
create index if not exists mistry_records_pull_idx
  on public.mistry_records (owner_id, server_updated_at);

-- ------------------------------------------------------------------------------
-- Newest copy wins; the server stamps its own time for pull cursors.
-- ------------------------------------------------------------------------------
create or replace function public.mistry_records_keep_newest()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- The owner of a row never changes.
    new.owner_id := old.owner_id;
    if new.client_updated_at < old.client_updated_at then
      return old;  -- an older copy never overwrites a newer one
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

drop trigger if exists mistry_records_keep_newest on public.mistry_records;
create trigger mistry_records_keep_newest
  before insert or update on public.mistry_records
  for each row execute function public.mistry_records_keep_newest();

-- ------------------------------------------------------------------------------
-- Row Level Security: a user sees and changes only their own rows.
-- There is deliberately no DELETE policy: records are marked deleted, not removed,
-- so a deletion also reaches the user's other devices. Deleting the auth user
-- removes all of their rows (ON DELETE CASCADE).
-- ------------------------------------------------------------------------------
alter table public.mistry_records enable row level security;

drop policy if exists "mistry_records owner can read"   on public.mistry_records;
drop policy if exists "mistry_records owner can insert" on public.mistry_records;
drop policy if exists "mistry_records owner can update" on public.mistry_records;

create policy "mistry_records owner can read"
  on public.mistry_records for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "mistry_records owner can insert"
  on public.mistry_records for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "mistry_records owner can update"
  on public.mistry_records for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- The anonymous (signed-out) role gets nothing.
revoke all on public.mistry_records from anon;
grant select, insert, update on public.mistry_records to authenticated;
