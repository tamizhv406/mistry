# Cloud backup with Supabase

Status: **written and tested against an in-memory stand-in; not yet run against a real Supabase project.**
The only Supabase project on the connected account is paused, so its tables and policies could not be
inspected and nothing was changed there. Until the steps below are done, the app stores everything on
the device only (which is fully supported).

## How it works

- The phone's own database (IndexedDB) stays the working copy. Every save goes there first, so the app
  works offline and a failed sync never loses a record.
- Cloud backup is opt-in: More → Backup & Data → Cloud backup → sign in with an email and password
  (Supabase Auth). This login is separate from the app's local username.
- Sync runs on start, when the connection returns, every 5 minutes while the app is open, and on
  "Sync now". It pulls records changed on the server, then pushes records changed on the phone.
- Storage is one table, `public.mistry_records`: one JSONB document per record, keyed by
  (owner, table, record id). Floor plans are stored whole, with all floors.
- **Row Level Security**: each row has `owner_id = auth.uid()`. Policies allow select, insert and update
  of your own rows only. There is no delete policy; deletes are marks, so they reach other devices.
- **Conflicts**: per record, the copy with the later change time wins. A database trigger refuses to let
  an older copy overwrite a newer one, so an out-of-date phone can not undo newer work.
  (Change times come from device clocks. If a phone's clock is set back, the app sends everything again
  and the server still keeps the newer copies.)
- **Never uploaded**: local accounts and password hashes, OTP sessions, audit and activity logs.

Code: `src/services/cloudSync.ts`, `src/components/mobile/AccountPanel.tsx`.
Tests: `tests/test_cloud_sync.ts` (25 checks: upload, restore on a new phone, newer-wins both ways,
deletes, failed sync, clock set back).

## Turn it on

1. **Choose the project.** In the Supabase dashboard, restore the paused project (or pick another one
   you already have). Do not create duplicates of tables you already use.
2. **Run the migration** `supabase/migrations/002_mistry_records_sync.sql` once, in the SQL editor.
   It only adds `mistry_records`, its index, trigger and policies. It alters and drops nothing, and is
   safe to run again.
3. **Auth settings**: Authentication → Providers → Email enabled. Decide whether "Confirm email" is on
   (the app tells the user to check their inbox when it is). Add your site URL and
   `https://localhost` (the Android app's origin) to the allowed redirect URLs.
4. **Give the app the public keys**: in `.env.local` for development and `.env.production.local` for
   release builds:
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
   ```
   For the website on Vercel, set the same two names under Project → Settings → Environment Variables
   and redeploy. The GitHub Pages copy is built on this computer by `npm run deploy`, so it reads
   `.env.production.local`. Never use the service-role key in the app.
5. **Verify with two devices or browsers**: sign in on both, add a worker on one, sync, see it on the
   other; edit on both and confirm the later edit wins; delete on one and confirm it disappears on the
   other; check in the dashboard that a second account can not see the first account's rows.
6. Run the Supabase **security advisor** after the migration and resolve anything it reports.

## About `001_rls_policies.sql`

That older file enables RLS on tables named `sites`, `materials`, `workers` and so on. The app has never
created or written those tables; it is not used by cloud backup and does not need to be run. It is kept
because an existing test checks for it.

## Limits to know

- Deleting a Supabase login (the auth user) can not be done from the app: it needs the dashboard or a
  server function with the service-role key. The app's "Delete my account" erases the records and signs out.
- One cloud account maps to one person's data. Sharing a project between several logins is not built.
- Very large photo attachments are not synced as files; tool photos added by the user are small
  (about 40 KB) and travel inside the record.
