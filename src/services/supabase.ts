import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export { supabase, isSupabaseConfigured };

/**
 * Checks if the current URL contains a Supabase password recovery token or hash
 */
export function checkPasswordRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    (hash.includes('access_token=') && hash.includes('type=recovery'))
  );
}

/**
 * Updates password for the currently authenticated Supabase user (e.g. during recovery)
 */
export async function updateSupabasePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase is not configured or in offline mode.' };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update Supabase password.' };
  }
}
