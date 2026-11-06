/**
 * Building Mistry — Bilingual Regional Language Localization (English / Tamil)
 * 
 * Maps authentic Tamil Nadu site terminology:
 * - Mason -> பெரியாள் / கொத்தனார்
 * - Helper -> சித்தாள் / கலவை ஆள்
 * - Bar Bender -> கம்பி கட்டுபவர்
 * - Carpenter -> தச்சர் / மர வேலை
 * - Painter -> பெயிண்டர் / வர்ணம் பூசுபவர்
 * - Plumber -> பிளம்பர் / குழாய் வேலை
 * - Electrician -> எலக்ட்ரீஷியன் / மின் வேலை
 * - Attendance -> வருகைப்பதிவு
 * - Present / Half-day / Absent -> முழு நாள் / அரை நாள் / விடுப்பு
 * - Advance Paid -> அட்வான்ஸ் / முன்பணம்
 * - Total Wages -> மொத்த கூலி
 */

import { useState, useEffect } from 'react';

export type Language = 'en' | 'ta';

const LANG_STORAGE_KEY = 'mistry_language';
const LANG_CHANGE_EVENT = 'mistry_lang_changed';

export const ROLE_TRANSLATIONS: Record<string, { en: string; ta: string }> = {
  'Mason': { en: 'Mason', ta: 'பெரியாள் / கொத்தனார்' },
  'Helper': { en: 'Helper', ta: 'சித்தாள் / கலவை ஆள்' },
  'Bar Bender': { en: 'Bar Bender', ta: 'கம்பி கட்டுபவர்' },
  'Carpenter': { en: 'Carpenter', ta: 'தச்சர் / மர வேலை' },
  'Painter': { en: 'Painter', ta: 'பெயிண்டர் / வர்ணம் பூசுபவர்' },
  'Plumber': { en: 'Plumber', ta: 'பிளம்பர் / குழாய் வேலை' },
  'Electrician': { en: 'Electrician', ta: 'எலக்ட்ரீஷியன் / மின் வேலை' },
  'Tile Layer': { en: 'Tile Layer', ta: 'டைல்ஸ் மேஸ்திரி' },
  'Centering Worker': { en: 'Centering Worker', ta: 'சென்டரிங் ஆள்' },
  'Contractor': { en: 'Contractor', ta: 'மேஸ்திரி / ஒப்பந்ததாரர்' },
};

export const STATUS_TRANSLATIONS: Record<string, { en: string; ta: string; code: string }> = {
  'present': { en: 'Present', ta: 'முழு நாள்', code: 'P' },
  'half_day': { en: 'Half-day', ta: 'அரை நாள்', code: 'H' },
  'absent': { en: 'Absent', ta: 'விடுப்பு', code: 'A' },
  'overtime': { en: 'Overtime', ta: 'கூடுதல் நேரம்', code: 'OT' },
  'leave': { en: 'Leave', ta: 'அனுமதி விடுப்பு', code: 'L' },
};

export const DICTIONARY: Record<string, { en: string; ta: string }> = {
  // Navigation & Headers
  'attendance_salary': { en: 'Attendance & Salary Management', ta: 'வருகைப்பதிவு & கூலிப்பட்டியல் மேலாண்மை' },
  'attendance_matrix': { en: 'Mobile Attendance Matrix', ta: 'தள வருகைப்பதிவு மேட்ரிக்ஸ்' },
  'roster': { en: 'Worker Roster', ta: 'பணியாளர்கள் பட்டியல்' },
  'wage_ledger': { en: 'Wage Ledger', ta: 'கூலி கணக்கு ஏடு' },
  'advances': { en: 'Advances Paid', ta: 'அட்வான்ஸ் / முன்பணம்' },
  'advance_paid': { en: 'Advance Paid', ta: 'அட்வான்ஸ் / முன்பணம்' },
  
  // Matrix Actions & Quick Controls
  'mark_all_present': { en: 'Mark All Present Today', ta: 'அனைவருக்கும் முழு நாள் போடு' },
  'copy_yesterday': { en: 'Copy Yesterday Attendance', ta: 'நேற்றைய வருகையை நகலெடு' },
  'today': { en: 'Today', ta: 'இன்று' },
  'prev_week': { en: 'Prev Week', ta: 'முந்தைய வாரம்' },
  'next_week': { en: 'Next Week', ta: 'அடுத்த வாரம்' },
  'select_site': { en: 'Select Project Site', ta: 'கட்டுமான தளத்தை தேர்வுசெய்' },
  'search_worker': { en: 'Search worker name, role, phone...', ta: 'பணியாளர் பெயர், வேலை, எண் தேடு...' },
  'add_worker': { en: 'Add Worker', ta: 'புதிய பணியாளர் சேர்' },
  
  // Table Columns
  'worker_details': { en: 'Worker Details & Wage', ta: 'பணியாளர் & தினக்கூலி' },
  'role': { en: 'Trade / Role', ta: 'தொழில் / பதவி' },
  'daily_wage': { en: 'Daily Wage', ta: 'தினக்கூலி' },
  'total_days': { en: 'Days (P/H/A/OT)', ta: 'நாட்கள் (மு/அ/வி/கூ)' },
  'gross_wage': { en: 'Gross Wage', ta: 'மொத்த கூலி' },
  'total_wages': { en: 'Total Wages', ta: 'மொத்த கூலி' },
  'advance_deduction': { en: 'Advance Taken', ta: 'முன்பணம் கழிவு' },
  'net_payout': { en: 'Net Payable', ta: 'வழங்க வேண்டிய தொகை' },
  'action': { en: 'Action', ta: 'செயல்' },

  // Statuses
  'present': { en: 'Present (1.0)', ta: 'முழு நாள் (1.0)' },
  'half_day': { en: 'Half-day (0.5)', ta: 'அரை நாள் (0.5)' },
  'absent': { en: 'Absent (0.0)', ta: 'விடுப்பு (0.0)' },
  'overtime': { en: 'Overtime (OT)', ta: 'கூடுதல் நேரம் (OT)' },
  'hours': { en: 'hours', ta: 'மணி' },

  // Payslip
  'generate_payslip': { en: 'Generate Payslip', ta: 'சம்பள ரசீது உருவாக்கு' },
  'worker_payslip': { en: 'Worker Wage Slip', ta: 'பணியாளர் சம்பள ரசீது' },
  'site_name': { en: 'Site / Project', ta: 'கட்டுமான தளம்' },
  'date_range': { en: 'Settlement Period', ta: 'கூலி காலம்' },
  'present_days': { en: 'Full Days Worked', ta: 'முழு வேலை நாட்கள்' },
  'half_days': { en: 'Half Days Worked', ta: 'அரை நாட்கள்' },
  'ot_hours': { en: 'Overtime Hours', ta: 'கூடுதல் வேலை நேரம்' },
  'ot_rate': { en: 'OT Hourly Rate', ta: 'மணிநேர கூடுதல் கூலி' },
  'total_earned': { en: 'Total Gross Wages', ta: 'மொத்த சம்பாதித்த கூலி' },
  'advances_recovered': { en: 'Advance Recovered', ta: 'கழிக்கப்பட்ட முன்பணம்' },
  'cash_in_hand': { en: 'Net Cash in Hand', ta: 'கையில் கொடுக்கும் நிகர கூலி' },
  'print_pdf': { en: 'Print Payslip (PDF)', ta: 'ரசீது அச்சிடு (PDF)' },
  'send_whatsapp': { en: 'Send Slip via WhatsApp', ta: 'வாட்ஸ்அப்பில் அனுப்பு' },
  'signature': { en: 'Worker Signature / Thumb Impression', ta: 'பணியாளர் கையெழுத்து / பெருவிரல் ரேகை' },
  'authorized_by': { en: 'Authorized Contractor / Supervisor', ta: 'ஒப்பந்ததாரர் / மேற்பார்வையாளர் கையொப்பம்' },

  // Validations & Messages
  'phone_invalid': { en: 'Enter a valid 10-digit Indian phone number', ta: 'சரியான 10 இலக்க இந்திய அலைபேசி எண்ணை உள்ளிடவும்' },
  'wage_invalid': { en: 'Daily wage cannot be negative', ta: 'தினக்கூலி எதிர்மறையாக (Negative) இருக்கக்கூடாது' },
  'marked_success': { en: 'Attendance updated successfully', ta: 'வருகைப்பதிவு வெற்றிகரமாக சேமிக்கப்பட்டது' },
  'copied_yesterday': { en: 'Copied previous day attendance marks', ta: 'நேற்றைய வருகைப்பதிவு நகலெடுக்கப்பட்டது' },
  'all_present_marked': { en: 'All active workers marked Present for today', ta: 'அனைத்து பணியாளர்களுக்கும் இன்று முழு நாள் குறிக்கப்பட்டது' },
};

let memoryLang: Language = 'en';

/**
 * Get current active language ('en' | 'ta')
 */
export function getLanguage(): Language {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'ta' || saved === 'en') return saved;
    }
  } catch {
    // fallback
  }
  return memoryLang;
}

/**
 * Set active language ('en' | 'ta') and broadcast change
 */
export function setLanguage(lang: Language): void {
  memoryLang = lang;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
  } catch {
    // fallback
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: { lang } }));
  }
}

/**
 * React hook to subscribe to language state changes reactively
 */
export function useLanguage(): {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, fallback?: string) => string;
  roleLabel: (role: string) => string;
  statusLabel: (status: string) => string;
} {
  const [lang, setLangState] = useState<Language>(() => getLanguage());

  useEffect(() => {
    const handler = (e: any) => {
      const newLang = e.detail?.lang || getLanguage();
      setLangState(newLang);
    };
    window.addEventListener(LANG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(LANG_CHANGE_EVENT, handler);
  }, []);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    setLangState(newLang);
  };

  const t = (key: string, fallback?: string): string => {
    const item = DICTIONARY[key];
    if (item) return item[lang] || item.en;
    return fallback || key;
  };

  const roleLabel = (role: string): string => {
    return getRoleLabel(role, lang);
  };

  const statusLabel = (status: string): string => {
    return getStatusLabel(status, lang);
  };

  return { lang, setLang: changeLang, t, roleLabel, statusLabel };
}

/**
 * Translate a trade role (e.g. 'Mason' -> 'பெரியாள் / கொத்தனார்')
 */
export function getRoleLabel(role: string, lang: Language = getLanguage()): string {
  if (!role) return '';
  const match = ROLE_TRANSLATIONS[role];
  if (match) return lang === 'ta' ? match.ta : match.en;
  // Case-insensitive lookup
  for (const [key, val] of Object.entries(ROLE_TRANSLATIONS)) {
    if (key.toLowerCase() === role.toLowerCase()) {
      return lang === 'ta' ? val.ta : val.en;
    }
  }
  return role;
}

/**
 * Translate an attendance status (e.g. 'present' -> 'முழு நாள்')
 */
export function getStatusLabel(status: string, lang: Language = getLanguage()): string {
  const s = (status || '').toLowerCase();
  const match = STATUS_TRANSLATIONS[s];
  if (match) return lang === 'ta' ? match.ta : match.en;
  return status;
}

/**
 * Strict 10-digit Indian phone number validator (/^[6-9]\d{9}$/)
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (trimmed.startsWith('-')) return false;
  if (!/^\+?[0-9\s-]+$/.test(trimmed)) return false;
  const clean = trimmed.replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(clean.substring(2));
  }
  return /^[6-9]\d{9}$/.test(clean);
}

/**
 * Clean phone number to 10 digits
 */
export function cleanPhoneNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.substring(2);
  return digits;
}
