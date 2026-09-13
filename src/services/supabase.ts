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
 * Super Admin password reset helper via Supabase Edge Function or secure API
 * Client NEVER uses service_role key directly in frontend code.
 */
export async function remoteAdminResetPassword(
  targetEmail: string,
  newTemporaryPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'Supabase is not configured or in offline mode. Local password reset applied.',
    };
  }

  try {
    // Invoke secure Edge function 'admin-reset-password' if deployed
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: {
        email: targetEmail,
        newTemporaryPassword,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, ...data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to call remote reset function.',
    };
  }
}
