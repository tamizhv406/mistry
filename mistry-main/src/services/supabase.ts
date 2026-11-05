import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read public client environment variables (Vite-prefixed)
const supabaseUrl = (
  typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL
)?.trim() || '';

const supabaseAnonKey = (
  typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
)?.trim() || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 10
  );
};

// Safe singleton client instance
let supabaseInstance: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[Supabase] Initialization failed, continuing in offline Dexie mode:', err);
    supabaseInstance = null;
  }
}

export const supabase = supabaseInstance;

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
