import { db } from './db';

/**
 * Older versions saved sign-in passwords on the device in plain text (users.passwordHash, and a
 * `password` field on some records). Sign-in now goes through Supabase only, so those values are
 * never read; this blanks them on every saved user record. Nothing else changes: the profile,
 * its role and all site data stay as they are, and no record is deleted.
 *
 * Runs at start-up. It is safe to run again (records already blank are skipped), and a flag in
 * localStorage skips the scan once it has completed on this device.
 */
export const LEGACY_PASSWORD_CLEANUP_FLAG = 'app_legacy_passwords_cleared_v1';

type StoredUser = { passwordHash?: unknown; password?: unknown };

function hasStoredPassword(u: StoredUser): boolean {
  return (typeof u.passwordHash === 'string' && u.passwordHash !== '')
    || ('password' in u && u.password !== '' && u.password !== undefined && u.password !== null);
}

/** Returns how many user records were cleaned. */
export async function clearLegacyLocalPasswords(database = db, storage: Pick<Storage, 'getItem' | 'setItem'> | null =
  typeof localStorage === 'undefined' ? null : localStorage): Promise<number> {
  try {
    if (storage?.getItem(LEGACY_PASSWORD_CLEANUP_FLAG) === 'done') return 0;
  } catch { /* storage blocked: just run the scan */ }

  const cleaned = await database.users
    .filter(u => hasStoredPassword(u as StoredUser))
    .modify((u: StoredUser) => {
      u.passwordHash = '';
      if ('password' in u) u.password = '';
    });

  try {
    storage?.setItem(LEGACY_PASSWORD_CLEANUP_FLAG, 'done');
  } catch { /* storage blocked: the scan runs again next time, which is harmless */ }
  return cleaned;
}
