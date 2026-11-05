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
 * Standard architectural 2D CAD symbols rendered as crisp, high-precision vector SVGs.
 * Adheres to AutoCAD & Revit architectural drafting standards for top-view floor plans.
 */
export const ArchitecturalSymbol: React.FC<ArchitecturalSymbolProps> = ({
  itemType,
  width,
  height,
  blueprintMode = false,
  color,
  className = '',
}) => {
  const strokeColor = color || (blueprintMode ? '#93c5fd' : '#1e293b');
  const fillColor = blueprintMode ? 'rgba(30, 58, 138, 0.28)' : '#ffffff';
  const detailColor = blueprintMode ? '#60a5fa' : '#64748b';
  const accentColor = blueprintMode ? '#38bdf8' : '#0284c7';
  const softFill = blueprintMode ? 'rgba(59, 130, 246, 0.15)' : '#f8fafc';
  const woodFill = blueprintMode ? 'rgba(30, 58, 138, 0.35)' : '#f1f5f9';

  // Normalize case-insensitive and whitespace lookup
  const key = itemType.trim();

  switch (key) {
    // ══════════════════════════════════════════════════════
    // 1. FLOOR PLAN STRUCTURAL SYMBOLS
    // ══════════════════════════════════════════════════════
    case 'Wall':
    case 'Straight Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="4" y="10" width="92" height="20" fill="#334155" stroke={strokeColor} strokeWidth="2" rx="1" />
          <line x1="16" y1="10" x2="36" y2="30" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="38" y1="10" x2="58" y2="30" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="60" y1="10" x2="80" y2="30" stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
      );

    case 'Interior Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          {/* 4.5" (115 mm) interior partition wall: lighter fill & crisp boundary */}
          <rect x="4" y="14" width="92" height="12" fill={woodFill} stroke={strokeColor} strokeWidth="1.5" rx="1" />
          <line x1="22" y1="14" x2="34" y2="26" stroke={detailColor} strokeWidth="1" />
          <line x1="46" y1="14" x2="58" y2="26" stroke={detailColor} strokeWidth="1" />
          <line x1="70" y1="14" x2="82" y2="26" stroke={detailColor} strokeWidth="1" />
        </svg>
      );

    case 'Exterior Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          {/* 9" (230 mm) exterior load-bearing wall: solid filled core */}
          <rect x="4" y="8" width="92" height="24" fill="#0f172a" stroke={strokeColor} strokeWidth="2.5" rx="1" />
          <line x1="4" y1="8" x2="96" y2="8" stroke="#f59e0b" strokeWidth="2" />
          <line x1="16" y1="8" x2="40" y2="32" stroke="#64748b" strokeWidth="1.2" />
          <line x1="42" y1="8" x2="66" y2="32" stroke="#64748b" strokeWidth="1.2" />
          <line x1="68" y1="8" x2="92" y2="32" stroke="#64748b" strokeWidth="1.2" />
        </svg>
      );

    case 'Corner Wall':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <path d="M 10 10 L 70 10 L 70 28 L 28 28 L 28 70 L 10 70 Z" fill="#1e293b" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="10" y1="28" x2="28" y2="10" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="20" y1="42" x2="28" y2="34" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="42" y1="20" x2="50" y2="12" stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
      );

    case 'Room':
      return (
        <svg width={width} height={height} viewBox="0 0 90 70" className={className}>
          <rect x="6" y="6" width="78" height="58" rx="4" fill="rgba(251,191,36,0.12)" stroke={strokeColor} strokeWidth="2" strokeDasharray="5 3" />
          <text x="45" y="36" textAnchor="middle" fontSize="11" fontWeight="800" fill={strokeColor} fontFamily="'Outfit', sans-serif">ROOM</text>
          <text x="45" y="49" textAnchor="middle" fontSize="8.5" fontWeight="600" fill={detailColor} fontFamily="sans-serif">12' × 10'</text>
        </svg>
      );

    // ── Doors & Openings ──
    case 'Door':
    case 'Single Door':
    case 'Bathroom Door':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          {/* Wall jambs */}
          <rect x="6" y="44" width="8" height="28" fill="#1e293b" />
          <rect x="66" y="44" width="8" height="28" fill="#1e293b" />
          {/* Door panel leaf */}
          <rect x="14" y="6" width="5" height="42" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" rx="1" />
          {/* 90-degree Swing arc */}
          <path d="M 19 8 A 42 42 0 0 1 61 46" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      );

    case 'Main Entrance':
    case 'Main Door':
      return (
        <svg width={width} height={height} viewBox="0 0 90 80" className={className}>
          <rect x="4" y="44" width="10" height="28" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
          <rect x="76" y="44" width="10" height="28" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
          {/* Heavy timber main door leaf */}
          <rect x="14" y="4" width="6" height="44" fill="#d97706" stroke="#92400e" strokeWidth="2" rx="1" />
          <circle cx="17" cy="38" r="1.5" fill="#ffffff" />
          {/* Swing arc */}
          <path d="M 20 6 A 44 44 0 0 1 64 46" fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="4 2" />
        </svg>
      );

    case 'Double Door':
      return (
        <svg width={width} height={height} viewBox="0 0 100 70" className={className}>
          <rect x="4" y="38" width="6" height="24" fill="#1e293b" />
          <rect x="90" y="38" width="6" height="24" fill="#1e293b" />
          {/* Left leaf & right leaf */}
          <rect x="10" y="10" width="4" height="30" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" rx="1" />
          <rect x="86" y="10" width="4" height="30" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" rx="1" />
          <path d="M 14 10 A 30 30 0 0 1 44 40" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M 86 10 A 30 30 0 0 0 56 40" fill="none" stroke={detailColor} strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      );

    case 'Sliding Door':
      return (
        <svg width={width} height={height} viewBox="0 0 100 40" className={className}>
          <rect x="4" y="8" width="92" height="24" rx="2" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          {/* Track 1 */}
          <rect x="6" y="12" width="46" height="6" rx="1" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
          {/* Track 2 */}
          <rect x="48" y="22" width="46" height="6" rx="1" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
          {/* Motion indicator arrows */}
          <polygon points="46,15 40,12 40,18" fill={accentColor} />
          <polygon points="54,25 60,22 60,28" fill={accentColor} />
        </svg>
      );

    case 'Window':
    case 'Single Window':
    case 'Standard Window':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          {/* Wall cut opening with sill */}
          <rect x="4" y="10" width="82" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="2" rx="1" />
          <line x1="4" y1="20" x2="86" y2="20" stroke={accentColor} strokeWidth="2.5" />
          {/* Double glass panes */}
          <line x1="32" y1="10" x2="32" y2="30" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="58" y1="10" x2="58" y2="30" stroke={strokeColor} strokeWidth="1.5" />
          {/* Projecting window sill */}
          <line x1="1" y1="7" x2="89" y2="7" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Double Window':
    case 'Large Window':
      return (
        <svg width={width} height={height} viewBox="0 0 120 40" className={className}>
          <rect x="4" y="10" width="112" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="2" rx="1" />
          <line x1="4" y1="20" x2="116" y2="20" stroke={accentColor} strokeWidth="2.5" />
          <line x1="42" y1="10" x2="42" y2="30" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="78" y1="10" x2="78" y2="30" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="1" y1="7" x2="119" y2="7" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Bathroom Window':
    case 'Ventilator':
      return (
        <svg width={width} height={height} viewBox="0 0 60 40" className={className}>
          <rect x="4" y="10" width="52" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" rx="1" />
          {/* Louver lines */}
          <line x1="4" y1="16" x2="56" y2="16" stroke={accentColor} strokeWidth="1.5" />
          <line x1="4" y1="24" x2="56" y2="24" stroke={accentColor} strokeWidth="1.5" />
          <line x1="1" y1="7" x2="59" y2="7" stroke={detailColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Sliding Window':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          <rect x="4" y="10" width="82" height="20" fill={fillColor} stroke={strokeColor} strokeWidth="2" rx="1" />
          <rect x="6" y="12" width="42" height="7" rx="1" fill={softFill} stroke={accentColor} strokeWidth="1.5" />
          <rect x="42" y="21" width="42" height="7" rx="1" fill={softFill} stroke={accentColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Opening':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          <rect x="6" y="8" width="10" height="24" fill="#1e293b" />
          <rect x="74" y="8" width="10" height="24" fill="#1e293b" />
          {/* Double dashed opening clearance lines */}
          <line x1="16" y1="14" x2="74" y2="14" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="16" y1="26" x2="74" y2="26" stroke={detailColor} strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 2. BEDROOM FURNITURE (ARCHITECTURAL 2D TOP VIEW)
    // ══════════════════════════════════════════════════════
    case 'Single Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 100 180" className={className}>
          {/* Mattress outer base with rounded edge */}
          <rect x="6" y="6" width="88" height="168" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Padded Headboard */}
          <rect x="6" y="6" width="88" height="16" rx="3" fill="#cbd5e1" stroke={strokeColor} strokeWidth="2" />
          {/* Architectural single pillow with indent & seam */}
          <rect x="18" y="28" width="64" height="30" rx="7" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <path d="M 32 38 Q 50 44 68 38" fill="none" stroke={detailColor} strokeWidth="1.2" />
          {/* Folded duvet sheet / turnback line */}
          <path d="M 6 78 Q 50 86 94 78" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="6" y1="84" x2="94" y2="84" stroke={detailColor} strokeWidth="1.2" strokeDasharray="4 3" />
          {/* Duvet fold shadow hatch */}
          <rect x="10" y="88" width="80" height="78" rx="4" fill="none" stroke={detailColor} strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />
        </svg>
      );

    case 'Double Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 150 190" className={className}>
          <rect x="5" y="5" width="140" height="180" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Timber Headboard */}
          <rect x="5" y="5" width="140" height="18" rx="3" fill="#94a3b8" stroke={strokeColor} strokeWidth="2" />
          {/* Two contoured pillows */}
          <rect x="14" y="29" width="56" height="32" rx="7" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <path d="M 26 40 Q 42 46 58 40" fill="none" stroke={detailColor} strokeWidth="1.2" />
          <rect x="80" y="29" width="56" height="32" rx="7" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <path d="M 92 40 Q 108 46 124 40" fill="none" stroke={detailColor} strokeWidth="1.2" />
          {/* Turned-down bedsheet & duvet contour */}
          <path d="M 5 80 Q 75 90 145 80" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="5" y1="86" x2="145" y2="86" stroke={detailColor} strokeWidth="1.2" strokeDasharray="5 3" />
          <rect x="10" y="92" width="130" height="85" rx="4" fill="none" stroke={detailColor} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.35" />
        </svg>
      );

    case 'Queen Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 165 195" className={className}>
          <rect x="5" y="5" width="155" height="185" rx="7" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          {/* Upholstered headboard with vertical fluting */}
          <rect x="5" y="5" width="155" height="20" rx="3" fill="#cbd5e1" stroke={strokeColor} strokeWidth="2" />
          <line x1="45" y1="5" x2="45" y2="25" stroke={strokeColor} strokeWidth="1" />
          <line x1="82" y1="5" x2="82" y2="25" stroke={strokeColor} strokeWidth="1" />
          <line x1="120" y1="5" x2="120" y2="25" stroke={strokeColor} strokeWidth="1" />
          {/* Queen pillows with piping */}
          <rect x="15" y="31" width="62" height="34" rx="8" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <path d="M 28 44 Q 46 50 64 44" fill="none" stroke={detailColor} strokeWidth="1.2" />
          <rect x="88" y="31" width="62" height="34" rx="8" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <path d="M 101 44 Q 119 50 137 44" fill="none" stroke={detailColor} strokeWidth="1.2" />
          {/* Folded duvet sheet */}
          <path d="M 5 82 Q 82 92 160 82" fill="none" stroke={strokeColor} strokeWidth="2" />
          <line x1="5" y1="88" x2="160" y2="88" stroke={detailColor} strokeWidth="1.2" strokeDasharray="5 3" />
          {/* Accent bed runner across foot of bed */}
          <rect x="5" y="148" width="155" height="30" fill={softFill} stroke={detailColor} strokeWidth="1" opacity="0.7" />
        </svg>
      );

    case 'King Bed':
      return (
        <svg width={width} height={height} viewBox="0 0 180 200" className={className}>
          <rect x="5" y="5" width="170" height="190" rx="7" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          {/* Luxury Headboard */}
          <rect x="5" y="5" width="170" height="22" rx="4" fill="#94a3b8" stroke={strokeColor} strokeWidth="2" />
          <line x1="50" y1="5" x2="50" y2="27" stroke={strokeColor} strokeWidth="1.2" />
          <line x1="90" y1="5" x2="90" y2="27" stroke={strokeColor} strokeWidth="1.2" />
          <line x1="130" y1="5" x2="130" y2="27" stroke={strokeColor} strokeWidth="1.2" />
          {/* King-sized luxury pillows with center crease */}
          <rect x="15" y="33" width="70" height="36" rx="8" fill={softFill} stroke={strokeColor} strokeWidth="2" />
          <path d="M 28 47 Q 50 54 72 47" fill="none" stroke={detailColor} strokeWidth="1.2" />
          <rect x="95" y="33" width="70" height="36" rx="8" fill={softFill} stroke={strokeColor} strokeWidth="2" />
          <path d="M 108 47 Q 130 54 152 47" fill="none" stroke={detailColor} strokeWidth="1.2" />
          {/* Quilt fold lines */}
          <path d="M 5 86 Q 90 98 175 86" fill="none" stroke={strokeColor} strokeWidth="2.2" />
          <line x1="5" y1="92" x2="175" y2="92" stroke={detailColor} strokeWidth="1.4" strokeDasharray="5 3" />
          <rect x="5" y="152" width="170" height="32" fill={softFill} stroke={detailColor} strokeWidth="1" opacity="0.6" />
        </svg>
      );

    case 'Bedside Table':
    case 'Nightstand':
      return (
        <svg width={width} height={height} viewBox="0 0 50 50" className={className}>
          <rect x="4" y="4" width="42" height="42" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          <rect x="7" y="7" width="36" height="36" rx="2" fill={softFill} stroke={detailColor} strokeWidth="1" />
          {/* Top-view table lamp circle */}
          <circle cx="25" cy="25" r="9" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
          <circle cx="25" cy="25" r="3" fill="#ca8a04" />
        </svg>
      );

    case 'Wardrobe':
      return (
        <svg width={width} height={height} viewBox="0 0 120 60" className={className}>
          <rect x="3" y="3" width="114" height="54" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Center division */}
          <line x1="60" y1="3" x2="60" y2="57" stroke={strokeColor} strokeWidth="1.8" />
          {/* Internal clothes hanging rod */}
          <line x1="8" y1="30" x2="112" y2="30" stroke={detailColor} strokeWidth="1.2" strokeDasharray="3 2" />
          {/* Architectural cross lines showing full-height cabinetry */}
          <line x1="3" y1="3" x2="60" y2="57" stroke={detailColor} strokeWidth="0.8" opacity="0.35" />
          <line x1="60" y1="3" x2="3" y2="57" stroke={detailColor} strokeWidth="0.8" opacity="0.35" />
          <line x1="60" y1="3" x2="117" y2="57" stroke={detailColor} strokeWidth="0.8" opacity="0.35" />
          <line x1="117" y1="3" x2="60" y2="57" stroke={detailColor} strokeWidth="0.8" opacity="0.35" />
          {/* Pull handles */}
          <rect x="54" y="24" width="3" height="12" rx="1.5" fill={strokeColor} />
          <rect x="63" y="24" width="3" height="12" rx="1.5" fill={strokeColor} />
        </svg>
      );

    case 'Dressing Table':
      return (
        <svg width={width} height={height} viewBox="0 0 100 50" className={className}>
          <rect x="4" y="4" width="92" height="42" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          {/* Mirror base panel attached to back */}
          <rect x="12" y="4" width="76" height="6" fill="#38bdf8" opacity="0.6" stroke={strokeColor} strokeWidth="1.2" />
          {/* Cosmetic tray area */}
          <rect x="12" y="16" width="30" height="22" rx="2" fill={softFill} stroke={detailColor} strokeWidth="1" strokeDasharray="2 2" />
          {/* Top-view vanity stool tucked underneath */}
          <circle cx="68" cy="27" r="12" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="68" cy="27" r="8" fill="none" stroke={detailColor} strokeWidth="1" strokeDasharray="2 2" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 3. BATHROOM SANITARY FIXTURES (ARCHITECTURAL CAD)
    // ══════════════════════════════════════════════════════
    case 'Toilet':
    case 'Commode':
    case 'Western Toilet':
    case 'WC':
    case 'WC / Toilet':
      return (
        <svg width={width} height={height} viewBox="0 0 60 90" className={className}>
          {/* Cistern tank attached to wall */}
          <rect x="6" y="4" width="48" height="22" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Dual flush chrome button */}
          <rect x="22" y="10" width="16" height="8" rx="4" fill="none" stroke={strokeColor} strokeWidth="1.4" />
          <line x1="30" y1="10" x2="30" y2="18" stroke={strokeColor} strokeWidth="1.2" />
          {/* Toilet seat cover & hinge */}
          <rect x="12" y="26" width="36" height="6" rx="2" fill="#e2e8f0" stroke={strokeColor} strokeWidth="1.5" />
          {/* Ceramic toilet bowl outer contour */}
          <path d="M 10 32 C 10 32, 10 78, 30 84 C 50 78, 50 32, 50 32 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Inner bowl with water seal ellipse */}
          <path d="M 16 36 C 16 36, 16 72, 30 76 C 44 72, 44 36, 44 36 Z" fill={softFill} stroke={detailColor} strokeWidth="1.5" />
          <ellipse cx="30" cy="54" rx="8" ry="11" fill="none" stroke={accentColor} strokeWidth="1.2" />
        </svg>
      );

    case 'Indian Toilet':
    case 'Squat Toilet':
    case 'Squatting Pan':
    case 'Orissa Pan':
      return (
        <svg width={width} height={height} viewBox="0 0 70 90" className={className}>
          {/* Outer ceramic squat plate base */}
          <rect x="5" y="5" width="60" height="80" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Left Ribbed anti-skid footrest */}
          <rect x="9" y="16" width="13" height="52" rx="4" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <line x1="9" y1="24" x2="22" y2="24" stroke={detailColor} strokeWidth="1.2" />
          <line x1="9" y1="32" x2="22" y2="32" stroke={detailColor} strokeWidth="1.2" />
          <line x1="9" y1="40" x2="22" y2="40" stroke={detailColor} strokeWidth="1.2" />
          <line x1="9" y1="48" x2="22" y2="48" stroke={detailColor} strokeWidth="1.2" />
          <line x1="9" y1="56" x2="22" y2="56" stroke={detailColor} strokeWidth="1.2" />
          {/* Right Ribbed anti-skid footrest */}
          <rect x="48" y="16" width="13" height="52" rx="4" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <line x1="48" y1="24" x2="61" y2="24" stroke={detailColor} strokeWidth="1.2" />
          <line x1="48" y1="32" x2="61" y2="32" stroke={detailColor} strokeWidth="1.2" />
          <line x1="48" y1="40" x2="61" y2="40" stroke={detailColor} strokeWidth="1.2" />
          <line x1="48" y1="48" x2="61" y2="48" stroke={detailColor} strokeWidth="1.2" />
          <line x1="48" y1="56" x2="61" y2="56" stroke={detailColor} strokeWidth="1.2" />
          {/* Deep central oval bowl pan */}
          <ellipse cx="35" cy="42" rx="10" ry="24" fill={softFill} stroke={strokeColor} strokeWidth="2" />
          {/* Rear water trap / outlet hole */}
          <circle cx="35" cy="26" r="5" fill="#334155" />
        </svg>
      );

    case 'Wash Basin':
      return (
        <svg width={width} height={height} viewBox="0 0 70 55" className={className}>
          {/* Vanity countertop / basin rim */}
          <rect x="5" y="5" width="60" height="45" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Ceramic contoured inner basin bowl */}
          <path d="M 12 12 Q 35 8 58 12 Q 54 42 35 44 Q 16 42 12 12 Z" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* Center drain hole */}
          <circle cx="35" cy="28" r="3.5" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="35" cy="28" r="1.5" fill={detailColor} />
          {/* Hot/cold mixer tap faucet mounted at back */}
          <rect x="32" y="6" width="6" height="8" rx="2" fill={strokeColor} />
          <circle cx="35" cy="8" r="3.5" fill="none" stroke="#0284c7" strokeWidth="1" />
        </svg>
      );

    case 'Shower':
    case 'Shower Cubicle':
    case 'Shower Enclosure':
      return (
        <svg width={width} height={height} viewBox="0 0 85 85" className={className}>
          {/* Shower floor tray perimeter with curb */}
          <rect x="4" y="4" width="77" height="77" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="2.5" />
          <rect x="8" y="8" width="69" height="69" rx="2" fill={fillColor} stroke={detailColor} strokeWidth="1" strokeDasharray="3 3" />
          {/* Diagonal drain slopes */}
          <line x1="8" y1="8" x2="36" y2="36" stroke={detailColor} strokeWidth="0.8" opacity="0.5" />
          <line x1="77" y1="8" x2="48" y2="36" stroke={detailColor} strokeWidth="0.8" opacity="0.5" />
          <line x1="8" y1="77" x2="36" y2="48" stroke={detailColor} strokeWidth="0.8" opacity="0.5" />
          <line x1="77" y1="77" x2="48" y2="48" stroke={detailColor} strokeWidth="0.8" opacity="0.5" />
          {/* Stainless drain grid in center */}
          <rect x="37" y="37" width="11" height="11" rx="1.5" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="42.5" y1="37" x2="42.5" y2="48" stroke={strokeColor} strokeWidth="1" />
          <line x1="37" y1="42.5" x2="48" y2="42.5" stroke={strokeColor} strokeWidth="1" />
          {/* Wall-mounted shower arm & head */}
          <circle cx="42.5" cy="12" r="5" fill="#38bdf8" stroke={strokeColor} strokeWidth="1.5" />
          {/* Glass door partition representation */}
          <line x1="4" y1="81" x2="81" y2="81" stroke="#0284c7" strokeWidth="2" strokeDasharray="6 2" />
        </svg>
      );

    case 'Bathtub':
      return (
        <svg width={width} height={height} viewBox="0 0 160 75" className={className}>
          {/* Architectural tub deck */}
          <rect x="4" y="4" width="152" height="67" rx="18" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Ergonomic contoured interior bathing basin */}
          <rect x="14" y="12" width="132" height="51" rx="16" fill={softFill} stroke={strokeColor} strokeWidth="2" />
          {/* Sloped backrest contours on left */}
          <path d="M 28 16 Q 38 37.5 28 59" fill="none" stroke={detailColor} strokeWidth="1.5" />
          {/* Drain plug hole on right */}
          <circle cx="130" cy="37.5" r="4" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="130" cy="37.5" r="1.5" fill={detailColor} />
          {/* Faucet mixer spout & controls */}
          <rect x="146" y="34.5" width="6" height="6" rx="1" fill={strokeColor} />
        </svg>
      );

    case 'Bidet':
      return (
        <svg width={width} height={height} viewBox="0 0 50 80" className={className}>
          <rect x="8" y="5" width="34" height="20" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          <ellipse cx="25" cy="50" rx="17" ry="24" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          <ellipse cx="25" cy="50" rx="11" ry="18" fill={softFill} stroke={detailColor} strokeWidth="1.5" />
          <circle cx="25" cy="34" r="3" fill={accentColor} />
        </svg>
      );

    case 'Bathroom Cabinet':
    case 'Vanity':
    case 'Bathroom Vanity':
      return (
        <svg width={width} height={height} viewBox="0 0 90 45" className={className}>
          <rect x="4" y="4" width="82" height="37" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          <line x1="45" y1="4" x2="45" y2="41" stroke={strokeColor} strokeWidth="1.5" />
          {/* Inset basin in vanity */}
          <ellipse cx="45" cy="22" rx="18" ry="12" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="45" cy="22" r="2.5" fill={detailColor} />
          <circle cx="45" cy="11" r="2" fill={strokeColor} />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 4. LIVING ROOM SEATING & ENTERTAINMENT
    // ══════════════════════════════════════════════════════
    case 'Chair':
    case 'Dining Chair':
      return (
        <svg width={width} height={height} viewBox="0 0 60 60" className={className}>
          {/* Padded seat cushion */}
          <rect x="9" y="15" width="42" height="36" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          {/* Curved ergonomic wooden backrest */}
          <path d="M 9 16 Q 30 7 51 16" fill="none" stroke={strokeColor} strokeWidth="4" strokeLinecap="round" />
        </svg>
      );

    case 'Armchair':
    case 'Single Chair':
    case '1-Seater Sofa':
      return (
        <svg width={width} height={height} viewBox="0 0 85 85" className={className}>
          {/* Main frame */}
          <rect x="6" y="6" width="73" height="73" rx="8" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Backrest cushion */}
          <rect x="6" y="6" width="73" height="18" rx="4" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* Left & Right rolled armrests */}
          <rect x="6" y="22" width="16" height="57" rx="5" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="63" y="22" width="16" height="57" rx="5" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* Deep plush center seat cushion */}
          <rect x="23" y="25" width="39" height="50" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />
          <line x1="28" y1="48" x2="57" y2="48" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );

    case '2-Seater Sofa':
    case 'Loveseat':
      return (
        <svg width={width} height={height} viewBox="0 0 140 85" className={className}>
          <rect x="5" y="5" width="130" height="75" rx="8" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Padded Backrest */}
          <rect x="5" y="5" width="130" height="18" rx="4" fill={softFill} stroke={strokeColor} strokeWidth="2" />
          {/* Armrests */}
          <rect x="5" y="21" width="16" height="59" rx="5" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="119" y="21" width="16" height="59" rx="5" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* Two distinct seat cushions with piping */}
          <rect x="22" y="24" width="47" height="53" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="71" y="24" width="47" height="53" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />
          {/* Cushion indentation creases */}
          <line x1="28" y1="49" x2="63" y2="49" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="77" y1="49" x2="112" y2="49" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );

    case 'Sofa':
    case '3-Seater Sofa':
      return (
        <svg width={width} height={height} viewBox="0 0 190 85" className={className}>
          <rect x="5" y="5" width="180" height="75" rx="8" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Padded Backrest with 3 segment seams */}
          <rect x="5" y="5" width="180" height="18" rx="4" fill={softFill} stroke={strokeColor} strokeWidth="2" />
          <line x1="65" y1="5" x2="65" y2="23" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="125" y1="5" x2="125" y2="23" stroke={strokeColor} strokeWidth="1.5" />
          {/* Rolled armrests */}
          <rect x="5" y="21" width="16" height="59" rx="5" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="169" y="21" width="16" height="59" rx="5" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* 3 plush seat cushions */}
          <rect x="22" y="24" width="47" height="53" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="71" y="24" width="48" height="53" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="121" y="24" width="47" height="53" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />
          {/* Crease piping */}
          <line x1="28" y1="48" x2="63" y2="48" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="77" y1="48" x2="113" y2="48" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="127" y1="48" x2="162" y2="48" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );

    case 'L Sofa':
    case 'L-shaped Sofa':
    case 'Sectional Sofa':
      return (
        <svg width={width} height={height} viewBox="0 0 160 140" className={className}>
          {/* L outline frame */}
          <path d="M 6 6 L 154 6 L 154 62 L 68 62 L 68 134 L 6 134 Z" fill={fillColor} stroke={strokeColor} strokeWidth="3" />
          {/* Backrest along top & left */}
          <rect x="6" y="6" width="148" height="18" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          <rect x="6" y="24" width="18" height="110" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* Cushions */}
          <line x1="68" y1="24" x2="68" y2="62" stroke={strokeColor} strokeWidth="1.8" />
          <line x1="112" y1="24" x2="112" y2="62" stroke={strokeColor} strokeWidth="1.8" />
          <line x1="24" y1="78" x2="68" y2="78" stroke={strokeColor} strokeWidth="1.8" />
          {/* End armrests */}
          <rect x="140" y="24" width="14" height="38" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="24" y="118" width="44" height="16" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Coffee Table':
      return (
        <svg width={width} height={height} viewBox="0 0 100 60" className={className}>
          <rect x="5" y="5" width="90" height="50" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Inset beveled glass or wood grain panel */}
          <rect x="14" y="12" width="72" height="36" rx="4" fill={woodFill} stroke={detailColor} strokeWidth="1.4" strokeDasharray="5 3" />
        </svg>
      );

    case 'TV':
    case 'Wall Mounted TV':
      return (
        <svg width={width} height={height} viewBox="0 0 120 28" className={className}>
          {/* Slim TV panel */}
          <rect x="4" y="8" width="112" height="12" rx="2" fill="#0f172a" stroke={strokeColor} strokeWidth="2" />
          {/* Glass display screen reflection */}
          <line x1="6" y1="14" x2="114" y2="14" stroke="#38bdf8" strokeWidth="2" />
          {/* Heavy wall mount bracket */}
          <rect x="45" y="2" width="30" height="6" rx="1" fill="#475569" stroke={strokeColor} strokeWidth="1" />
        </svg>
      );

    case 'TV Stand':
    case 'TV Unit':
    case 'TV Console':
      return (
        <svg width={width} height={height} viewBox="0 0 130 45" className={className}>
          <rect x="4" y="4" width="122" height="37" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Left & Right storage compartments */}
          <line x1="38" y1="4" x2="38" y2="41" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="92" y1="4" x2="92" y2="41" stroke={strokeColor} strokeWidth="1.5" />
          {/* Media component shelves in center */}
          <rect x="42" y="12" width="46" height="20" rx="2" fill={softFill} stroke={detailColor} strokeWidth="1.2" />
          {/* Mounted flat screen TV above */}
          <line x1="20" y1="4" x2="110" y2="4" stroke="#0284c7" strokeWidth="2.5" />
        </svg>
      );

    case 'Bookshelf':
    case 'Cabinet':
      return (
        <svg width={width} height={height} viewBox="0 0 100 45" className={className}>
          <rect x="4" y="4" width="92" height="37" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Shelf divider vertical mullions */}
          <line x1="33" y1="4" x2="33" y2="41" stroke={strokeColor} strokeWidth="1.8" />
          <line x1="66" y1="4" x2="66" y2="41" stroke={strokeColor} strokeWidth="1.8" />
          {/* Architectural book spine indications */}
          <line x1="8" y1="12" x2="29" y2="12" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="41" y1="12" x2="62" y2="12" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="74" y1="12" x2="95" y2="12" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 5. DINING ROOM FURNITURE
    // ══════════════════════════════════════════════════════
    case 'Dining Table 2':
    case '2-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 90 90" className={className}>
          {/* Table Top */}
          <rect x="18" y="18" width="54" height="54" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Top Chair */}
          <rect x="29" y="4" width="32" height="11" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 29 4 Q 45 1 61 4" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Bottom Chair */}
          <rect x="29" y="75" width="32" height="11" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 29 86 Q 45 89 61 86" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'Dining Table 4':
    case '4-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 110 110" className={className}>
          <rect x="18" y="18" width="74" height="74" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Top Chair */}
          <rect x="38" y="4" width="34" height="11" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 38 4 Q 55 1 72 4" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Bottom Chair */}
          <rect x="38" y="95" width="34" height="11" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 38 106 Q 55 109 72 106" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Left Chair */}
          <rect x="4" y="38" width="11" height="34" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 4 38 Q 1 55 4 72" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Right Chair */}
          <rect x="95" y="38" width="11" height="34" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <path d="M 106 38 Q 109 55 106 72" fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'Dining Table':
    case 'Dining Table 6':
    case '6-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 160 110" className={className}>
          {/* Table Top */}
          <rect x="20" y="20" width="120" height="70" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Top Chairs (3) */}
          <rect x="28" y="4" width="28" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="66" y="4" width="28" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="104" y="4" width="28" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          {/* Bottom Chairs (3) */}
          <rect x="28" y="94" width="28" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="66" y="94" width="28" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="104" y="94" width="28" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          {/* Chair curved backrests */}
          <path d="M 28 4 Q 42 1 56 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 66 4 Q 80 1 94 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 104 4 Q 118 1 132 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 28 106 Q 42 109 56 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 66 106 Q 80 109 94 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 104 106 Q 118 109 132 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'Dining Table 8':
    case '8-seat Dining Table':
      return (
        <svg width={width} height={height} viewBox="0 0 200 110" className={className}>
          <rect x="20" y="20" width="160" height="70" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Top Chairs (4) */}
          <rect x="26" y="4" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="64" y="4" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="102" y="4" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="140" y="4" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          {/* Bottom Chairs (4) */}
          <rect x="26" y="94" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="64" y="94" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="102" y="94" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <rect x="140" y="94" width="26" height="12" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          {/* Curved Backrests */}
          <path d="M 26 4 Q 39 1 52 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 64 4 Q 77 1 90 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 102 4 Q 115 1 128 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 140 4 Q 153 1 166 4" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 26 106 Q 39 109 52 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 64 106 Q 77 109 90 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 102 106 Q 115 109 128 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M 140 106 Q 153 109 166 106" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 6. KITCHEN APPLIANCES & WORKTOPS
    // ══════════════════════════════════════════════════════
    case 'Kitchen Counter':
    case 'Countertop':
    case 'Breakfast Counter':
      return (
        <svg width={width} height={height} viewBox="0 0 140 60" className={className}>
          <rect x="3" y="3" width="134" height="54" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Bullnose front edge */}
          <line x1="3" y1="12" x2="137" y2="12" stroke={detailColor} strokeWidth="1.5" strokeDasharray="5 3" />
          {/* Prep workstation lines */}
          <rect x="25" y="18" width="40" height="30" rx="3" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="45" cy="33" r="3.5" fill={detailColor} />
        </svg>
      );

    case 'Sink':
    case 'Kitchen Sink':
      return (
        <svg width={width} height={height} viewBox="0 0 90 60" className={className}>
          {/* Outer sink deck rim */}
          <rect x="4" y="4" width="82" height="52" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Left Fluted Drainboard */}
          <rect x="8" y="8" width="34" height="44" rx="3" fill={softFill} stroke={strokeColor} strokeWidth="1.5" />
          <line x1="14" y1="12" x2="14" y2="48" stroke={detailColor} strokeWidth="1.2" />
          <line x1="20" y1="12" x2="20" y2="48" stroke={detailColor} strokeWidth="1.2" />
          <line x1="26" y1="12" x2="26" y2="48" stroke={detailColor} strokeWidth="1.2" />
          <line x1="32" y1="12" x2="32" y2="48" stroke={detailColor} strokeWidth="1.2" />
          {/* Right Washing Basin Bowl */}
          <rect x="46" y="8" width="36" height="44" rx="4" fill="#ffffff" stroke={strokeColor} strokeWidth="1.8" />
          {/* Center drain hole */}
          <circle cx="64" cy="30" r="4.5" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          <circle cx="64" cy="30" r="2" fill={detailColor} />
          {/* Gooseneck mixer tap mounted at back */}
          <circle cx="43" cy="8" r="3.5" fill={strokeColor} />
          <path d="M 43 8 Q 50 16 55 18" fill="none" stroke={strokeColor} strokeWidth="2" />
        </svg>
      );

    case 'Stove':
    case 'Gas Stove':
    case 'Gas Stove / Cooktop':
    case 'Cooktop':
      return (
        <svg width={width} height={height} viewBox="0 0 85 65" className={className}>
          {/* Glass/Steel Hob surface */}
          <rect x="4" y="4" width="77" height="57" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Top Left Burner with trivet grate */}
          <circle cx="24" cy="20" r="11" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <circle cx="24" cy="20" r="4" fill={strokeColor} />
          <line x1="13" y1="20" x2="35" y2="20" stroke={detailColor} strokeWidth="1.5" />
          <line x1="24" y1="9" x2="24" y2="31" stroke={detailColor} strokeWidth="1.5" />
          {/* Top Right Burner */}
          <circle cx="61" cy="20" r="11" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <circle cx="61" cy="20" r="4" fill={strokeColor} />
          <line x1="50" y1="20" x2="72" y2="20" stroke={detailColor} strokeWidth="1.5" />
          <line x1="61" y1="9" x2="61" y2="31" stroke={detailColor} strokeWidth="1.5" />
          {/* Bottom Left Small Burner */}
          <circle cx="24" cy="45" r="9" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <circle cx="24" cy="45" r="3" fill={strokeColor} />
          <line x1="15" y1="45" x2="33" y2="45" stroke={detailColor} strokeWidth="1.5" />
          <line x1="24" y1="36" x2="24" y2="54" stroke={detailColor} strokeWidth="1.5" />
          {/* Bottom Right Medium Burner */}
          <circle cx="61" cy="45" r="9" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <circle cx="61" cy="45" r="3" fill={strokeColor} />
          <line x1="52" y1="45" x2="70" y2="45" stroke={detailColor} strokeWidth="1.5" />
          <line x1="61" y1="36" x2="61" y2="54" stroke={detailColor} strokeWidth="1.5" />
          {/* Front Rotary Knobs */}
          <circle cx="36" cy="55" r="2.5" fill={strokeColor} />
          <circle cx="49" cy="55" r="2.5" fill={strokeColor} />
        </svg>
      );

    case 'Oven':
    case 'Microwave':
      return (
        <svg width={width} height={height} viewBox="0 0 80 60" className={className}>
          <rect x="4" y="4" width="72" height="52" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Transparent glass door window */}
          <rect x="12" y="14" width="56" height="34" rx="2" fill={softFill} stroke={strokeColor} strokeWidth="1.8" />
          {/* Heating element coil indication */}
          <line x1="20" y1="28" x2="60" y2="28" stroke="#ef4444" strokeWidth="1.8" strokeDasharray="5 3" />
          {/* Control dials */}
          <circle cx="20" cy="8" r="2.5" fill={accentColor} />
          <circle cx="28" cy="8" r="2.5" fill={accentColor} />
          <rect x="52" y="6" width="16" height="5" rx="1" fill="#0f172a" />
        </svg>
      );

    case 'Refrigerator':
    case 'Fridge':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          {/* Outer insulated cabinet body */}
          <rect x="4" y="4" width="72" height="72" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* French Door center split */}
          <line x1="40" y1="4" x2="40" y2="56" stroke={strokeColor} strokeWidth="2" />
          {/* Bottom freezer drawer divide */}
          <line x1="4" y1="56" x2="76" y2="56" stroke={strokeColor} strokeWidth="2.5" />
          {/* Vertical door handles */}
          <rect x="34" y="18" width="3" height="24" rx="1.5" fill={detailColor} />
          <rect x="43" y="18" width="3" height="24" rx="1.5" fill={detailColor} />
          {/* Freezer horizontal pull handle */}
          <rect x="25" y="64" width="30" height="3" rx="1.5" fill={detailColor} />
        </svg>
      );

    case 'Dishwasher':
      return (
        <svg width={width} height={height} viewBox="0 0 70 70" className={className}>
          <rect x="4" y="4" width="62" height="62" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="4" y1="16" x2="66" y2="16" stroke={strokeColor} strokeWidth="2" />
          <circle cx="16" cy="10" r="3" fill={accentColor} />
          <rect x="12" y="24" width="46" height="34" rx="2" fill="none" stroke={detailColor} strokeWidth="1.2" strokeDasharray="4 2" />
        </svg>
      );

    case 'Kitchen Cabinet':
      return (
        <svg width={width} height={height} viewBox="0 0 90 50" className={className}>
          <rect x="4" y="4" width="82" height="42" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="45" y1="4" x2="45" y2="46" stroke={strokeColor} strokeWidth="1.8" />
          <line x1="4" y1="4" x2="86" y2="46" stroke={detailColor} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />
        </svg>
      );

    case 'Island':
    case 'Kitchen Island':
      return (
        <svg width={width} height={height} viewBox="0 0 130 75" className={className}>
          <rect x="4" y="4" width="122" height="67" rx="6" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Prep surface area */}
          <rect x="14" y="14" width="54" height="47" rx="3" fill={softFill} stroke={detailColor} strokeWidth="1.5" />
          {/* Bar seating stool circles on other side */}
          <circle cx="86" cy="37.5" r="10" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <circle cx="86" cy="37.5" r="5" fill={softFill} />
          <circle cx="110" cy="37.5" r="10" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          <circle cx="110" cy="37.5" r="5" fill={softFill} />
        </svg>
      );

    // ══════════════════════════════════════════════════════
    // 7. STUDY, OFFICE & ADDITIONAL FIXTURES
    // ══════════════════════════════════════════════════════
    case 'Desk':
    case 'Study Desk':
      return (
        <svg width={width} height={height} viewBox="0 0 120 70" className={className}>
          {/* Desk desktop */}
          <rect x="4" y="4" width="112" height="62" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Cable grommet in top corner */}
          <circle cx="106" cy="14" r="3.5" fill="none" stroke={detailColor} strokeWidth="1.2" />
          {/* Drawer pedestal box on right */}
          <rect x="76" y="8" width="36" height="54" rx="2" fill={softFill} stroke={detailColor} strokeWidth="1.4" strokeDasharray="4 2" />
          {/* Keyboard / Laptop work area outline */}
          <rect x="18" y="16" width="50" height="34" rx="2" fill="none" stroke={detailColor} strokeWidth="1" strokeDasharray="3 2" />
        </svg>
      );

    case 'Study Chair':
    case 'Office Chair':
      return (
        <svg width={width} height={height} viewBox="0 0 70 70" className={className}>
          {/* 5-star swivel caster base spokes */}
          <line x1="35" y1="35" x2="35" y2="12" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="35" y1="35" x2="57" y2="28" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="35" y1="35" x2="48" y2="55" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="35" y1="35" x2="22" y2="55" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="35" y1="35" x2="13" y2="28" stroke={detailColor} strokeWidth="2.5" strokeLinecap="round" />
          {/* Casters */}
          <circle cx="35" cy="12" r="2.5" fill={strokeColor} />
          <circle cx="57" cy="28" r="2.5" fill={strokeColor} />
          <circle cx="48" cy="55" r="2.5" fill={strokeColor} />
          <circle cx="22" cy="55" r="2.5" fill={strokeColor} />
          <circle cx="13" cy="28" r="2.5" fill={strokeColor} />
          {/* Padded seat cushion */}
          <rect x="17" y="17" width="36" height="36" rx="8" fill={fillColor} stroke={strokeColor} strokeWidth="2" />
          {/* Ergonomic lumbar backrest */}
          <path d="M 17 18 Q 35 11 53 18" fill="none" stroke={strokeColor} strokeWidth="4" strokeLinecap="round" />
          {/* Left & Right armrests */}
          <rect x="12" y="24" width="4" height="22" rx="2" fill={strokeColor} />
          <rect x="54" y="24" width="4" height="22" rx="2" fill={strokeColor} />
        </svg>
      );

    case 'Washing Machine':
      return (
        <svg width={width} height={height} viewBox="0 0 70 70" className={className}>
          <rect x="4" y="4" width="62" height="62" rx="5" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {/* Top control console strip */}
          <line x1="4" y1="16" x2="66" y2="16" stroke={strokeColor} strokeWidth="1.8" />
          {/* Detergent dispenser pull drawer */}
          <rect x="8" y="7" width="16" height="6" rx="1.5" fill={softFill} stroke={detailColor} strokeWidth="1.2" />
          {/* Program selector rotary dial */}
          <circle cx="35" cy="10" r="3.5" fill={strokeColor} />
          {/* Front loader glass porthole drum */}
          <circle cx="35" cy="42" r="19" fill={softFill} stroke={strokeColor} strokeWidth="2.2" />
          <circle cx="35" cy="42" r="14" fill="none" stroke={detailColor} strokeWidth="1.5" />
          {/* Internal drum wash paddle vanes */}
          <line x1="35" y1="28" x2="35" y2="34" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="23" y1="48" x2="28" y2="45" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="47" y1="48" x2="42" y2="45" stroke={detailColor} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case 'Shoe Rack':
      return (
        <svg width={width} height={height} viewBox="0 0 90 40" className={className}>
          <rect x="4" y="4" width="82" height="32" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          {/* Slatted shelf tiers */}
          <line x1="4" y1="14" x2="86" y2="14" stroke={detailColor} strokeWidth="1.5" />
          <line x1="4" y1="24" x2="86" y2="24" stroke={detailColor} strokeWidth="1.5" />
          <line x1="30" y1="4" x2="30" y2="36" stroke={strokeColor} strokeWidth="1.5" />
          <line x1="60" y1="4" x2="60" y2="36" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Ceiling Fan':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          {/* Central chrome motor hub */}
          <circle cx="40" cy="40" r="8" fill="#3b82f6" stroke={strokeColor} strokeWidth="2" />
          <circle cx="40" cy="40" r="3" fill="#ffffff" />
          {/* 3 Aerodynamic curved fan blades (AutoCAD standard) */}
          {/* Blade 1: Top */}
          <path d="M 37 32 Q 28 8 38 4 Q 48 8 43 32 Z" fill="rgba(59, 130, 246, 0.7)" stroke={strokeColor} strokeWidth="1.5" />
          {/* Blade 2: Bottom-Right (120 deg) */}
          <path d="M 46 44 Q 68 56 68 45 Q 64 35 48 37 Z" fill="rgba(59, 130, 246, 0.7)" stroke={strokeColor} strokeWidth="1.5" />
          {/* Blade 3: Bottom-Left (240 deg) */}
          <path d="M 33 44 Q 14 56 12 45 Q 16 35 32 37 Z" fill="rgba(59, 130, 246, 0.7)" stroke={strokeColor} strokeWidth="1.5" />
        </svg>
      );

    case 'Light':
    case 'Ceiling Light':
      return (
        <svg width={width} height={height} viewBox="0 0 50 50" className={className}>
          <circle cx="25" cy="25" r="16" fill="rgba(254, 240, 138, 0.3)" stroke="#eab308" strokeWidth="2.5" />
          <line x1="14" y1="14" x2="36" y2="36" stroke="#eab308" strokeWidth="2" />
          <line x1="36" y1="14" x2="14" y2="36" stroke="#eab308" strokeWidth="2" />
        </svg>
      );

    case 'Split AC':
    case 'Split AC Indoor Unit':
    case 'AC Indoor Unit':
    case 'Wall AC':
      return (
        <svg width={width} height={height} viewBox="0 0 100 35" className={className}>
          <rect x="4" y="6" width="92" height="23" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          {/* Air discharge louver blade */}
          <line x1="12" y1="20" x2="88" y2="20" stroke="#0284c7" strokeWidth="2" />
          {/* LED display status light */}
          <circle cx="84" cy="13" r="2.5" fill="#22c55e" />
          {/* Cool airflow directional wave */}
          <path d="M 30 26 Q 50 32 70 26" fill="none" stroke="#38bdf8" strokeWidth="1.4" />
        </svg>
      );

    case 'AC Outdoor Unit':
    case 'Outdoor AC':
      return (
        <svg width={width} height={height} viewBox="0 0 80 50" className={className}>
          <rect x="4" y="4" width="72" height="42" rx="3" fill={fillColor} stroke={strokeColor} strokeWidth="2.2" />
          <circle cx="40" cy="25" r="15" fill="none" stroke={strokeColor} strokeWidth="2" />
          <circle cx="40" cy="25" r="4" fill={strokeColor} />
          {/* Condenser coil protection grille */}
          <line x1="10" y1="12" x2="20" y2="12" stroke={detailColor} strokeWidth="1.4" />
          <line x1="10" y1="20" x2="20" y2="20" stroke={detailColor} strokeWidth="1.4" />
          <line x1="10" y1="28" x2="20" y2="28" stroke={detailColor} strokeWidth="1.4" />
        </svg>
      );

    // ── Stairs ──
    case 'Staircase':
    case 'Straight Stair':
      return (
        <svg width={width} height={height} viewBox="0 0 60 120" className={className}>
          <rect x="4" y="4" width="52" height="112" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          {[18, 32, 46, 60, 74, 88, 102].map(y => (
            <line key={y} x1="4" y1={y} x2="56" y2={y} stroke={strokeColor} strokeWidth="1.4" />
          ))}
          {/* Walking flight arrow */}
          <line x1="30" y1="106" x2="30" y2="22" stroke="#d97706" strokeWidth="2.2" />
          <circle cx="30" cy="106" r="3" fill="#d97706" />
          <polygon points="30,12 24,24 36,24" fill="#d97706" />
          <text x="30" y="8" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#d97706">UP</text>
        </svg>
      );

    case 'L Stair':
      return (
        <svg width={width} height={height} viewBox="0 0 100 100" className={className}>
          <path d="M 8 8 L 92 8 L 92 48 L 48 48 L 48 92 L 8 92 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2.5" />
          <line x1="8" y1="28" x2="48" y2="28" stroke={strokeColor} strokeWidth="1.4" />
          <line x1="8" y1="48" x2="48" y2="48" stroke={strokeColor} strokeWidth="1.4" />
          <line x1="28" y1="48" x2="28" y2="92" stroke={strokeColor} strokeWidth="1.4" />
          <line x1="68" y1="8" x2="68" y2="48" stroke={strokeColor} strokeWidth="1.4" />
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
            <line key={y} x1="4" y1={y} x2="45" y2={y} stroke={strokeColor} strokeWidth="1.4" />
          ))}
          {[20, 36, 52].map(y => (
            <line key={y} x1="45" y1={y} x2="86" y2={y} stroke={strokeColor} strokeWidth="1.4" />
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
                strokeWidth="1.4"
              />
            );
          })}
        </svg>
      );

    // ── Structural Columns & Beams ──
    case 'Column':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <rect x="2" y="2" width="36" height="36" fill="#0f172a" stroke={strokeColor} strokeWidth="2.5" />
          <line x1="2" y1="2" x2="38" y2="38" stroke="#ffffff" strokeWidth="2" />
          <line x1="38" y1="2" x2="2" y2="38" stroke="#ffffff" strokeWidth="2" />
        </svg>
      );

    case 'Pillar':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <circle cx="20" cy="20" r="18" fill="#0f172a" stroke={strokeColor} strokeWidth="2.5" />
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

    // ── Electrical ──
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

    // ── Plumbing ──
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

    case 'Floor Drain':
    case 'Floor Trap':
      return (
        <svg width={width} height={height} viewBox="0 0 40 40" className={className}>
          <rect x="6" y="6" width="28" height="28" rx="3" fill="none" stroke="#0284c7" strokeWidth="2" />
          <circle cx="20" cy="20" r="9" fill="#0284c7" opacity="0.25" stroke="#0284c7" strokeWidth="1.5" />
          <line x1="20" y1="11" x2="20" y2="29" stroke="#0284c7" strokeWidth="1.2" />
          <line x1="11" y1="20" x2="29" y2="20" stroke="#0284c7" strokeWidth="1.2" />
        </svg>
      );

    // ── Outdoor & Parking ──
    case 'Tree':
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <circle cx="40" cy="40" r="34" fill="rgba(34,197,94,0.18)" stroke="#16a34a" strokeWidth="2.5" />
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
                strokeWidth="1.4"
                strokeDasharray="2 2"
              />
            );
          })}
        </svg>
      );

    case 'Plant':
      return (
        <svg width={width} height={height} viewBox="0 0 50 50" className={className}>
          <circle cx="25" cy="25" r="16" fill="rgba(34,197,94,0.22)" stroke="#16a34a" strokeWidth="2" />
          <circle cx="25" cy="25" r="4" fill="#15803d" />
          <path d="M 25 10 Q 30 18 25 25 Q 20 18 25 10" fill="#22c55e" />
          <path d="M 40 25 Q 32 30 25 25 Q 32 20 40 25" fill="#22c55e" />
        </svg>
      );

    case 'Garden':
      return (
        <svg width={width} height={height} viewBox="0 0 100 60" className={className}>
          <rect x="4" y="4" width="92" height="52" rx="4" fill="rgba(34,197,94,0.15)" stroke="#16a34a" strokeWidth="2" strokeDasharray="4 2" />
          <text x="50" y="35" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#15803d" fontFamily="'Outfit', sans-serif">GARDEN</text>
        </svg>
      );

    case 'Parking':
    case 'Car Parking':
      return (
        <svg width={width} height={height} viewBox="0 0 70 120" className={className}>
          <rect x="4" y="4" width="62" height="112" rx="3" fill="none" stroke="#64748b" strokeWidth="2.5" strokeDasharray="6 4" />
          <text x="35" y="65" textAnchor="middle" fontSize="24" fontWeight="800" fill="#94a3b8" fontFamily="'Outfit', sans-serif">P</text>
        </svg>
      );

    case 'Car':
    case 'Parking Car':
      return (
        <svg width={width} height={height} viewBox="0 0 100 200" className={className}>
          {/* Car chassis profile with aerodynamic hood & trunk */}
          <rect x="15" y="10" width="70" height="180" rx="16" fill={fillColor} stroke={strokeColor} strokeWidth="2.8" />
          {/* Front windshield */}
          <path d="M 22 55 L 78 55 L 72 75 L 28 75 Z" fill={detailColor} opacity="0.35" stroke={strokeColor} strokeWidth="1.8" />
          {/* Rear windshield */}
          <path d="M 26 145 L 74 145 L 78 160 L 22 160 Z" fill={detailColor} opacity="0.35" stroke={strokeColor} strokeWidth="1.8" />
          {/* Roof line */}
          <rect x="25" y="75" width="50" height="70" rx="4" fill="none" stroke={strokeColor} strokeWidth="1.5" />
          {/* Wheels / Tires */}
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

    // ── Annotation ──
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

    default:
      return (
        <svg width={width} height={height} viewBox="0 0 80 80" className={className}>
          <rect x="4" y="4" width="72" height="72" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth="2" strokeDasharray="4 2" />
          <text x="40" y="44" textAnchor="middle" fontSize="11" fill={detailColor} fontFamily="sans-serif">
            {itemType.slice(0, 10)}
          </text>
        </svg>
      );
  }
};
