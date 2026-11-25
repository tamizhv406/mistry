-- ==============================================================================
-- MISTRY — PRIVATE STORAGE BUCKET FOR PURCHASE BILL PHOTOS (Task 5)
--
-- Apply this migration in the Supabase SQL Editor after reviewing it.
-- What it does:
--   1. Creates a strictly PRIVATE bucket `purchase-bills` (never public URLs).
--      Compressed JPG/PNG/WebP photos are capped at 5 MB per object.
--   2. Adds Row Level Security policies on storage.objects so authenticated
--      users can only upload, view (signed URL), update, and delete bills stored
--      under their own auth.uid() folder (`${auth.uid()}/${projectId}/${purchaseId}.jpg`).
--   3. Adds optional bill photo columns to public.materials if that table exists.
-- ==============================================================================

-- 1. Create / enforce private purchase-bills bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'purchase-bills',
  'purchase-bills',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage RLS policies scoped by authenticated user's top-level folder
drop policy if exists "purchase_bills_select_own" on storage.objects;
create policy "purchase_bills_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'purchase-bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "purchase_bills_insert_own" on storage.objects;
create policy "purchase_bills_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'purchase-bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "purchase_bills_update_own" on storage.objects;
create policy "purchase_bills_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'purchase-bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'purchase-bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "purchase_bills_delete_own" on storage.objects;
create policy "purchase_bills_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'purchase-bills'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- 3. Additive optional columns on public.materials (if normalized table exists)
do $$
begin
  if to_regclass('public.materials') is not null then
    alter table public.materials add column if not exists bill_photo_path text;
    alter table public.materials add column if not exists bill_photo_name text;
  end if;
end $$;
