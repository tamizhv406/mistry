import { isSupabaseConfigured, supabase } from './supabase';

/**
 * Request email-based password recovery.
 *
 * Password recovery must use Supabase Auth. There is no client-side password reset fallback.
 */
export async function requestEmailPasswordReset(
  email: string
): Promise<{ success: boolean; message: string; usedSupabase?: boolean; error?: string }> {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
      error: 'Invalid email format.',
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      error: 'Secure password recovery is unavailable until Supabase Auth is configured.',
      message: 'Secure password recovery is unavailable.',
    };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) return { success: false, message: 'Could not send the password reset link.', error: error.message };
  return {
    success: true,
    usedSupabase: true,
    message: 'If an account exists for this email address, a password reset link has been sent. Check your inbox and spam folder.',
  };
}
