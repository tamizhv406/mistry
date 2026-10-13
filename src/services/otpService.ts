/**
 * Validates Indian mobile numbers.
 * Accepts 10 digits starting with 6, 7, 8, or 9, with optional +91 or 0 prefix.
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  return /^(?:(?:\+|0{0,2})91)?[0]?[6789]\d{9}$/.test(cleaned);
}

/** Normalizes an Indian phone number to its canonical 10 digits. */
export function normalizeIndianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  if (cleaned.length === 10) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.slice(1);
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2);
  return cleaned.slice(-10);
}

/** Validates password strength before passing the password to Supabase Auth. */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  if (!hasLetters || !hasNumbers) {
    return { valid: false, error: 'Password must contain both letters and numbers.' };
  }

  const weakPasswords = ['password', 'password123', '12345678', '123456789', 'admin123', 'mistry123', 'buildingmistry'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'This password is too common. Please choose a stronger password.' };
  }

  return { valid: true };
}
