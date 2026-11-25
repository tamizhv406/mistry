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
import { AUTH_DICTIONARY } from './authText';

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
  // Building Calculator: quick estimate
  'calc_title': { en: 'Building Calculator', ta: 'கட்டிட கணக்கீடு' },
  'calc_subtitle': { en: 'Quick cost estimate', ta: 'விரைவு செலவு மதிப்பீடு' },
  'calc_step': { en: 'Step', ta: 'படி' },
  'calc_q_size': { en: 'How big is one floor?', ta: 'ஒரு தளத்தின் அளவு என்ன?' },
  'calc_q_size_help': { en: 'Size of one floor. You choose floors next.', ta: 'ஒரு தளத்தின் அளவு. அடுத்து தளங்கள் தேர்வு செய்யலாம்.' },
  'calc_q_floors': { en: 'How many floors?', ta: 'எத்தனை தளங்கள்?' },
  'calc_q_type': { en: 'What kind of building?', ta: 'என்ன வகை கட்டிடம்?' },
  'calc_q_quality': { en: 'Construction quality?', ta: 'கட்டுமான தரம்?' },
  'calc_back': { en: 'Back', ta: 'பின்' },
  'calc_next': { en: 'Next', ta: 'அடுத்து' },
  'calc_calculate': { en: 'Calculate', ta: 'கணக்கிடு' },
  'calc_total': { en: 'Approximate total cost', ta: 'தோராயமான மொத்த செலவு' },
  'calc_breakdown': { en: 'Breakdown', ta: 'விவரம்' },
  'calc_labour': { en: 'Labour', ta: 'கூலி' },
  'calc_materials': { en: 'Materials', ta: 'பொருட்கள்' },
  'calc_approx_note': { en: 'This is an approximate estimate only. Actual cost may vary.', ta: 'இது தோராயமான மதிப்பீடு மட்டுமே. உண்மையான செலவு மாறலாம்.' },
  'calc_excluded_title': { en: 'Not included', ta: 'இதில் சேர்க்கப்படவில்லை' },
  'calc_excluded_list': { en: 'Painting, interior furniture, compound wall, borewell, government approvals', ta: 'பெயிண்டிங், உள் ஃபர்னிச்சர், சுற்றுச்சுவர், போர்வெல், அரசு அனுமதிகள்' },
  'calc_excluded_list_finish': { en: 'Interior furniture, compound wall, borewell, government approvals', ta: 'உள் ஃபர்னிச்சர், சுற்றுச்சுவர், போர்வெல், அரசு அனுமதிகள்' },
  'calc_edit_rates': { en: 'Edit rates', ta: 'ரேட் மாற்று' },
  'calc_view_details': { en: 'Detail estimate', ta: 'விவரம் பார்' },
  'calc_quick_estimate': { en: 'Quick estimate', ta: 'விரைவு மதிப்பீடு' },
  'calc_start_again': { en: 'Start again', ta: 'மீண்டும் தொடங்கு' },
  'calc_saved': { en: 'Saved estimates', ta: 'சேமித்த மதிப்பீடுகள்' },
  // Materials / stock (phone)
  'stk_search': { en: 'Search materials', ta: 'பொருள் தேடு' },
  'stk_chip_all': { en: 'All', ta: 'எல்லாம்' },
  'stk_chip_cement': { en: 'Cement', ta: 'சிமெண்ட்' },
  'stk_chip_sand': { en: 'Sand', ta: 'மணல்' },
  'stk_chip_steel': { en: 'Steel', ta: 'கம்பி' },
  'stk_chip_bricks': { en: 'Bricks', ta: 'செங்கல்' },
  'stk_chip_other': { en: 'Other', ta: 'மற்றவை' },
  'stk_in': { en: 'Arrived', ta: 'வந்துச்சு' },
  'stk_out': { en: 'Used', ta: 'யூஸ் பண்ணோம்' },
  'stk_low': { en: 'Low', ta: 'கம்மி' },
  'stk_low_level': { en: 'Low-stock level', ta: 'கம்மி அளவு' },
  'stk_more': { en: 'More details', ta: 'மேலும்' },
  'stk_value': { en: 'Stock value', ta: 'இருப்பு மதிப்பு' },
  'stk_bought': { en: 'Bought', ta: 'வாங்கியது' },
  'stk_to_pay': { en: 'To pay', ta: 'கொடுக்க வேண்டியது' },
  'stk_new_material': { en: 'New material', ta: 'புது பொருள்' },
  'stk_other_entries': { en: 'Other entries', ta: 'மற்ற பதிவுகள்' },
  'stk_no_match': { en: 'No material matches.', ta: 'பொருத்தமான பொருள் இல்லை.' },
  // Tools (phone)
  'tl_search': { en: 'Search tools', ta: 'கருவி தேடு' },
  'tl_chip_all': { en: 'All', ta: 'எல்லாம்' },
  'tl_chip_out': { en: 'Issued', ta: 'வெளிய' },
  'tl_chip_available': { en: 'Available', ta: 'இங்க' },
  'tl_chip_damaged': { en: 'Damaged', ta: 'கெடு' },
  'tl_here': { en: 'Available', ta: 'இங்க இருக்கு' },
  'tl_with': { en: 'With {name}', ta: '{name} கிட்ட' },
  'tl_damaged': { en: 'Damaged', ta: 'கெடு' },
  'tl_late': { en: 'Late', ta: 'லேட்' },
  'tl_issue': { en: 'Issue', ta: 'குடு' },
  'tl_return': { en: 'Return', ta: 'திரும்பி வந்துச்சு' },
  'tl_out_now': { en: 'Out now', ta: 'வெளிய' },
  'tl_tools': { en: 'Tools', ta: 'கருவிகள்' },
  'tl_add_tool': { en: 'Add tool', ta: 'கருவி சேர்' },
  'tl_who': { en: 'Who is taking it? Tap the name.', ta: 'யாருக்கு? பெயரை தொடவும்.' },
  'tl_date': { en: 'Date', ta: 'தேதி' },
  'tl_condition': { en: 'Condition', ta: 'நிலைமை' },
  'tl_no_match': { en: 'No tool matches.', ta: 'பொருத்தமான கருவி இல்லை.' },
  // Home / dashboard (Task 5)
  'hm_present': { en: 'Present today', ta: 'இன்னைக்கு வந்தவங்க' },
  'hm_of_workers': { en: 'of {n} workers', ta: '{n} பேருல' },
  'hm_expenses': { en: "Today's expenses", ta: 'இன்னைக்கு செலவு' },
  'hm_entries': { en: '{n} entries', ta: '{n} பதிவு' },
  'hm_attendance': { en: 'Attendance', ta: 'வருகை' },
  'hm_material_in': { en: 'Material arrived', ta: 'மெட்டீரியல் வந்துச்சு' },
  'hm_add_expense': { en: 'Add expense', ta: 'செலவு சேர்' },
  'hm_give_tool': { en: 'Give tool', ta: 'கருவி குடு' },
  'hm_low_stock': { en: 'Low stock', ta: 'கம்மி ஸ்டாக்' },
  'hm_tools_out': { en: 'Tools out', ta: 'வெளிய கருவி' },
  'hm_all_ok': { en: 'All stock OK', ta: 'ஸ்டாக் எல்லாம் சரி' },
  'hm_view_all': { en: 'View all', ta: 'எல்லாம் பாரு' },
  'hm_pending_salary': { en: 'Salary pending', ta: 'சம்பளம் பாக்கி' },
  'hm_recent': { en: 'Recent activity', ta: 'சமீபத்திய பதிவுகள்' },
  'hm_no_activity': { en: 'Activity will appear here as you record work.', ta: 'பதிவு செய்யும்போது இங்கே தெரியும்.' },
  'hm_not_marked': { en: '{n} not marked yet', ta: '{n} பேர் இன்னும் குறிக்கல' },
  'hm_late': { en: '{n} late', ta: '{n} லேட்' },
  // Attendance (Task 6)
  'at_title': { en: 'Attendance', ta: 'வருகை' },
  'at_today': { en: 'Today', ta: 'இன்னைக்கு' },
  'at_yesterday': { en: 'Yesterday', ta: 'நேத்து' },
  'at_pick_date': { en: 'Pick date', ta: 'தேதி' },
  'at_mark_all': { en: 'Mark all present', ta: 'எல்லாரும் Present' },
  'at_not_marked': { en: 'Not marked', ta: 'குறிக்கல' },
  'at_search': { en: 'Search worker', ta: 'ஆள் தேடு' },
  'at_hint': { en: 'Tap a status to change it. Hold it (or tap ⋯) for Overtime and Leave.', ta: 'மாற்ற தொடவும். Overtime / Leave-க்கு அழுத்தி பிடிக்கவும் (அல்லது ⋯).' },
  'at_past': { en: 'Past date: every change is kept in the correction log.', ta: 'பழைய தேதி: ஒவ்வொரு மாற்றமும் பதிவாகும்.' },
  'at_corrections': { en: 'Correction log', ta: 'திருத்த பதிவு' },
  'at_all_marked': { en: 'Everyone is marked', ta: 'எல்லாரும் குறிச்சாச்சு' },
  'at_salary': { en: 'Salary & leave rule', ta: 'சம்பளம் & லீவு விதி' },
  'nav_home': { en: 'Home', ta: 'முகப்பு' },
  'nav_labour': { en: 'Labour', ta: 'ஆட்கள்' },
  'nav_stock': { en: 'Stock', ta: 'ஸ்டாக்' },
  'nav_tools': { en: 'Tools', ta: 'கருவி' },
  'nav_more': { en: 'More', ta: 'மேலும்' },
  'nav_project': { en: 'Project', ta: 'திட்டம்' },
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
  // Splash, Welcome, Create Account and Log In (src/services/authText.ts)
  ...AUTH_DICTIONARY,
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
    setLanguage(newLang);
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
