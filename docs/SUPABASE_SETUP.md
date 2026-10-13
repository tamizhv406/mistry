# Cloud backup with Supabase

Status: **the repository's prior setup notes report that migration 002 was applied and tested, but
this has not been independently re-verified here.** Treat the live database state as unverified.
The app's local database remains the working copy. Migration 003 and the `mistry-admin` Edge
Function are staged in this repository; repository notes say they have not been applied or deployed.
Do not treat administrator scopes or live RLS as verified until they are checked against the project.

## How it works

- The phone's own database (IndexedDB) stays the working copy. Every save goes there first, so the app
  works offline and a failed sync never loses a record.
- Supabase Auth is the account and password authority. Users sign in with the email and password
  registered for their Supabase account.
- Sync runs on start, when the connection returns, every 5 minutes while the app is open, and on
  "Sync now". It pulls records changed on the server, then pushes records changed on the phone.
- Storage is one table, `public.mistry_records`: one JSONB document per record, keyed by
  (owner, table, record id). Floor plans are stored whole, with all floors.
- **Row Level Security**: each row has `owner_id = auth.uid()`. Migration 002 permits users to access
  their own records. Migration 003 replaces those policies with owner access plus configured,
  server-checked administrative scopes. There is no delete policy; deletes are marks, so they reach
  other devices.
- **Conflicts**: per record, the copy with the later change time wins. A database trigger refuses to let
  an older copy overwrite a newer one, so an out-of-date phone can not undo newer work.
  (Change times come from device clocks. If a phone's clock is set back, the app sends everything again
  and the server still keeps the newer copies.)
- **Never uploaded**: local accounts and password hashes, OTP sessions, audit and activity logs.

Code: `src/services/cloudSync.ts`, `src/components/mobile/AccountPanel.tsx`.
Tests: `tests/test_cloud_sync.ts` (28 checks: upload, restore on a new device, newer-wins both ways,
deletes, failed sync, clock set back, and owner-preserving scoped administrative sync).

## Turn it on

1. **Check the project.** In the Supabase dashboard, make sure project `zygfmxayyfzbkzctuewf` is
   active. Do not create duplicate projects or tables.
2. **Verify the CLI link** from the repository root with `npx supabase status`. Check that its
   `linked_project.project_ref` is `zygfmxayyfzbkzctuewf`. If it is not linked, run
   `npx supabase login` (which opens an
   interactive prompt for your Supabase access token), then link with the command below (which asks
   for the database password). Enter both only in the CLI prompt, not in source files or chat:
   ```
   npx supabase link --project-ref zygfmxayyfzbkzctuewf
   ```
3. **Check for an existing table** in the SQL Editor before applying anything:
   ```
   select to_regclass('public.mistry_records') as existing_table;
   ```
   If it returns a table name, inspect that table's columns and policies before proceeding. If it
   returns `NULL`, open `supabase/migrations/002_mistry_records_sync.sql`, review and run that file's
   contents in the SQL Editor. This migration creates the table, index and trigger function; enables
   RLS; grants authenticated users select/insert/update; and drops/recreates only its specifically
   named trigger and policies on `mistry_records`. It does not touch `001_rls_policies.sql` or other
   application tables. It is rerunnable when `mistry_records` has the expected schema.
4. **Auth settings**: Authentication → Providers → Email enabled. Decide whether "Confirm email" is on
   (the app tells the user to check their inbox when it is). Add your site URL and
   `https://localhost` (the Android app's origin) to the allowed redirect URLs.
5. **Configure the app's public keys**: `.env.local` is already set for development. For release
   builds, set the same values in `.env.production.local`:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
   ```
   For the website on Vercel, set the same two names under Project → Settings → Environment Variables
   and redeploy. The GitHub Pages copy is built on this computer by `npm run deploy`, so it reads
   `.env.production.local`. Never use the service-role key in the app.
6. **Verify with two devices or browsers**: sign in on both, add a worker on one, sync, see it on the
   other; edit on both and confirm the later edit wins; delete on one and confirm it disappears on the
   other; check in the dashboard that a second account can not see the first account's rows.
7. Run the Supabase **security advisor** after the migration and resolve anything it reports.

## Secure admin rollout (migration 003)

Do not run `supabase db push`, migration 001, or any unreviewed SQL as part of this rollout.
Migration 003 is additive: it preserves `mistry_records`, creates membership and admin-audit tables,
backfills existing Auth users as regular users, and replaces only the three named `mistry_records`
owner policies. Review `supabase/migrations/003_admin_auth_permissions.sql` and confirm migration
002 created the expected table before applying migration 003 manually in the SQL Editor.

1. Do not apply migration 003 as part of this code change. Apply it only after the owner explicitly
   approves the database change, confirms the project ref, checks the current schema/policies, and
   reviews the statements. Do not promote an account based only on a browser-side email or local role.
2. Register the intended Super Admin through the app using its real email, then confirm the email
   and sign in. In the SQL Editor, identify the exact Auth user UUID before promotion:
   ```sql
   select user_id, email
   from public.mistry_members
   where lower(email) = lower('<intended-super-admin-email>');
   ```
   Verify that this returns exactly one expected account. Promote only that UUID using the privileged
   SQL Editor:
   ```sql
   do $$
   declare
     target_id uuid := '<verified-auth-user-uuid>'::uuid;
     changed_rows integer;
   begin
     update public.mistry_members
     set role = 'SUPER_ADMIN', is_active = true, permissions = '{}'::jsonb, updated_at = now()
     where user_id = target_id
       and lower(email) = lower('<intended-super-admin-email>')
       and role = 'USER';
     get diagnostics changed_rows = row_count;
     if changed_rows <> 1 then
       raise exception 'Expected exactly one regular account to be promoted; updated % rows', changed_rows;
     end if;
     insert into public.mistry_admin_audit (actor_id, target_user_id, action, details)
     values (null, target_id, 'INITIAL_SUPER_ADMIN_PROVISIONED',
             jsonb_build_object('source', 'approved_sql_editor_provisioning'));
   end $$;
   ```
   The block raises and rolls back unless exactly one regular account is promoted, and records the
   initial grant in the audit table. Verify the target role and audit row afterward.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only in the server-side `mistry-admin` Edge Function environment;
   the function also needs Supabase's server-provided `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Deploy it
   from the repository root with `npx supabase functions deploy mistry-admin`. Never add the
   service-role key to `.env.local`, a `VITE_*` variable, client code, or chat.
4. Create a Sub-admin invitation from the Super Admin account and assign only the scopes required.
   Test with separate Supabase accounts: the Super Admin, a Sub-admin with a limited scope, and a
   regular user. Verify owner reads/writes, permitted cross-owner reads, denied out-of-scope reads
   and writes, disabled-account denial, and audit entries. Do not treat the local-only test suite as
   proof of deployed Supabase RLS behavior.
5. Run Supabase's security advisor and inspect the deployed policies, functions, and Edge Function
   secrets. Test owner reads/writes, allowed and denied Sub-admin scopes, inactive account denial,
   and audit records using separate authenticated accounts. Do not report admin rollout complete
   until these checks pass.

## About `001_rls_policies.sql`

That older file enables RLS on legacy tables named `sites`, `materials`, `workers` and so on. The app
uses `mistry_records` for cloud sync, so this migration is not part of the supported rollout. Its
legacy Super Admin helper now fails closed; migration 003 is the role-aware policy path for
`mistry_records`.

## Existing local account data

Supabase sign-in does not automatically attach a new Auth UUID to a legacy IndexedDB account based
on email. Existing local users and records are left untouched. Before moving a legacy account,
export a local backup and verify the account owner and record counts. Any future linking procedure
must be an explicit, reviewed migration with a dry run and checks for duplicate IDs, site ownership,
and foreign-key references; do not manually edit browser storage or infer identity from an email
match alone.

## Rollback

- For an application-only issue, pause cloud sync and redeploy the previously verified Vercel
  deployment from the Vercel dashboard. Do not promote an unverified build as a rollback target.
- Migration 003 preserves record rows but replaces the named `mistry_records` policies and creates
  member/audit structures and an Auth trigger. There is no automatic down migration. Before applying,
  save the current table definitions and policy/function SQL from the Supabase dashboard. If rollback
  is required, stop sync, restore the reviewed owner-only policies from migration 002, and retain the
  membership/audit tables and their data until a separate reviewed data-retention decision is made.
- Never use `supabase db reset`, delete records, or drop the membership/audit tables as a rollback.

## Limits to know

- Deleting a Supabase login (the auth user) can not be done from the app: it needs the dashboard or a
  server function with the service-role key. The app's "Delete my account" erases the records and signs out.
- Regular accounts are limited to their own data. Cross-owner administrative access is available only
  for permissions granted in the server-side membership table after migration 003 is approved,
  applied, and tested.
- Very large photo attachments are not synced as files; tool photos added by the user are small
  (about 40 KB) and travel inside the record.
