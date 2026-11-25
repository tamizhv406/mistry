import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare const process: any;

// Supabase URL and public (anon / publishable) key come only from the environment
// (.env locally, project settings on Vercel). Nothing is built in. Never put a
// server-side secret key here: this file runs in the browser.
const supabaseUrl: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  '';

const supabaseAnonKey: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  '';

/**
 * Checks if Supabase client has valid URL and Anon key credentials
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 10
  );
};

/**
 * Safe singleton client instance for Supabase Auth and Database operations.
 * Without configuration it points at an unreachable placeholder (no credentials), and every
 * caller checks isSupabaseConfigured() first; the app then runs in local mode.
 */
const configured = isSupabaseConfigured();
export const supabase: SupabaseClient = createClient(
  configured ? supabaseUrl : 'http://supabase-not-configured.invalid',
  configured ? supabaseAnonKey : 'not-configured',
  {
    auth: {
      persistSession: configured,
      autoRefreshToken: configured,
      detectSessionInUrl: configured,
    },
  },
);

export default supabase;
