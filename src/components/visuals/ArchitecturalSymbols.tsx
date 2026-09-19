import React from 'react';

export interface ArchitecturalSymbolProps {
  itemType: string;
  width: number;     // in px
  height: number;    // in px
  blueprintMode?: boolean;
  color?: string;
  className?: string;
}

/**
 * Standard architectural 2D CAD symbols rendered as crisp, high-precision SVGs
 */
export const ArchitecturalSymbol: React.FC<ArchitecturalSymbolProps> = ({
  itemType,
  width,
  height,
  blueprintMode = false,
  color,
  className = '',
}) => {
  const strokeColor = color || (blueprintMode ? '#93c5fd' : '#334155');
  const fillColor = blueprintMode ? 'rgba(30, 58, 138, 0.25)' : '#f8fafc';
  const detailColor = blueprintMode ? '#60a5fa' : '#64748b';
  const accentColor = blueprintMode ? '#38bdf8' : '#0284c7';

  // Normalize case-insensitive or alias lookup
  const key = itemType.trim();

  switch (key) {
    // ══════════════════════════════════════════════════════
    // 1. FLOOR PLAN ICONS
    // ══════════════════════════════════════════════════════
    case 'Wall':
    case 'Straight Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="5" y="12" width="90" height="16" fill="#475569" stroke={strokeColor} strokeWidth="2" />
          <line x1="15" y1="12" x2="31" y2="28" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="35" y1="12" x2="51" y2="28" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="55" y1="12" x2="71" y2="28" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="75" y1="12" x2="91" y2="28" stroke="#94a3b8" strokeWidth="1.5" />
        </svg>
      );

    case 'Interior Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="5" y="15" width="90" height="10" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <line x1="20" y1="15" x2="30" y2="25" stroke={detailColor} strokeWidth="1" />
          <line x1="45" y1="15" x2="55" y2="25" stroke={detailColor} strokeWidth="1" />
          <line x1="70" y1="15" x2="80" y2="25" stroke={detailColor} strokeWidth="1" />
        </svg>
      );

    case 'Exterior Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="4" y="10" width="92" height="20" fill="#1e293b" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="4" y1="10" x2="96" y2="10" stroke="#f59e0b" strokeWidth="2" />
          <line x1="15" y1="10" x2="35" y2="30" stroke="#64748b" strokeWidth="1.5" />
          <line x1="40" y1="10" x2="60" y2="30" stroke="#64748b" strokeWidth="1.5" />
          <line x1="65" y1="10" x2="85" y2="30" stroke="#64748b" strokeWidth="1.5" />
        </svg>
      );

    case 'Corner Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <path d="M 12 12 L 68 12 L 68 28 L 28 28 L 28 68 L 12 68 Z" fill="#334155" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="12" y1="28" x2="28" y2="12" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="20" y1="40" x2="28" y2="32" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="40" y1="20" x2="48" y2="12" stroke="#94a3b8" strokeWidth="1.5" />
        </svg>
      );

    case 'Room':
      return (
        <svg width={width} height={height} viewBox="0 0 90 70" className={className}>
          <rect x="8" y="8" width="74" height="54" rx="3" fill="rgba(251,191,36,0.15)" stroke={strokeColor} strokeWidth="2" strokeDasharray="4 2" />
          <text x="45" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill={strokeColor} fontFamily="'Outfit', sans-serif">ROOM</text>
          <text x="45" y="49" textAnchor="middle" fontSize="8" fill={detailColor} fontFamily="sans-serif">12' × 10'</text>
        </svg>
      );

    case 'Door':
    case 'Single Door':
    case 'Bathroom Door':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          {/* Wall jambs */}
          <rect x="8" y="44" width="8" height="28" fill="#1e293b" />
          <rect x="64" y="44" width="8" height="28" fill="#1e293b" />
          {/* Door leaf */}
          <line x1="16" y1="44" x2="16" y2="8" stroke={strokeColor} strokeWidth="3" />
          {/* Swing arc */}
          <path d="M 16 8 A 36 36 0 0 1 52 44" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      );

    case 'Main Entrance':
    case 'Main Door':
      return (
        <svg width={width} height={height} viewBox="0 0 90 80" className={className}>
          <rect x="6" y="44" width="10" height="28" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
          <rect x="74" y="44" width="10" height="28" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
          <line x1="16" y1="44" x2="16" y2="6" stroke="#b45309" strokeWidth="4" />
          <path d="M 16 6 A 38 38 0 0 1 54 44" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4 2" />
        </svg>
      );

    case 'Double Door':
      return (
        <svg width={width} height={height} viewBox="0 0 100 70" className={className}>
          <rect x="4" y="38" width="6" height="24" fill="#1e293b" />
          <rect x="90" y="38" width="6" height="24" fill="#1e293b" />
          <line x1="10" y1="38" x2="10" y2="10" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="90" y1="38" x2="90" y2="10" stroke={strokeColor} strokeWidth="2.5" />
          <path d="M 10 10 A 28 28 0 0 1 38 38" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M 90 10 A 28 28 0 0 0 62 38" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      );

    case 'Sliding Door':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="6" y="10" width="88" height="20" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <line x1="6" y1="18" x2="55" y2="18" stroke={strokeColor} strokeWidth="3" />
          <line x1="45" y1="22" x2="94" y2="22" stroke={strokeColor} strokeWidth="3" />
          {/* Slide arrows */}
          <polygon points="48,15 54,18 48,21" fill={accentColor} />
          <polygon points="52,25 46,22 52,19" fill={accentColor} />
        </svg>
      );

    case 'Window':
    case 'Single Window':
    case 'Standard Window':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          <rect x="6" y="12" width="78" height="16" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="6" y1="20" x2="84" y2="20" stroke={accentColor} strokeWidth="2" />
          <line x1="32" y1="12" x2="32" y2="28" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="58" y1="12" x2="58" y2="28" stroke={strokeColor} strokeWidth="1.5" />
          {/* Sill */}
          <line x1="2" y1="8" x2="88" y2="8" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Double Window':
    case 'Large Window':
      return (
        <svg width={width} height={height} viewBox="0 0 120 40" className={className}>
          <rect x="4" y="10" width="112" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="4" y1="20" x2="116" y2="20" stroke={accentColor} strokeWidth="2.5" />
          <line x1="40" y1="10" x2="40" y2="30" stroke={strokeColor} strokeWidth="2" />
          <line x1="80" y1="10" x2="80" y2="30" stroke={strokeColor} strokeWidth="2" />
          <line x1="2" y1="6" x2="118" y2="6" stroke={detailColor} strokeWidth="2" />
        </svg>
      );

    case 'Bathroom Window':
    case 'Ventilator':
      return (
        <svg width={width} height={height} viewBox="0 0 60 40" className={className}>
          <rect x="4" y="10" width="52" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <line x1="4" y1="20" x2="56" y2="20" stroke={accentColor} strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="18" y1="10" x2="18" y2="30" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="36" y1="10" x2="36" y2="30" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Sliding Window':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          <rect x="6" y="10" width="78" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <line x1="6" y1="16" x2="52" y2="16" stroke={accentColor} strokeWidth="2" />
          <line x1="38" y1="24" x2="84" y2="24" stroke={accentColor} strokeWidth="2" />
          <line x1="45" y1="10" x2="45" y2="30" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Opening':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          <rect x="8" y="10" width="10" height="20" fill="#1e293b" />
          <rect x="72" y="10" width="10" height="20" fill="#1e293b" />
          <line x1="18" y1="14" x2="72" y2="14" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="18" y1="26" x2="72" y2="26" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 2. FURNITURE ICONS
    // ══════════════════════════════════════════════════════
    case 'Single Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 100 180" className={className}>
          <rect x="5" y="5" width="90" height="170" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="5" y="5" width="90" height="18" rx="2" fill={detailColor} opacity="0.3" stroke={strokeColor} strokeWidth="2" />
          <rect x="20" y="28" width="60" height="28" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <line x1="5" y1="70" x2="95" y2="70" stroke={detailColor} strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      );

    case 'Double Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 150 190" className={className}>
          <rect x="5" y="5" width="140" height="180" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="5" y="5" width="140" height="20" rx="2" fill={detailColor} opacity="0.3" stroke={strokeColor} strokeWidth="2" />
          <rect x="15" y="30" width="55" height="30" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <rect x="80" y="30" width="55" height="30" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <line x1="5" y1="75" x2="145" y2="75" stroke={detailColor} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
      );

    case 'Queen Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 165 195" className={className}>
          <rect x="5" y="5" width="155" height="185" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="5" y="5" width="155" height="22" rx="3" fill={detailColor} opacity="0.35" stroke={strokeColor} strokeWidth="2" />
          <rect x="16" y="32" width="60" height="32" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <rect x="89" y="32" width="60" height="32" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <line x1="5" y1="78" x2="160" y2="78" stroke={detailColor} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
      );

    case 'King Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 180 200" className={className}>
          <rect x="5" y="5" width="170" height="190" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="3.5" />
          <rect x="5" y="5" width="170" height="22" rx="3" fill={detailColor} opacity="0.35" stroke={strokeColor} strokeWidth="2" />
          <rect x="18" y="32" width="65" height="32" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <rect x="97" y="32" width="65" height="32" rx="6" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <line x1="5" y1="80" x2="175" y2="80" stroke={detailColor} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
      );

    case 'Sofa':
    case '3-Seater Sofa':
      return (
        <svg width={width} height={height} viewBox="0 0 190 80" className={className}>
          <rect x="5" y="5" width="180" height="70" rx="8" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="5" y="5" width="180" height="20" rx="4" fill={detailColor} opacity="0.25" stroke={strokeColor} strokeWidth="2" />
          <rect x="5" y="20" width="16" height="55" rx="4" fill={detailColor} opacity="0.2" stroke={strokeColor} strokeWidth="2" />
          <rect x="169" y="20" width="16" height="55" rx="4" fill={detailColor} opacity="0.2" stroke={strokeColor} strokeWidth="2" />
          <line x1="67" y1="20" x2="67" y2="75" stroke={strokeColor} strokeWidth="2" />
          <line x1="123" y1="20" x2="123" y2="75" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'L Sofa':
      return (
        <svg width={width} height={height} viewBox="0 0 160 140" className={className}>
          <path d="M 6 6 L 154 6 L 154 60 L 66 60 L 66 134 L 6 134 Z" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="6" y="6" width="148" height="18" fill={detailColor} opacity="0.25" />
          <rect x="6" y="24" width="18" height="110" fill={detailColor} opacity="0.25" />
          <line x1="76" y1="6" x2="76" y2="60" stroke={strokeColor} strokeWidth="2" />
          <line x1="115" y1="6" x2="115" y2="60" stroke={strokeColor} strokeWidth="2" />
          <line x1="6" y1="80" x2="66" y2="80" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'Chair':
    case 'Dining Chair':
      return (
        <svg width={width} height={height} viewBox="0 0 60 60" className={className}>
          <rect x="8" y="14" width="44" height="38" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <rect x="12" y="8" width="36" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'Armchair':
    case '1-Seater Sofa':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <rect x="5" y="5" width="70" height="70" rx="8" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="5" y="5" width="70" height="20" rx="4" fill={detailColor} opacity="0.25" stroke={strokeColor} strokeWidth="2" />
          <rect x="5" y="20" width="14" height="55" rx="4" fill={detailColor} opacity="0.2" stroke={strokeColor} strokeWidth="2" />
          <rect x="61" y="20" width="14" height="55" rx="4" fill={detailColor} opacity="0.2" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'Coffee Table':
      return (
        <svg width={width} height={height} viewBox="0 0 100 60" className={className}>
          <rect x="5" y="5" width="90" height="50" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <rect x="15" y="12" width="70" height="36" rx="4" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 2" />
        </svg>
      );

    case 'Dining Table 2':
    case '2-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 90 80" className={className}>
          <rect x="20" y="15" width="50" height="50" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <rect x="30" y="2" width="30" height="10" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="30" y="68" width="30" height="10" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Dining Table 4':
    case '4-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 110 100" className={className}>
          <rect x="18" y="18" width="74" height="64" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* 4 Chairs */}
          <rect x="38" y="4" width="34" height="11" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="38" y="85" width="34" height="11" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="4" y="33" width="11" height="34" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="95" y="33" width="11" height="34" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Dining Table':
    case 'Dining Table 6':
    case '6-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 160 100" className={className}>
          <rect x="20" y="20" width="120" height="60" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* 6 Chairs */}
          <rect x="35" y="4" width="28" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="95" y="4" width="28" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="35" y="84" width="28" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="95" y="84" width="28" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="4" y="35" width="12" height="30" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="144" y="35" width="12" height="30" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Dining Table 8':
    case '8-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 200 100" className={className}>
          <rect x="20" y="20" width="160" height="60" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* 8 Chairs */}
          <rect x="30" y="4" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="70" y="4" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="110" y="4" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="150" y="4" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="30" y="84" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="70" y="84" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="110" y="84" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="150" y="84" width="26" height="12" rx="3" fill={detailColor} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Wardrobe':
      return (
        <svg width={width} height={height} viewBox="0 0 120 60" className={className}>
          <rect x="3" y="3" width="114" height="54" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <line x1="60" y1="3" x2="60" y2="57" stroke={strokeColor} strokeWidth="2" />
          <line x1="3" y1="3" x2="117" y2="57" stroke={detailColor} strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="117" y1="3" x2="3" y2="57" stroke={detailColor} strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
          <line x1="55" y1="26" x2="55" y2="34" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
          <line x1="65" y1="26" x2="65" y2="34" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'Cabinet':
    case 'Bookshelf':
      return (
        <svg width={width} height={height} viewBox="0 0 100 45" className={className}>
          <rect x="4" y="4" width="92" height="37" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="33" y1="4" x2="33" y2="41" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="66" y1="4" x2="66" y2="41" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="4" y1="18" x2="96" y2="18" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );

    case 'TV':
    case 'Wall Mounted TV':
      return (
        <svg width={width} height={height} viewBox="0 0 120 28" className={className}>
          <rect x="4" y="8" width="112" height="12" rx="2" fill="#0f172a" stroke={strokeColor} strokeWidth="2" />
          <line x1="4" y1="14" x2="116" y2="14" stroke="#38bdf8" strokeWidth="2" />
          {/* Wall bracket indication */}
          <rect x="45" y="2" width="30" height="6" rx="1" fill="#475569" />
        </svg>
      );

    case 'TV Stand':
    case 'TV Unit':
      return (
        <svg width={width} height={height} viewBox="0 0 120 40" className={className}>
          <rect x="4" y="4" width="112" height="32" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <rect x="15" y="12" width="90" height="10" rx="2" fill={detailColor} stroke={strokeColor} strokeWidth="2" />
          <line x1="60" y1="22" x2="60" y2="32" stroke={strokeColor} strokeWidth="3" />
        </svg>
      );

    case 'Split AC':
    case 'Split AC Indoor Unit':
    case 'AC Indoor Unit':
    case 'Wall AC':
      return (
        <svg width={width} height={height} viewBox="0 0 100 35" className={className}>
          <rect x="4" y="6" width="92" height="23" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="14" y1="20" x2="86" y2="20" stroke="#0284c7" strokeWidth="2" />
          <circle cx="82" cy="13" r="2.5" fill="#22c55e" />
          <path d="M 30 26 Q 50 32 70 26" fill="none" stroke="#0284c7" strokeWidth="1.5" />
        </svg>
      );

    case 'AC Outdoor Unit':
    case 'Outdoor AC':
      return (
        <svg width={width} height={height} viewBox="0 0 80 50" className={className}>
          <rect x="4" y="4" width="72" height="42" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <circle cx="40" cy="25" r="14" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="40" cy="25" r="4" fill={strokeColor} />
          <line x1="10" y1="12" x2="20" y2="12" stroke={detailColor} strokeWidth="1.5" />
          <line x1="10" y1="20" x2="20" y2="20" stroke={detailColor} strokeWidth="1.5" />
          <line x1="10" y1="28" x2="20" y2="28" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Desk':
    case 'Study Desk':
      return (
        <svg width={width} height={height} viewBox="0 0 120 70" className={className}>
          <rect x="5" y="5" width="110" height="60" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <rect x="45" y="15" width="30" height="20" rx="2" fill="none" stroke={detailColor} strokeWidth="1.5" />
          <circle cx="60" cy="55" r="10" fill={detailColor} opacity="0.3" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Study Chair':
      return (
        <svg width={width} height={height} viewBox="0 0 70 70" className={className}>
          <circle cx="35" cy="35" r="24" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <path d="M 18 20 Q 35 12 52 20" fill="none" stroke={strokeColor} strokeWidth="3" />
          <line x1="35" y1="25" x2="35" y2="45" stroke={detailColor} strokeWidth="2" />
          <line x1="25" y1="35" x2="45" y2="35" stroke={detailColor} strokeWidth="2" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 3. KITCHEN ICONS
    // ══════════════════════════════════════════════════════
    case 'Kitchen Counter':
    case 'Breakfast Counter':
      return (
        <svg width={width} height={height} viewBox="0 0 140 60" className={className}>
          <rect x="3" y="3" width="134" height="54" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <line x1="3" y1="12" x2="137" y2="12" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 3" />
          <rect x="25" y="18" width="40" height="30" rx="3" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="45" cy="33" r="4" fill={strokeColor} />
        </svg>
      );

    case 'Sink':
    case 'Kitchen Sink':
      return (
        <svg width={width} height={height} viewBox="0 0 80 60" className={className}>
          <rect x="4" y="4" width="72" height="52" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="10" y="12" width="28" height="36" rx="4" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <rect x="42" y="12" width="28" height="36" rx="4" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <circle cx="40" cy="8" r="4" fill={detailColor} />
        </svg>
      );

    case 'Stove':
      return (
        <svg width={width} height={height} viewBox="0 0 80 60" className={className}>
          <rect x="4" y="4" width="72" height="52" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <circle cx="24" cy="20" r="10" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="24" cy="20" r="4" fill={strokeColor} />
          <circle cx="56" cy="20" r="10" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="56" cy="20" r="4" fill={strokeColor} />
          <circle cx="24" cy="42" r="8" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="56" cy="42" r="8" fill="none" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'Oven':
      return (
        <svg width={width} height={height} viewBox="0 0 80 60" className={className}>
          <rect x="4" y="4" width="72" height="52" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="12" y="12" width="56" height="34" rx="2" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="20" y1="28" x2="60" y2="28" stroke={detailColor} strokeWidth="2" strokeDasharray="6 4" />
          <circle cx="20" cy="8" r="2.5" fill={accentColor} />
          <circle cx="28" cy="8" r="2.5" fill={accentColor} />
        </svg>
      );

    case 'Refrigerator':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <rect x="4" y="4" width="72" height="72" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <line x1="4" y1="28" x2="76" y2="28" stroke={strokeColor} strokeWidth="3" />
          <rect x="14" y="32" width="6" height="28" rx="2" fill={detailColor} />
          <rect x="14" y="8" width="6" height="14" rx="2" fill={detailColor} />
        </svg>
      );

    case 'Dishwasher':
      return (
        <svg width={width} height={height} viewBox="0 0 70 70" className={className}>
          <rect x="4" y="4" width="62" height="62" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <line x1="4" y1="16" x2="66" y2="16" stroke={strokeColor} strokeWidth="2" />
          <circle cx="16" cy="10" r="3" fill={accentColor} />
          <rect x="12" y="24" width="46" height="34" rx="2" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 2" />
        </svg>
      );

    case 'Kitchen Cabinet':
      return (
        <svg width={width} height={height} viewBox="0 0 90 50" className={className}>
          <rect x="4" y="4" width="82" height="42" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="45" y1="4" x2="45" y2="46" stroke={strokeColor} strokeWidth="2" />
          <line x1="4" y1="4" x2="86" y2="46" stroke={detailColor} strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
        </svg>
      );

    case 'Island':
      return (
        <svg width={width} height={height} viewBox="0 0 120 70" className={className}>
          <rect x="4" y="4" width="112" height="62" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="16" y="16" width="40" height="36" rx="3" fill="none" stroke={detailColor} strokeWidth="2" />
          <circle cx="36" cy="34" r="8" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <rect x="70" y="16" width="36" height="36" rx="3" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 4. BATHROOM ICONS
    // ══════════════════════════════════════════════════════
    case 'Toilet':
    case 'Commode':
    case 'WC / Toilet':
      return (
        <svg width={width} height={height} viewBox="0 0 60 90" className={className}>
          <rect x="8" y="4" width="44" height="26" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <ellipse cx="30" cy="58" rx="20" ry="26" fill="#ffffff" stroke={strokeColor} strokeWidth="3" />
          <ellipse cx="30" cy="62" rx="12" ry="16" fill="none" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Wash Basin':
      return (
        <svg width={width} height={height} viewBox="0 0 60 50" className={className}>
          <path d="M 6 10 C 6 4 54 4 54 10 L 50 42 C 50 46 10 46 10 42 Z" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <ellipse cx="30" cy="24" rx="16" ry="12" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <circle cx="30" cy="8" r="3" fill={detailColor} />
        </svg>
      );

    case 'Shower':
    case 'Shower Cubicle':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <rect x="4" y="4" width="72" height="72" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <circle cx="40" cy="40" r="8" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="40" cy="40" r="3" fill={strokeColor} />
          <line x1="20" y1="20" x2="60" y2="60" stroke={detailColor} strokeWidth="1" strokeDasharray="3 3" />
          <line x1="60" y1="20" x2="20" y2="60" stroke={detailColor} strokeWidth="1" strokeDasharray="3 3" />
        </svg>
      );

    case 'Bathtub':
      return (
        <svg width={width} height={height} viewBox="0 0 150 70" className={className}>
          <rect x="4" y="4" width="142" height="62" rx="20" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <rect x="14" y="12" width="122" height="46" rx="14" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
          <circle cx="120" cy="35" r="4" fill={detailColor} />
        </svg>
      );

    case 'Bidet':
      return (
        <svg width={width} height={height} viewBox="0 0 50 80" className={className}>
          <rect x="10" y="6" width="30" height="20" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <ellipse cx="25" cy="52" rx="16" ry="22" fill="#ffffff" stroke={strokeColor} strokeWidth="2.5" />
          <circle cx="25" cy="38" r="3" fill={accentColor} />
        </svg>
      );

    case 'Bathroom Cabinet':
    case 'Vanity':
    case 'Bathroom Vanity':
      return (
        <svg width={width} height={height} viewBox="0 0 80 40" className={className}>
          <rect x="4" y="4" width="72" height="32" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <circle cx="40" cy="20" r="8" fill="none" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Mirror':
      return (
        <svg width={width} height={height} viewBox="0 0 80 24" className={className}>
          <rect x="4" y="4" width="72" height="16" rx="2" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" strokeWidth="2" />
          <line x1="14" y1="6" x2="26" y2="18" stroke="#38bdf8" strokeWidth="1" />
          <line x1="30" y1="6" x2="42" y2="18" stroke="#38bdf8" strokeWidth="1" />
        </svg>
      );

    case 'Floor Drain':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <rect x="4" y="4" width="32" height="32" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <circle cx="20" cy="20" r="10" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="20" y1="10" x2="20" y2="30" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="10" y1="20" x2="30" y2="20" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 5. STAIRS ICONS
    // ══════════════════════════════════════════════════════
    case 'Staircase':
    case 'Straight Stair':
      return (
        <svg width={width} height={height} viewBox="0 0 60 120" className={className}>
          <rect x="4" y="4" width="52" height="112" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {[20, 36, 52, 68, 84, 100].map(y => (
            <line key={y} x1="4" y1={y} x2="56" y2={y} stroke={strokeColor} strokeWidth="1.5" />
          ))}
          <line x1="30" y1="100" x2="30" y2="20" stroke="#d97706" strokeWidth="2" />
          <polygon points="30,12 24,24 36,24" fill="#d97706" />
        </svg>
      );

    case 'L Stair':
      return (
        <svg width={width} height={height} viewBox="0 0 100 100" className={className}>
          <path d="M 8 8 L 92 8 L 92 48 L 48 48 L 48 92 L 8 92 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="8" y1="28" x2="48" y2="28" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="8" y1="48" x2="48" y2="48" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="28" y1="48" x2="28" y2="92" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="68" y1="8" x2="68" y2="48" stroke={strokeColor} strokeWidth="1.5" />
          {/* UP Arrow */}
          <path d="M 28 80 L 28 28 L 80 28" fill="none" stroke="#d97706" strokeWidth="2" />
          <polygon points="88,28 78,22 78,34" fill="#d97706" />
        </svg>
      );

    case 'U Stair':
      return (
        <svg width={width} height={height} viewBox="0 0 90 120" className={className}>
          <rect x="4" y="4" width="82" height="112" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="45" y1="4" x2="45" y2="70" stroke={strokeColor} strokeWidth="2" />
          {[20, 36, 52].map(y => (
            <line key={y} x1="4" y1={y} x2="45" y2={y} stroke={strokeColor} strokeWidth="1.5" />
          ))}
          {[20, 36, 52].map(y => (
            <line key={y} x1="45" y1={y} x2="86" y2={y} stroke={strokeColor} strokeWidth="1.5" />
          ))}
          <path d="M 24 60 L 24 90 Q 45 105 66 90 L 66 60" fill="none" stroke="#d97706" strokeWidth="2" />
          <polygon points="66,52 60,62 72,62" fill="#d97706" />
        </svg>
      );

    case 'Spiral Stair':
      return (
        <svg width={width} height={height} viewBox="0 0 90 90" className={className}>
          <circle cx="45" cy="45" r="40" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <circle cx="45" cy="45" r="8" fill="#334155" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(deg => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={45 + 8 * Math.cos(rad)}
                y1={45 + 8 * Math.sin(rad)}
                x2={45 + 40 * Math.cos(rad)}
                y2={45 + 40 * Math.sin(rad)}
                stroke={detailColor}
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 6. STRUCTURAL ICONS
    // ══════════════════════════════════════════════════════
    case 'Column':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <rect x="2" y="2" width="36" height="36" fill="#1e293b" stroke={strokeColor} strokeWidth="3" />
          <line x1="2" y1="2" x2="38" y2="38" stroke="#ffffff" strokeWidth="2" />
          <line x1="38" y1="2" x2="2" y2="38" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );

    case 'Pillar':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="18" fill="#1e293b" stroke={strokeColor} strokeWidth="3" />
          <line x1="7" y1="7" x2="33" y2="33" stroke="#ffffff" strokeWidth="2" />
          <line x1="33" y1="7" x2="7" y2="33" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );

    case 'Beam':
      return (
        <svg width={width} height={height} viewBox="0 0 100 30" className={className}>
          <line x1="4" y1="15" x2="96" y2="15" stroke="#f59e0b" strokeWidth="4" strokeDasharray="6 3" />
          <line x1="4" y1="8" x2="96" y2="8" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 2" />
          <line x1="4" y1="22" x2="96" y2="22" stroke={strokeColor} strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      );

    case 'Structural Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="4" y="8" width="92" height="24" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
          <line x1="12" y1="8" x2="36" y2="32" stroke="#e2e8f0" strokeWidth="2" />
          <line x1="42" y1="8" x2="66" y2="32" stroke="#e2e8f0" strokeWidth="2" />
          <line x1="72" y1="8" x2="96" y2="32" stroke="#e2e8f0" strokeWidth="2" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 7. ELECTRICAL ICONS
    // ══════════════════════════════════════════════════════
    case 'Light':
      return (
        <svg width={width} height={height} viewBox="0 0 50 50" className={className}>
          <circle cx="25" cy="25" r="16" fill="none" stroke="#eab308" strokeWidth="2.5" />
          <line x1="13" y1="13" x2="37" y2="37" stroke="#eab308" strokeWidth="2.5" />
          <line x1="37" y1="13" x2="13" y2="37" stroke="#eab308" strokeWidth="2.5" />
        </svg>
      );

    case 'Ceiling Fan':
      return (
        <svg width={width} height={height} viewBox="0 0 60 60" className={className}>
          <circle cx="30" cy="30" r="6" fill="#3b82f6" />
          <path d="M 30 24 Q 22 6 30 2 Q 38 6 30 24" fill="#3b82f6" opacity="0.8" />
          <path d="M 24 33 Q 6 38 4 30 Q 8 22 24 33" fill="#3b82f6" opacity="0.8" />
          <path d="M 35 34 Q 48 48 52 42 Q 54 32 35 34" fill="#3b82f6" opacity="0.8" />
        </svg>
      );

    case 'Switch':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="10" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="20" y1="20" x2="32" y2="10" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="32" y1="10" x2="32" y2="6" stroke={strokeColor} strokeWidth="2.5" />
        </svg>
      );

    case 'Socket':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="14" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="6" y1="20" x2="34" y2="20" stroke={strokeColor} strokeWidth="2" />
          <line x1="20" y1="20" x2="20" y2="6" stroke={strokeColor} strokeWidth="2.5" />
        </svg>
      );

    case 'Distribution Board':
      return (
        <svg width={width} height={height} viewBox="0 0 60 30" className={className}>
          <rect x="4" y="4" width="52" height="22" fill="#1e293b" stroke={strokeColor} strokeWidth="2" />
          <rect x="8" y="8" width="22" height="14" fill="#ffffff" />
          <text x="40" y="19" fontSize="9" fontWeight="bold" fill="#f59e0b" fontFamily="sans-serif">DB</text>
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 8. PLUMBING ICONS
    // ══════════════════════════════════════════════════════
    case 'Water Point':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="14" fill="none" stroke="#0284c7" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="6" fill="#0284c7" />
          <text x="20" y="38" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#0284c7">WP</text>
        </svg>
      );

    case 'Drain':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="14" fill="none" stroke="#64748b" strokeWidth="2" />
          <line x1="10" y1="20" x2="30" y2="20" stroke="#64748b" strokeWidth="2" />
          <line x1="20" y1="10" x2="20" y2="30" stroke="#64748b" strokeWidth="2" />
          <polygon points="20,10 16,16 24,16" fill="#64748b" />
        </svg>
      );

    case 'Pipe':
      return (
        <svg width={width} height={height} viewBox="0 0 100 24" className={className}>
          <line x1="4" y1="12" x2="96" y2="12" stroke="#0284c7" strokeWidth="3" />
          <circle cx="20" cy="12" r="4" fill="#0284c7" />
          <circle cx="80" cy="12" r="4" fill="#0284c7" />
        </svg>
      );

    case 'Floor Trap':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <rect x="6" y="6" width="28" height="28" fill="none" stroke="#0284c7" strokeWidth="2" />
          <circle cx="20" cy="20" r="8" fill="#0284c7" opacity="0.3" stroke="#0284c7" strokeWidth="1.5" />
          <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0284c7">FT</text>
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 9. OUTDOOR ICONS
    // ══════════════════════════════════════════════════════
    case 'Tree':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <circle cx="40" cy="40" r="34" fill="rgba(34,197,94,0.2)" stroke="#16a34a" strokeWidth="2.5" />
          <circle cx="40" cy="40" r="6" fill="#15803d" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={40}
                y1={40}
                x2={40 + 32 * Math.cos(rad)}
                y2={40 + 32 * Math.sin(rad)}
                stroke="#16a34a"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            );
          })}
        </svg>
      );

    case 'Plant':
      return (
        <svg width={width} height={height} viewBox="0 0 50 50" className={className}>
          <circle cx="25" cy="25" r="16" fill="rgba(34,197,94,0.25)" stroke="#16a34a" strokeWidth="2" />
          <circle cx="25" cy="25" r="4" fill="#15803d" />
          <path d="M 25 10 Q 30 18 25 25 Q 20 18 25 10" fill="#22c55e" />
          <path d="M 40 25 Q 32 30 25 25 Q 32 20 40 25" fill="#22c55e" />
        </svg>
      );

    case 'Garden':
      return (
        <svg width={width} height={height} viewBox="0 0 100 60" className={className}>
          <rect x="4" y="4" width="92" height="52" rx="4" fill="rgba(34,197,94,0.18)" stroke="#16a34a" strokeWidth="2" strokeDasharray="4 2" />
          <text x="50" y="35" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#15803d" fontFamily="'Outfit', sans-serif">GARDEN</text>
        </svg>
      );

    case 'Parking':
      return (
        <svg width={width} height={height} viewBox="0 0 70 120" className={className}>
          <rect x="4" y="4" width="62" height="112" rx="2" fill="none" stroke="#64748b" strokeWidth="2.5" strokeDasharray="6 4" />
          <text x="35" y="65" textAnchor="middle" fontSize="24" fontWeight="800" fill="#94a3b8" fontFamily="'Outfit', sans-serif">P</text>
        </svg>
      );

    case 'Car':
    case 'Parking Car':
      return (
        <svg width={width} height={height} viewBox="0 0 100 200" className={className}>
          <rect x="15" y="10" width="70" height="180" rx="16" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <path d="M 22 55 L 78 55 L 72 75 L 28 75 Z" fill={detailColor} opacity="0.4" stroke={strokeColor} strokeWidth="2" />
          <path d="M 26 145 L 74 145 L 78 160 L 22 160 Z" fill={detailColor} opacity="0.4" stroke={strokeColor} strokeWidth="2" />
          <rect x="25" y="75" width="50" height="70" rx="4" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <rect x="8" y="35" width="7" height="24" rx="2" fill="#1e293b" />
          <rect x="85" y="35" width="7" height="24" rx="2" fill="#1e293b" />
          <rect x="8" y="140" width="7" height="24" rx="2" fill="#1e293b" />
          <rect x="85" y="140" width="7" height="24" rx="2" fill="#1e293b" />
        </svg>
      );

    case 'Gate':
      return (
        <svg width={width} height={height} viewBox="0 0 120 40" className={className}>
          <rect x="4" y="12" width="10" height="16" fill="#1e293b" />
          <rect x="106" y="12" width="10" height="16" fill="#1e293b" />
          <line x1="14" y1="20" x2="106" y2="20" stroke={strokeColor} strokeWidth="2" />
          <line x1="20" y1="12" x2="40" y2="28" stroke={detailColor} strokeWidth="1.5" />
          <line x1="40" y1="12" x2="20" y2="28" stroke={detailColor} strokeWidth="1.5" />
          <line x1="80" y1="12" x2="100" y2="28" stroke={detailColor} strokeWidth="1.5" />
          <line x1="100" y1="12" x2="80" y2="28" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 10. ANNOTATION ICONS
    // ══════════════════════════════════════════════════════
    case 'Text':
    case 'Room Label':
      return (
        <svg width={width} height={height} viewBox="0 0 60 40" className={className}>
          <text x="30" y="26" textAnchor="middle" fontSize="18" fontWeight="bold" fill={strokeColor} fontFamily="'Outfit', sans-serif">Aa</text>
        </svg>
      );

    case 'Dimension':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <line x1="10" y1="20" x2="90" y2="20" stroke="#f59e0b" strokeWidth="2" />
          <line x1="10" y1="10" x2="10" y2="30" stroke="#f59e0b" strokeWidth="2" />
          <line x1="90" y1="10" x2="90" y2="30" stroke="#f59e0b" strokeWidth="2" />
          <polygon points="10,20 18,17 18,23" fill="#f59e0b" />
          <polygon points="90,20 82,17 82,23" fill="#f59e0b" />
          <text x="50" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#f59e0b">10'-0"</text>
        </svg>
      );

    case 'Area':
      return (
        <svg width={width} height={height} viewBox="0 0 80 40" className={className}>
          <rect x="6" y="8" width="68" height="24" rx="4" fill="rgba(14,165,233,0.15)" stroke="#0ea5e9" strokeWidth="1.5" />
          <text x="40" y="24" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0ea5e9">180 sq.ft</text>
        </svg>
      );

    case 'North Arrow':
      return (
        <svg width={width} height={height} viewBox="0 0 60 80" className={className}>
          <circle cx="30" cy="40" r="28" fill="none" stroke={strokeColor} strokeWidth="2" />
          <polygon points="30,12 42,48 30,40" fill={strokeColor} />
          <polygon points="30,12 18,48 30,40" fill="none" stroke={strokeColor} strokeWidth="2" />
          <text x="30" y="72" textAnchor="middle" fontSize="16" fontWeight="bold" fill={strokeColor} fontFamily="'Outfit', sans-serif">N</text>
        </svg>
      );

    case 'Scale':
      return (
        <svg width={width} height={height} viewBox="0 0 90 30" className={className}>
          <rect x="5" y="10" width="80" height="8" fill="#1e293b" stroke={strokeColor} strokeWidth="1" />
          <rect x="5" y="10" width="20" height="8" fill="#ffffff" />
          <rect x="45" y="10" width="20" height="8" fill="#ffffff" />
          <text x="45" y="26" textAnchor="middle" fontSize="8" fill={strokeColor}>1:50</text>
        </svg>
      );

    case 'Note':
      return (
        <svg width={width} height={height} viewBox="0 0 60 50" className={className}>
          <path d="M 8 6 L 44 6 L 52 14 L 52 44 L 8 44 Z" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
          <path d="M 44 6 L 44 14 L 52 14" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />
          <line x1="14" y1="18" x2="38" y2="18" stroke="#b45309" strokeWidth="2" />
          <line x1="14" y1="26" x2="44" y2="26" stroke="#b45309" strokeWidth="2" />
          <line x1="14" y1="34" x2="32" y2="34" stroke="#b45309" strokeWidth="2" />
        </svg>
      );

    case 'Washing Machine':
      return (
        <svg width={width} height={height} viewBox="0 0 70 70" className={className}>
          <rect x="4" y="4" width="62" height="62" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          <line x1="4" y1="16" x2="66" y2="16" stroke={strokeColor} strokeWidth="2" />
          <circle cx="35" cy="42" r="16" fill="none" stroke={strokeColor} strokeWidth="3" />
          <circle cx="35" cy="42" r="8" fill={detailColor} opacity="0.4" />
          <circle cx="52" cy="10" r="2.5" fill={detailColor} />
        </svg>
      );

    default:
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <rect x="4" y="4" width="72" height="72" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2" strokeDasharray="4 2" />
          <text x="40" y="44" textAnchor="middle" fontSize="11" fill={detailColor} fontFamily="sans-serif">
            {itemType.slice(0, 8)}
          </text>
        </svg>
      );
  }
};
