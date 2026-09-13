/**
 * Building Mistry Construction Visuals & Image System
 * Provides curated, responsive SVG visuals for 15 tools, materials, rod diameters,
 * worker categories, refreshments, utilities, and sites.
 * Includes client-side canvas compression for custom image uploads.
 */

export interface VisualItemMeta {
  id: string;
  name: string;
  tamilName: string;
  category: string;
  description: string;
  iconName: string;
  emoji: string;
  imageUrl: string;
  imageAlt: string;
  badge?: string;
  colorTheme: {
    primary: string;
    bg: string;
    border: string;
    accent: string;
  };
}

// Utility to create encoded SVG data URIs
function svgToUri(svgString: string): string {
  const cleanSvg = svgString.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
}

// ==========================================
// 1. TOOL VISUAL ASSETS (15 Predefined + Generic Fallback)
// ==========================================

const TOOL_SVGS = {
  hammer: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgH" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="metalH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#94a3b8" />
          <stop offset="50%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#64748b" />
        </linearGradient>
        <linearGradient id="handleH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d97706" />
          <stop offset="40%" stop-color="#b45309" />
          <stop offset="100%" stop-color="#78350f" />
        </linearGradient>
        <linearGradient id="gripH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <filter id="shadowH" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <rect width="400" height="300" fill="url(#bgH)" rx="16"/>
      <circle cx="200" cy="150" r="110" fill="#f59e0b" fill-opacity="0.06"/>
      <g filter="url(#shadowH)" transform="rotate(35 200 150)">
        <!-- Claw Hammer Head -->
        <path d="M 170,70 L 230,70 Q 250,70 255,80 L 260,110 L 140,110 L 145,80 Q 150,70 170,70 Z" fill="url(#metalH)"/>
        <!-- Hammer Face -->
        <rect x="235" y="75" width="25" height="30" rx="3" fill="#e2e8f0"/>
        <!-- Claw Curve -->
        <path d="M 140,85 Q 115,90 100,120 Q 112,105 135,102 Z" fill="#64748b"/>
        <!-- Handle -->
        <rect x="188" y="110" width="24" height="150" rx="4" fill="url(#handleH)"/>
        <!-- Ergonomic Grip -->
        <rect x="185" y="180" width="30" height="75" rx="6" fill="url(#gripH)"/>
        <!-- Grip Ribs -->
        <line x1="185" y1="195" x2="215" y2="195" stroke="#475569" stroke-width="2"/>
        <line x1="185" y1="210" x2="215" y2="210" stroke="#475569" stroke-width="2"/>
        <line x1="185" y1="225" x2="215" y2="225" stroke="#475569" stroke-width="2"/>
        <line x1="185" y1="240" x2="215" y2="240" stroke="#475569" stroke-width="2"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">STEEL CLAW HAMMER • சுத்தியல்</text>
    </svg>
  `),

  trowel: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgTr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="bladeTr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f1f5f9" /><stop offset="50%" stop-color="#cbd5e1" /><stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgTr)" rx="16"/>
      <circle cx="200" cy="150" r="110" fill="#3b82f6" fill-opacity="0.06"/>
      <g transform="translate(40, -10)">
        <!-- Triangular Masonry Blade -->
        <polygon points="160,50 90,210 230,210" fill="url(#bladeTr)" stroke="#64748b" stroke-width="2"/>
        <!-- Shank -->
        <path d="M 160,190 L 160,140 Q 160,120 180,120 L 220,120" fill="none" stroke="#475569" stroke-width="12" stroke-linecap="round"/>
        <!-- Wooden Handle -->
        <rect x="210" y="105" width="80" height="30" rx="8" fill="#b45309" stroke="#78350f" stroke-width="3"/>
        <rect x="205" y="110" width="8" height="20" rx="2" fill="#d97706"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">PLASTERING TROWEL • கரண்டி</text>
    </svg>
  `),

  brickTrowel: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgBT" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="bladeBT" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#e2e8f0" /><stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgBT)" rx="16"/>
      <circle cx="200" cy="150" r="110" fill="#ef4444" fill-opacity="0.06"/>
      <g transform="translate(30, 0)">
        <!-- Pointed Philadelphia Pattern Blade -->
        <path d="M 170,40 Q 130,120 80,190 L 220,190 Q 190,120 170,40 Z" fill="url(#bladeBT)" stroke="#475569" stroke-width="2"/>
        <!-- Shank & Tang -->
        <path d="M 150,180 L 150,135 Q 150,115 175,115 L 230,115" fill="none" stroke="#334155" stroke-width="12" stroke-linecap="round"/>
        <!-- Ergonomic Handle -->
        <rect x="220" y="100" width="85" height="30" rx="8" fill="#d97706" stroke="#92400e" stroke-width="2"/>
        <!-- Brass ferrule -->
        <rect x="215" y="104" width="8" height="22" rx="2" fill="#fbbf24"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">BRICKLAYING TROWEL • செங்கல் கரண்டி</text>
    </svg>
  `),

  shovel: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgSh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="scoopSh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#334155" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgSh)" rx="16"/>
      <circle cx="200" cy="150" r="110" fill="#10b981" fill-opacity="0.06"/>
      <g transform="rotate(-30 200 150)">
        <!-- Long Ash Wooden Handle -->
        <rect x="193" y="20" width="14" height="180" rx="4" fill="#b45309"/>
        <!-- D-Grip Top -->
        <path d="M 185,20 L 215,20 Q 225,20 225,40 L 175,40 Q 175,20 185,20 Z" fill="#475569"/>
        <!-- Steel Collar Socket -->
        <polygon points="188,180 212,180 216,210 184,210" fill="#64748b"/>
        <!-- Heavy Gauge Steel Scoop -->
        <path d="M 170,210 L 230,210 L 245,260 Q 200,285 155,260 Z" fill="url(#scoopSh)" stroke="#64748b" stroke-width="2"/>
        <line x1="200" y1="210" x2="200" y2="265" stroke="#475569" stroke-width="2"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">CONSTRUCTION SPADE / SHOVEL • மண்வெட்டி</text>
    </svg>
  `),

  pickaxe: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgPx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgPx)" rx="16"/>
      <circle cx="200" cy="150" r="110" fill="#f59e0b" fill-opacity="0.06"/>
      <g transform="rotate(25 200 150)">
        <!-- Wooden Shaft -->
        <rect x="192" y="70" width="16" height="190" rx="5" fill="#92400e" stroke="#78350f" stroke-width="1"/>
        <!-- Drop Forged Steel Head -->
        <path d="M 90,95 Q 200,60 310,95 Q 200,75 90,95 Z" fill="#64748b" stroke="#94a3b8" stroke-width="2"/>
        <!-- Chisel End -->
        <rect x="85" y="90" width="12" height="10" fill="#cbd5e1"/>
        <!-- Pointed Pick End -->
        <polygon points="310,95 325,95 315,90" fill="#cbd5e1"/>
        <!-- Central Eye Collar -->
        <circle cx="200" cy="80" r="14" fill="#334155" stroke="#cbd5e1" stroke-width="2"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">HEAVY PICKAXE • பிக்காஸ் / கோடாரி</text>
    </svg>
  `),

  crowbar: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgCb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="barSteel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#1e293b" /><stop offset="40%" stop-color="#64748b" /><stop offset="70%" stop-color="#94a3b8" /><stop offset="100%" stop-color="#334155" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgCb)" rx="16"/>
      <g transform="rotate(-35 200 150)">
        <!-- Hexagonal Shaft -->
        <rect x="192" y="50" width="16" height="200" rx="3" fill="url(#barSteel)"/>
        <!-- Chisel Point Bottom -->
        <polygon points="192,250 208,250 200,270" fill="#cbd5e1"/>
        <!-- Curved Crow Foot Top -->
        <path d="M 192,60 Q 185,30 160,25 L 155,35 Q 180,45 192,70 Z" fill="url(#barSteel)"/>
        <!-- Nail Puller Notch -->
        <polygon points="160,25 155,35 150,30" fill="#0f172a"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">HEXAGONAL STEEL CROWBAR • கடப்பாரை</text>
    </svg>
  `),

  measuringTape: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgTp" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgTp)" rx="16"/>
      <g transform="translate(100, 50)">
        <!-- Yellow Tape Blade Extrusion -->
        <rect x="120" y="90" width="120" height="24" fill="#fbbf24" stroke="#d97706" stroke-width="1"/>
        <!-- Metric markings -->
        <line x1="140" y1="90" x2="140" y2="102" stroke="#000" stroke-width="1"/>
        <line x1="160" y1="90" x2="160" y2="106" stroke="#000" stroke-width="2"/>
        <line x1="180" y1="90" x2="180" y2="102" stroke="#000" stroke-width="1"/>
        <line x1="200" y1="90" x2="200" y2="106" stroke="#000" stroke-width="2"/>
        <line x1="220" y1="90" x2="220" y2="102" stroke="#000" stroke-width="1"/>
        <polygon points="240,90 240,114 246,120 246,90" fill="#475569"/>
        <!-- Main Tape Housing Body -->
        <rect x="30" y="40" width="110" height="110" rx="30" fill="#f59e0b" stroke="#b45309" stroke-width="4"/>
        <!-- Black Rubber Cushion -->
        <path d="M 30,70 Q 30,40 60,40 L 110,40 Q 140,40 140,70 L 140,90 L 30,90 Z" fill="#1e293b"/>
        <!-- Lock Button -->
        <rect x="70" y="25" width="28" height="20" rx="4" fill="#ef4444"/>
        <!-- Center Emblem -->
        <circle cx="85" cy="100" r="28" fill="#1e293b" stroke="#f59e0b" stroke-width="3"/>
        <text x="85" y="105" font-family="sans-serif" font-size="12" font-weight="900" fill="#fff" text-anchor="middle">5M</text>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">MEASURING TAPE • அளக்கும் டேப்</text>
    </svg>
  `),

  bucket: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgBk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="bucketGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#1e40af" /><stop offset="50%" stop-color="#3b82f6" /><stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgBk)" rx="16"/>
      <g transform="translate(100, 40)">
        <!-- Bucket Rim -->
        <ellipse cx="100" cy="60" rx="85" ry="18" fill="#1e3a8a" stroke="#60a5fa" stroke-width="3"/>
        <!-- Bucket Body -->
        <path d="M 20,65 L 45,185 Q 100,205 155,185 L 180,65 Z" fill="url(#bucketGrad)" stroke="#1e3a8a" stroke-width="2"/>
        <!-- Bottom Rim -->
        <ellipse cx="100" cy="185" rx="55" ry="12" fill="#1e3a8a"/>
        <!-- Metal Handle Arch -->
        <path d="M 15,65 Q 100,-15 185,65" fill="none" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
        <!-- Plastic Grip on Handle -->
        <rect x="80" y="10" width="40" height="12" rx="4" fill="#f59e0b"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">HEAVY MORTAR BUCKET • வாளி</text>
    </svg>
  `),

  wheelbarrow: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgWb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgWb)" rx="16"/>
      <g transform="translate(60, 40)">
        <!-- Tray Hopper -->
        <polygon points="90,70 240,70 210,140 70,120" fill="#ea580c" stroke="#c2410c" stroke-width="3"/>
        <!-- Handles/Frame -->
        <line x1="20" y1="130" x2="210" y2="180" stroke="#334155" stroke-width="10" stroke-linecap="round"/>
        <line x1="20" y1="140" x2="180" y2="185" stroke="#334155" stroke-width="10" stroke-linecap="round"/>
        <!-- Rubber Grips -->
        <rect x="15" y="125" width="30" height="14" rx="4" fill="#0f172a"/>
        <!-- Front Wheel Support -->
        <polygon points="200,160 250,185 220,185" fill="#475569"/>
        <!-- Heavy Tire -->
        <circle cx="245" cy="185" r="32" fill="#0f172a" stroke="#475569" stroke-width="6"/>
        <!-- Steel Rim Hub -->
        <circle cx="245" cy="185" r="14" fill="#cbd5e1"/>
        <!-- Resting Legs -->
        <line x1="100" y1="135" x2="90" y2="195" stroke="#334155" stroke-width="8" stroke-linecap="round"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">CONSTRUCTION WHEELBARROW • தள்ளுவண்டி</text>
    </svg>
  `),

  ladder: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgLd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="aluLd" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#94a3b8" /><stop offset="50%" stop-color="#f1f5f9" /><stop offset="100%" stop-color="#64748b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgLd)" rx="16"/>
      <g transform="rotate(15 200 150)">
        <!-- Left Stile -->
        <rect x="150" y="30" width="14" height="230" rx="3" fill="url(#aluLd)"/>
        <!-- Right Stile -->
        <rect x="236" y="30" width="14" height="230" rx="3" fill="url(#aluLd)"/>
        <!-- Rungs -->
        <rect x="160" y="60" width="80" height="8" rx="2" fill="#cbd5e1"/>
        <rect x="160" y="95" width="80" height="8" rx="2" fill="#cbd5e1"/>
        <rect x="160" y="130" width="80" height="8" rx="2" fill="#cbd5e1"/>
        <rect x="160" y="165" width="80" height="8" rx="2" fill="#cbd5e1"/>
        <rect x="160" y="200" width="80" height="8" rx="2" fill="#cbd5e1"/>
        <rect x="160" y="235" width="80" height="8" rx="2" fill="#cbd5e1"/>
        <!-- Anti-slip Feet -->
        <rect x="146" y="255" width="22" height="10" rx="2" fill="#ea580c"/>
        <rect x="232" y="255" width="22" height="10" rx="2" fill="#ea580c"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">ALUMINIUM LADDER • ஏணி / சாரம்</text>
    </svg>
  `),

  drillMachine: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgDr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgDr)" rx="16"/>
      <g transform="translate(80, 50)">
        <!-- Drill Chuck -->
        <rect x="190" y="68" width="30" height="24" rx="2" fill="#475569"/>
        <!-- Drill Bit -->
        <polygon points="220,77 265,79 265,81 220,83" fill="#cbd5e1"/>
        <!-- Motor Casing -->
        <path d="M 60,60 L 190,60 L 190,105 L 100,105 L 100,165 L 65,165 Q 50,165 50,140 L 50,70 Q 50,60 60,60 Z" fill="#0284c7" stroke="#0369a1" stroke-width="3"/>
        <!-- Air vents -->
        <line x1="75" y1="75" x2="75" y2="95" stroke="#0f172a" stroke-width="3"/>
        <line x1="85" y1="75" x2="85" y2="95" stroke="#0f172a" stroke-width="3"/>
        <line x1="95" y1="75" x2="95" y2="95" stroke="#0f172a" stroke-width="3"/>
        <!-- Red Trigger Button -->
        <polygon points="98,115 88,125 98,135" fill="#ef4444"/>
        <!-- Heavy Battery / Power Cord Base -->
        <rect x="45" y="165" width="45" height="25" rx="4" fill="#1e293b"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">HAMMER DRILL MACHINE • டிரில் மெஷின்</text>
    </svg>
  `),

  grinder: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgGr" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgGr)" rx="16"/>
      <g transform="translate(60, 60)">
        <!-- Body Handle -->
        <rect x="40" y="80" width="130" height="40" rx="10" fill="#16a34a" stroke="#15803d" stroke-width="3"/>
        <!-- Gear Box Head -->
        <rect x="165" y="70" width="50" height="60" rx="8" fill="#475569"/>
        <!-- Safety Guard Shield -->
        <path d="M 180,50 A 55 55 0 0 1 235,105 L 180,105 Z" fill="#334155"/>
        <!-- Abrasive Cutting Disc -->
        <circle cx="215" cy="100" r="55" fill="none" stroke="#d97706" stroke-width="8" stroke-dasharray="8 4"/>
        <!-- Spindle Flange -->
        <circle cx="215" cy="100" r="14" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
        <!-- Auxiliary Handle -->
        <rect x="180" y="30" width="20" height="40" rx="4" fill="#0f172a"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">ANGLE GRINDER / CUTTER • கட்டிங் மெஷின்</text>
    </svg>
  `),

  concreteMixer: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgMx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgMx)" rx="16"/>
      <g transform="translate(80, 30)">
        <!-- Heavy Frame Chassis -->
        <line x1="40" y1="180" x2="200" y2="180" stroke="#f59e0b" stroke-width="8"/>
        <line x1="60" y1="180" x2="110" y2="100" stroke="#f59e0b" stroke-width="6"/>
        <line x1="180" y1="180" x2="130" y2="100" stroke="#f59e0b" stroke-width="6"/>
        <!-- Rotating Drum Body -->
        <path d="M 70,120 Q 120,40 170,120 L 150,155 Q 120,165 90,155 Z" fill="#e11d48" stroke="#be123c" stroke-width="3"/>
        <!-- Drum Lip Opening -->
        <ellipse cx="120" cy="70" rx="35" ry="12" fill="#1e293b" stroke="#cbd5e1" stroke-width="3"/>
        <!-- Ring Gear -->
        <circle cx="120" cy="130" r="30" fill="none" stroke="#f59e0b" stroke-width="4" stroke-dasharray="5 3"/>
        <!-- Steel Wheels -->
        <circle cx="50" cy="195" r="22" fill="#334155" stroke="#f59e0b" stroke-width="4"/>
        <circle cx="190" cy="195" r="22" fill="#334155" stroke="#f59e0b" stroke-width="4"/>
        <!-- Tilting Handwheel -->
        <circle cx="215" cy="115" r="18" fill="none" stroke="#64748b" stroke-width="4"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">CONCRETE MIXER (10/7 CFT) • கலவை இயந்திரம்</text>
    </svg>
  `),

  toolBox: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgTb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgTb)" rx="16"/>
      <g transform="translate(80, 50)">
        <!-- Box Main Container -->
        <rect x="20" y="80" width="200" height="90" rx="8" fill="#dc2626" stroke="#991b1b" stroke-width="3"/>
        <!-- Box Lid -->
        <path d="M 15,80 L 25,50 L 215,50 L 225,80 Z" fill="#b91c1c" stroke="#991b1b" stroke-width="3"/>
        <!-- Top Heavy Handle -->
        <path d="M 85,50 L 85,30 L 155,30 L 155,50" fill="none" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
        <!-- Metal Latches -->
        <rect x="65" y="72" width="16" height="24" rx="2" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
        <rect x="155" y="72" width="16" height="24" rx="2" fill="#cbd5e1" stroke="#475569" stroke-width="2"/>
        <!-- Reinforced Corner Bumpers -->
        <rect x="18" y="150" width="16" height="22" rx="2" fill="#1e293b"/>
        <rect x="206" y="150" width="16" height="22" rx="2" fill="#1e293b"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">SITE TOOL BOX • டூல் பாக்ஸ்</text>
    </svg>
  `),

  saw: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgSw" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgSw)" rx="16"/>
      <g transform="translate(60, 40)">
        <!-- Tapered Steel Saw Blade -->
        <polygon points="60,90 260,110 260,125 60,150" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
        <!-- Serrated Teeth Edge -->
        <path d="M 60,150 L 80,155 L 85,150 L 105,155 L 110,150 L 130,155 L 135,150 L 155,155 L 160,150 L 180,155 L 185,150 L 205,155 L 210,150 L 230,155 L 235,150 L 260,125" stroke="#64748b" stroke-width="2" fill="none"/>
        <!-- Wooden Handle with Grip Hole -->
        <path d="M 20,80 Q 70,70 75,90 L 75,150 Q 70,165 20,155 Z" fill="#d97706" stroke="#92400e" stroke-width="3"/>
        <ellipse cx="45" cy="118" rx="14" ry="20" fill="#0f172a"/>
        <!-- Brass Handle Screws -->
        <circle cx="62" cy="100" r="3" fill="#fbbf24"/>
        <circle cx="62" cy="138" r="3" fill="#fbbf24"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">CARPENTRY HAND SAW • மரம் அறுக்கும் வாள்</text>
    </svg>
  `),

  // Generic neutral machinery fallback (NEVER hammer for custom tools!)
  customTool: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgCt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" /><stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgCt)" rx="16"/>
      <g transform="translate(100, 40)">
        <!-- Industrial Gear / Machinery Symbol -->
        <circle cx="100" cy="100" r="55" fill="#334155" stroke="#f59e0b" stroke-width="6"/>
        <circle cx="100" cy="100" r="25" fill="#0f172a" stroke="#cbd5e1" stroke-width="4"/>
        <!-- Gear teeth -->
        <rect x="92" y="32" width="16" height="20" rx="3" fill="#f59e0b"/>
        <rect x="92" y="148" width="16" height="20" rx="3" fill="#f59e0b"/>
        <rect x="32" y="92" width="20" height="16" rx="3" fill="#f59e0b"/>
        <rect x="148" y="92" width="20" height="16" rx="3" fill="#f59e0b"/>
        <!-- Wrench overlay -->
        <path d="M 60,60 L 140,140" stroke="#cbd5e1" stroke-width="12" stroke-linecap="round"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f59e0b" text-anchor="middle" letter-spacing="1">EQUIPMENT & MACHINERY • தளம் உபகரணம்</text>
    </svg>
  `),
};

// ==========================================
// 2. MATERIAL VISUAL ASSETS
// ==========================================

const MATERIAL_SVGS = {
  sand: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgSd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="sandG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fef3c7"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgSd)" rx="16"/>
      <g transform="translate(50, 40)">
        <!-- Natural river sand dune -->
        <path d="M 20,200 Q 150,50 280,200 Z" fill="url(#sandG)"/>
        <path d="M 60,200 Q 180,90 290,200 Z" fill="#b45309" fill-opacity="0.25"/>
        <ellipse cx="150" cy="195" rx="135" ry="18" fill="#92400e"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fbbf24" text-anchor="middle" letter-spacing="1">RIVER SAND (PLASTERING GRADE) • ஆற்று மணல்</text>
    </svg>
  `),

  msand: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgMs" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="msandG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgMs)" rx="16"/>
      <g transform="translate(50, 40)">
        <!-- Angular crushed blue metal sand pile -->
        <polygon points="30,200 150,60 270,200" fill="url(#msandG)"/>
        <polygon points="150,60 270,200 180,200" fill="#1e293b" fill-opacity="0.4"/>
        <ellipse cx="150" cy="195" rx="130" ry="16" fill="#0f172a"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">MANUFACTURED SAND (M-SAND) • எம்-சாண்ட்</text>
    </svg>
  `),

  cement: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgCm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="bagCm" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#dc2626"/><stop offset="40%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgCm)" rx="16"/>
      <g transform="translate(100, 35)">
        <!-- 50kg Heavy Paper/HDPE Cement Sack -->
        <rect x="25" y="30" width="150" height="180" rx="12" fill="url(#bagCm)" stroke="#991b1b" stroke-width="3"/>
        <!-- Top and Bottom Stitched Seams -->
        <line x1="25" y1="42" x2="175" y2="42" stroke="#fef08a" stroke-width="4" stroke-dasharray="4 2"/>
        <line x1="25" y1="198" x2="175" y2="198" stroke="#fef08a" stroke-width="4" stroke-dasharray="4 2"/>
        <!-- Center Emblem / Badge -->
        <rect x="40" y="80" width="120" height="70" rx="6" fill="#ffffff"/>
        <text x="100" y="108" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#b91c1c" text-anchor="middle">CEMENT</text>
        <text x="100" y="126" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#0f172a" text-anchor="middle">50 KG NETT</text>
        <text x="100" y="142" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#475569" text-anchor="middle">PPC / OPC GRADE</text>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f87171" text-anchor="middle" letter-spacing="1">PREMIUM CEMENT (50 KG SACK) • சிமெண்ட்</text>
    </svg>
  `),

  bricks: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgBr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="brickRed" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#9a3412"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgBr)" rx="16"/>
      <g transform="translate(70, 40)">
        <!-- Staggered Chamber Red Clay Bricks -->
        <rect x="20" y="40" width="100" height="42" rx="4" fill="url(#brickRed)" stroke="#7c2d12" stroke-width="2"/>
        <rect x="130" y="40" width="100" height="42" rx="4" fill="url(#brickRed)" stroke="#7c2d12" stroke-width="2"/>
        <rect x="70" y="90" width="110" height="42" rx="4" fill="url(#brickRed)" stroke="#7c2d12" stroke-width="2"/>
        <rect x="20" y="140" width="100" height="42" rx="4" fill="url(#brickRed)" stroke="#7c2d12" stroke-width="2"/>
        <rect x="130" y="140" width="100" height="42" rx="4" fill="url(#brickRed)" stroke="#7c2d12" stroke-width="2"/>
        <!-- Frog depression on top brick -->
        <rect x="85" y="98" width="80" height="24" rx="4" fill="#7c2d12"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fb923c" text-anchor="middle" letter-spacing="1">CHAMBER RED CLAY BRICKS • செங்கல்</text>
    </svg>
  `),

  aggregate: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgAg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgAg)" rx="16"/>
      <g transform="translate(60, 40)">
        <!-- 20mm Blue Metal Granite Aggregates -->
        <polygon points="50,150 90,120 120,140 100,180 60,175" fill="#475569" stroke="#64748b" stroke-width="2"/>
        <polygon points="110,110 160,80 190,110 170,140 120,130" fill="#334155" stroke="#64748b" stroke-width="2"/>
        <polygon points="170,130 220,110 240,150 200,175 160,160" fill="#64748b" stroke="#94a3b8" stroke-width="2"/>
        <polygon points="80,180 130,165 150,195 110,210 75,200" fill="#1e293b" stroke="#475569" stroke-width="2"/>
        <polygon points="150,175 200,165 220,200 175,215 140,195" fill="#475569" stroke="#64748b" stroke-width="2"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="1">BLUE METAL AGGREGATES (20MM) • ஜல்லி</text>
    </svg>
  `),

  otherMaterials: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgOm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgOm)" rx="16"/>
      <g transform="translate(100, 40)">
        <rect x="40" y="50" width="120" height="130" rx="8" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="3"/>
        <circle cx="100" cy="105" r="30" fill="#3b82f6" stroke="#93c5fd" stroke-width="3"/>
        <path d="M 85,105 L 115,105 M 100,90 L 100,120" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#60a5fa" text-anchor="middle" letter-spacing="1">CIVIL MATERIALS & SUPPLIES • இதர பொருட்கள்</text>
    </svg>
  `),
};

// ==========================================
// 3. STEEL ROD VISUAL ASSETS (Individual Diameters)
// ==========================================

export function generateRodSvg(diameter: string, highlightColor = '#3b82f6'): string {
  const numDia = parseInt(diameter) || 12;
  // Calculate relative rebar thickness (scale thickness between 6px to 36px)
  const barThickness = Math.max(8, Math.min(42, Math.round(numDia * 1.5)));

  return svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgRod" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="tmtSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#cbd5e1"/>
          <stop offset="35%" stop-color="#475569"/>
          <stop offset="70%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgRod)" rx="16"/>
      <g transform="translate(40, 50)">
        <!-- Horizontal TMT Rebar Core -->
        <rect x="20" y="${100 - barThickness / 2}" width="280" height="${barThickness}" rx="${Math.min(6, barThickness / 2)}" fill="url(#tmtSteel)" stroke="#334155" stroke-width="2"/>
        
        <!-- Ribs / Lugs Pattern along bar length -->
        ${Array.from({ length: 14 }).map((_, i) => {
          const x = 35 + i * 19;
          return `
            <path d="M ${x},${100 - barThickness / 2} L ${x + 10},${100 + barThickness / 2}" stroke="${highlightColor}" stroke-width="${Math.max(2, Math.round(barThickness / 5))}" stroke-linecap="round" stroke-opacity="0.85"/>
          `;
        }).join('')}

        <!-- Specification Tag Card -->
        <rect x="100" y="145" width="120" height="40" rx="8" fill="#1e293b" stroke="${highlightColor}" stroke-width="2"/>
        <text x="160" y="170" font-family="system-ui, sans-serif" font-size="16" font-weight="900" fill="#f8fafc" text-anchor="middle">
          DIA: ${diameter}
        </text>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${highlightColor}" text-anchor="middle" letter-spacing="1">
        TMT REBAR FE550D (${diameter}) • கம்பி
      </text>
    </svg>
  `);
}

// ==========================================
// 4. LABOUR / WORKER VISUAL ASSETS (Neutral Craftsman Avatars)
// ==========================================

const WORKER_SVGS = {
  mistry: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgMy" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgMy)" rx="16"/>
      <g transform="translate(110, 30)">
        <!-- Yellow Supervisor Hard Hat -->
        <path d="M 50,75 Q 90,30 130,75 L 145,85 L 35,85 Z" fill="#f59e0b" stroke="#b45309" stroke-width="3"/>
        <rect x="30" y="80" width="120" height="10" rx="4" fill="#fbbf24"/>
        <!-- Neutral Silhouette Head -->
        <circle cx="90" cy="115" r="32" fill="#e2e8f0"/>
        <!-- Torso with Hi-Vis Vest -->
        <path d="M 40,195 Q 40,150 90,150 Q 140,150 140,195 Z" fill="#1e293b"/>
        <!-- Orange High-Vis Vest -->
        <path d="M 55,195 L 65,155 L 85,155 L 85,195 Z" fill="#ea580c"/>
        <path d="M 125,195 L 115,155 L 95,155 L 95,195 Z" fill="#ea580c"/>
        <!-- Reflective Silver Stripes -->
        <rect x="58" y="175" width="25" height="6" fill="#cbd5e1"/>
        <rect x="97" y="175" width="25" height="6" fill="#cbd5e1"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fbbf24" text-anchor="middle" letter-spacing="1">CHIEF MISTRY (HEAD BUILDER) • மேஸ்திரி</text>
    </svg>
  `),

  periyaal: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgPy" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgPy)" rx="16"/>
      <g transform="translate(110, 30)">
        <!-- Blue Safety Helmet -->
        <path d="M 50,75 Q 90,30 130,75 L 145,85 L 35,85 Z" fill="#2563eb" stroke="#1d4ed8" stroke-width="3"/>
        <rect x="30" y="80" width="120" height="10" rx="4" fill="#3b82f6"/>
        <!-- Neutral Head -->
        <circle cx="90" cy="115" r="32" fill="#e2e8f0"/>
        <!-- Torso with Blue Mason Workwear -->
        <path d="M 40,195 Q 40,150 90,150 Q 140,150 140,195 Z" fill="#334155"/>
        <!-- Mason Trowel Emblem -->
        <polygon points="90,160 80,180 100,180" fill="#94a3b8"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#60a5fa" text-anchor="middle" letter-spacing="1">MASON / BRICKLAYER (PERIYAAL) • பெரியாள்</text>
    </svg>
  `),

  sithaal: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgSt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgSt)" rx="16"/>
      <g transform="translate(110, 30)">
        <!-- Green Helper Helmet -->
        <path d="M 50,75 Q 90,30 130,75 L 145,85 L 35,85 Z" fill="#059669" stroke="#047857" stroke-width="3"/>
        <rect x="30" y="80" width="120" height="10" rx="4" fill="#10b981"/>
        <!-- Neutral Head -->
        <circle cx="90" cy="115" r="32" fill="#e2e8f0"/>
        <!-- Workwear Torso -->
        <path d="M 40,195 Q 40,150 90,150 Q 140,150 140,195 Z" fill="#1e293b"/>
        <!-- Helper Mortar Pan Emblem -->
        <ellipse cx="90" cy="170" rx="16" ry="6" fill="#10b981"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#34d399" text-anchor="middle" letter-spacing="1">SITE HELPER (SITHAAL) • சித்தாள்</text>
    </svg>
  `),

  genericWorker: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgGw" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgGw)" rx="16"/>
      <g transform="translate(110, 30)">
        <path d="M 50,75 Q 90,30 130,75 L 145,85 L 35,85 Z" fill="#f59e0b" stroke="#b45309" stroke-width="3"/>
        <circle cx="90" cy="115" r="32" fill="#e2e8f0"/>
        <path d="M 40,195 Q 40,150 90,150 Q 140,150 140,195 Z" fill="#334155"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#cbd5e1" text-anchor="middle" letter-spacing="1">CONSTRUCTION ARTISAN • கட்டுமான பணியாளர்</text>
    </svg>
  `),
};

// ==========================================
// 5. EXPENSES VISUAL ASSETS (Tea, Snacks, Juice, Food, Pooja, EB, Water)
// ==========================================

const EXPENSE_SVGS = {
  tea: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgTe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="steelTumbler" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#94a3b8"/><stop offset="40%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#64748b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgTe)" rx="16"/>
      <g transform="translate(120, 30)">
        <!-- South Indian Davarah (Saucer) -->
        <ellipse cx="80" cy="175" rx="70" ry="18" fill="url(#steelTumbler)" stroke="#475569" stroke-width="2"/>
        <!-- Tumbler Body -->
        <polygon points="45,80 115,80 105,170 55,170" fill="url(#steelTumbler)" stroke="#475569" stroke-width="2"/>
        <ellipse cx="80" cy="80" rx="35" ry="10" fill="#78350f"/>
        <!-- Rising Hot Steam -->
        <path d="M 70,65 Q 60,45 70,30 M 80,65 Q 90,45 80,30 M 90,65 Q 100,45 90,30" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fbbf24" text-anchor="middle" letter-spacing="1">HOT TEA & COFFEE ROUNDS • டீ (தேநீர்)</text>
    </svg>
  `),

  snacks: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgSn" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="snackGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#9a3412"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgSn)" rx="16"/>
      <g transform="translate(100, 40)">
        <!-- Samosas / Masala Vada plate -->
        <polygon points="50,150 90,80 130,150" fill="url(#snackGrad)" stroke="#7c2d12" stroke-width="2"/>
        <polygon points="110,160 150,90 190,160" fill="url(#snackGrad)" stroke="#7c2d12" stroke-width="2"/>
        <!-- Crispy Medu Vada / Biscuit -->
        <circle cx="70" cy="160" r="28" fill="#d97706" stroke="#78350f" stroke-width="2"/>
        <circle cx="70" cy="160" r="10" fill="#0f172a"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fb923c" text-anchor="middle" letter-spacing="1">SNACKS & REFRESHMENTS • ஸ்நாக்ஸ் / வடை</text>
    </svg>
  `),

  juice: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgJc" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="juiceGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#84cc16"/><stop offset="100%" stop-color="#65a30d"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgJc)" rx="16"/>
      <g transform="translate(120, 30)">
        <!-- Tall Glass -->
        <polygon points="50,60 110,60 100,180 60,180" fill="url(#juiceGrad)" stroke="#e2e8f0" stroke-width="3"/>
        <ellipse cx="80" cy="60" rx="30" ry="8" fill="#a3e635"/>
        <!-- Drinking Straw -->
        <line x1="85" y1="20" x2="75" y2="160" stroke="#f43f5e" stroke-width="5" stroke-linecap="round"/>
        <!-- Lemon Wedge Slice on rim -->
        <path d="M 45,55 A 18 18 0 0 1 55,35 Z" fill="#eab308" stroke="#ca8a04" stroke-width="2"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#a3e635" text-anchor="middle" letter-spacing="1">FRESH JUICE & COOL DRINKS • ஜூஸ்</text>
    </svg>
  `),

  food: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgFd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgFd)" rx="16"/>
      <g transform="translate(80, 40)">
        <!-- Banana Leaf Lunch Pack -->
        <polygon points="20,130 120,60 220,130 120,200" fill="#15803d" stroke="#166534" stroke-width="3"/>
        <!-- Rice heap -->
        <circle cx="120" cy="130" r="30" fill="#f8fafc"/>
        <circle cx="95" cy="120" r="10" fill="#ea580c"/>
        <circle cx="145" cy="120" r="10" fill="#f59e0b"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#4ade80" text-anchor="middle" letter-spacing="1">MEALS & FOOD PACKS • உணவு / சாப்பாடு</text>
    </svg>
  `),

  pooja: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgPj" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="brassLamp" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#d97706"/><stop offset="50%" stop-color="#fef08a"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgPj)" rx="16"/>
      <g transform="translate(110, 30)">
        <!-- Traditional Kuthuvilakku Brass Lamp -->
        <ellipse cx="90" cy="190" rx="45" ry="12" fill="url(#brassLamp)" stroke="#78350f" stroke-width="2"/>
        <rect x="85" y="90" width="10" height="100" fill="url(#brassLamp)"/>
        <!-- Oil bowl -->
        <ellipse cx="90" cy="90" rx="35" ry="10" fill="url(#brassLamp)" stroke="#78350f" stroke-width="2"/>
        <!-- Sacred Flame -->
        <path d="M 90,85 Q 82,60 90,40 Q 98,60 90,85 Z" fill="#f59e0b"/>
        <path d="M 90,82 Q 86,65 90,52 Q 94,65 90,82 Z" fill="#fef08a"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fbbf24" text-anchor="middle" letter-spacing="1">BHOOMI POOJA & CEREMONY • பூமி பூஜை</text>
    </svg>
  `),

  electricity: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgEb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgEb)" rx="16"/>
      <g transform="translate(100, 35)">
        <!-- Digital EB Electricity Meter Box -->
        <rect x="30" y="30" width="140" height="160" rx="10" fill="#1e293b" stroke="#eab308" stroke-width="3"/>
        <!-- Digital LCD Screen -->
        <rect x="50" y="55" width="100" height="40" rx="4" fill="#0f172a" stroke="#475569" stroke-width="2"/>
        <text x="100" y="80" font-family="monospace" font-size="16" font-weight="900" fill="#22c55e" text-anchor="middle">240.5 V</text>
        <!-- High Voltage Lightning Bolt -->
        <polygon points="105,115 90,140 103,140 95,165 118,135 105,135" fill="#eab308"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#fde047" text-anchor="middle" letter-spacing="1">TANGEDCO EB POWER BILL • மின்சாரம்</text>
    </svg>
  `),

  water: svgToUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="bgWt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
        <linearGradient id="waterTank" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#0284c7"/><stop offset="50%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0369a1"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bgWt)" rx="16"/>
      <g transform="translate(60, 45)">
        <!-- Site Water Tanker Lorry -->
        <rect x="20" y="70" width="180" height="75" rx="35" fill="url(#waterTank)" stroke="#0284c7" stroke-width="3"/>
        <!-- Truck Cabin -->
        <path d="M 200,85 L 250,85 L 250,145 L 200,145 Z" fill="#0f172a" stroke="#0284c7" stroke-width="2"/>
        <rect x="215" y="95" width="25" height="25" rx="3" fill="#38bdf8"/>
        <!-- Wheels -->
        <circle cx="65" cy="155" r="18" fill="#0f172a" stroke="#94a3b8" stroke-width="4"/>
        <circle cx="160" cy="155" r="18" fill="#0f172a" stroke="#94a3b8" stroke-width="4"/>
        <circle cx="230" cy="155" r="18" fill="#0f172a" stroke="#94a3b8" stroke-width="4"/>
      </g>
      <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#38bdf8" text-anchor="middle" letter-spacing="1">WATER TANKER SUPPLY • தண்ணீர் டேங்கர்</text>
    </svg>
  `),
};

// ==========================================
// 6. SITE VISUAL ASSET (Architecture Illustration)
// ==========================================

export const SITE_ILLUSTRATION_SVG = svgToUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
    <defs>
      <linearGradient id="bgStArch" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
      <linearGradient id="roofGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#b45309"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#bgStArch)" rx="16"/>
    <g transform="translate(60, 30)">
      <!-- Contemporary Building Facade G+1 -->
      <rect x="50" y="80" width="180" height="130" rx="4" fill="#334155" stroke="#64748b" stroke-width="3"/>
      <!-- Balcony Floor Slab -->
      <rect x="35" y="140" width="210" height="12" rx="3" fill="#f59e0b"/>
      <!-- Glass Balcony Railing -->
      <rect x="40" y="115" width="200" height="25" rx="2" fill="#38bdf8" fill-opacity="0.25" stroke="#38bdf8" stroke-width="2"/>
      <!-- Main Door -->
      <rect x="115" y="160" width="40" height="50" rx="3" fill="#78350f" stroke="#b45309" stroke-width="2"/>
      <!-- Windows with Warm Lighting -->
      <rect x="65" y="160" width="35" height="30" rx="2" fill="#fef08a" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="175" y="160" width="35" height="30" rx="2" fill="#fef08a" stroke="#cbd5e1" stroke-width="2"/>
      <!-- Architectural Parapet Roof -->
      <polygon points="30,80 140,30 250,80" fill="url(#roofGrad)"/>
    </g>
    <text x="200" y="275" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#f59e0b" text-anchor="middle" letter-spacing="1">CONSTRUCTION SITE PROJECT • கட்டுமான தளம்</text>
  </svg>
`);

// ==========================================
// 7. CLIENT-SIDE CANVAS IMAGE COMPRESSION
// ==========================================

export async function compressImageFile(
  file: File,
  maxWidth = 800,
  maxHeight = 600,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 8. PUBLIC LOOKUP FUNCTIONS
// ==========================================

export function getToolVisual(toolName: string, customImageUrl?: string): VisualItemMeta {
  if (customImageUrl) {
    return {
      id: 'custom',
      name: toolName,
      tamilName: 'தளம் உபகரணம்',
      category: 'Tools',
      description: 'Custom site tool / machinery',
      iconName: 'Wrench',
      emoji: '⚙️',
      imageUrl: customImageUrl,
      imageAlt: toolName,
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  const clean = (toolName || '').toLowerCase();

  if (clean.includes('hammer') && !clean.includes('drill')) {
    return {
      id: 'hammer',
      name: 'Hammer',
      tamilName: 'சுத்தியல்',
      category: 'Hand Tool',
      description: 'Steel claw hammer for masonry & carpentry',
      iconName: 'Hammer',
      emoji: '🔨',
      imageUrl: TOOL_SVGS.hammer,
      imageAlt: 'Steel Claw Hammer',
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  if (clean.includes('brick trowel') || clean.includes('bricklayer')) {
    return {
      id: 'brick-trowel',
      name: 'Brick Trowel',
      tamilName: 'செங்கல் கரண்டி',
      category: 'Hand Tool',
      description: 'Pointed Philadelphia trowel for bricklaying',
      iconName: 'Layers',
      emoji: '🧱',
      imageUrl: TOOL_SVGS.brickTrowel,
      imageAlt: 'Brick Trowel',
      colorTheme: { primary: '#ef4444', bg: '#ef444415', border: '#ef444450', accent: '#f87171' },
    };
  }

  if (clean.includes('trowel') || clean.includes('karandi') || clean.includes('plastering')) {
    return {
      id: 'trowel',
      name: 'Trowel',
      tamilName: 'கரண்டி',
      category: 'Hand Tool',
      description: 'Stainless steel masonry plastering trowel',
      iconName: 'PenTool',
      emoji: '📐',
      imageUrl: TOOL_SVGS.trowel,
      imageAlt: 'Masonry Plastering Trowel',
      colorTheme: { primary: '#3b82f6', bg: '#3b82f615', border: '#3b82f650', accent: '#60a5fa' },
    };
  }

  if (clean.includes('shovel') || clean.includes('spade') || clean.includes('manvetti')) {
    return {
      id: 'shovel',
      name: 'Shovel',
      tamilName: 'மண்வெட்டி',
      category: 'Earthwork',
      description: 'Heavy gauge spade for mortar & earth transfer',
      iconName: 'Shovel',
      emoji: '⛏️',
      imageUrl: TOOL_SVGS.shovel,
      imageAlt: 'Construction Shovel Spade',
      colorTheme: { primary: '#10b981', bg: '#10b98115', border: '#10b98150', accent: '#34d399' },
    };
  }

  if (clean.includes('pickaxe') || clean.includes('pick axe') || clean.includes('pikkas')) {
    return {
      id: 'pickaxe',
      name: 'Pickaxe',
      tamilName: 'கோடாரி / பிக்காஸ்',
      category: 'Earthwork',
      description: 'Drop forged chisel and point trenching pickaxe',
      iconName: 'Pickaxe',
      emoji: '⛏️',
      imageUrl: TOOL_SVGS.pickaxe,
      imageAlt: 'Heavy Pickaxe',
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  if (clean.includes('crowbar') || clean.includes('kadaparai') || clean.includes('pry bar')) {
    return {
      id: 'crowbar',
      name: 'Crowbar',
      tamilName: 'கடப்பாரை',
      category: 'Demolition & Steel',
      description: 'Hexagonal tempered steel rock & demolition crowbar',
      iconName: 'Wrench',
      emoji: '🥢',
      imageUrl: TOOL_SVGS.crowbar,
      imageAlt: 'Steel Crowbar',
      colorTheme: { primary: '#64748b', bg: '#64748b15', border: '#64748b50', accent: '#94a3b8' },
    };
  }

  if (clean.includes('tape') || clean.includes('measure')) {
    return {
      id: 'tape',
      name: 'Measuring Tape',
      tamilName: 'அளக்கும் டேப்',
      category: 'Layout & Measurement',
      description: 'Steel blade tape measure for civil setting-out',
      iconName: 'Ruler',
      emoji: '📏',
      imageUrl: TOOL_SVGS.measuringTape,
      imageAlt: 'Measuring Tape',
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  if (clean.includes('bucket') || clean.includes('vali') || clean.includes('ghamela')) {
    return {
      id: 'bucket',
      name: 'Bucket',
      tamilName: 'வாளி / சட்டகம்',
      category: 'Material Handling',
      description: 'Heavy duty blue mortar & concrete transfer bucket',
      iconName: 'Box',
      emoji: '🪣',
      imageUrl: TOOL_SVGS.bucket,
      imageAlt: 'Construction Bucket',
      colorTheme: { primary: '#3b82f6', bg: '#3b82f615', border: '#3b82f650', accent: '#60a5fa' },
    };
  }

  if (clean.includes('wheelbarrow') || clean.includes('barrow') || clean.includes('vandi')) {
    return {
      id: 'wheelbarrow',
      name: 'Wheelbarrow',
      tamilName: 'தள்ளுவண்டி',
      category: 'Material Handling',
      description: 'Heavy steel hopper wheelbarrow for mortar loads',
      iconName: 'Truck',
      emoji: '🛒',
      imageUrl: TOOL_SVGS.wheelbarrow,
      imageAlt: 'Construction Wheelbarrow',
      colorTheme: { primary: '#ea580c', bg: '#ea580c15', border: '#ea580c50', accent: '#fb923c' },
    };
  }

  if (clean.includes('ladder') || clean.includes('scaffolding') || clean.includes('yeni')) {
    return {
      id: 'ladder',
      name: 'Ladder',
      tamilName: 'ஏணி / சாரம்',
      category: 'Scaffolding & Access',
      description: 'Heavy-duty aluminium extension ladder and staging',
      iconName: 'AlignJustify',
      emoji: '🪜',
      imageUrl: TOOL_SVGS.ladder,
      imageAlt: 'Aluminium Ladder',
      colorTheme: { primary: '#64748b', bg: '#64748b15', border: '#64748b50', accent: '#94a3b8' },
    };
  }

  if (clean.includes('drill') || clean.includes('rotary')) {
    return {
      id: 'drill',
      name: 'Drill Machine',
      tamilName: 'துளையிடும் இயந்திரம்',
      category: 'Power Tools',
      description: 'Heavy SDS hammer drill for masonry core drilling',
      iconName: 'Zap',
      emoji: '🔩',
      imageUrl: TOOL_SVGS.drillMachine,
      imageAlt: 'Drill Machine',
      colorTheme: { primary: '#0284c7', bg: '#0284c715', border: '#0284c750', accent: '#38bdf8' },
    };
  }

  if (clean.includes('grinder') || clean.includes('cutter') || clean.includes('cutting machine')) {
    return {
      id: 'grinder',
      name: 'Grinder',
      tamilName: 'கட்டிங் மெஷின்',
      category: 'Power Tools',
      description: 'High power angle grinder with abrasive blade',
      iconName: 'Disc',
      emoji: '⚡',
      imageUrl: TOOL_SVGS.grinder,
      imageAlt: 'Angle Grinder Cutter',
      colorTheme: { primary: '#16a34a', bg: '#16a34a15', border: '#16a34a50', accent: '#4ade80' },
    };
  }

  if (clean.includes('mixer') || clean.includes('concrete machine')) {
    return {
      id: 'concrete-mixer',
      name: 'Concrete Mixer',
      tamilName: 'கலவை இயந்திரம்',
      category: 'Machinery',
      description: '10/7 CFT rotating drum site mixer machine',
      iconName: 'RefreshCw',
      emoji: '🔄',
      imageUrl: TOOL_SVGS.concreteMixer,
      imageAlt: 'Concrete Mixer Machine',
      colorTheme: { primary: '#e11d48', bg: '#e11d4815', border: '#e11d4850', accent: '#fb7185' },
    };
  }

  if (clean.includes('tool box') || clean.includes('toolbox') || clean.includes('box')) {
    return {
      id: 'toolbox',
      name: 'Tool Box',
      tamilName: 'டூல் பாக்ஸ்',
      category: 'Storage',
      description: 'Industrial heavy duty metal cantilever site toolbox',
      iconName: 'Briefcase',
      emoji: '🧰',
      imageUrl: TOOL_SVGS.toolBox,
      imageAlt: 'Site Tool Box',
      colorTheme: { primary: '#dc2626', bg: '#dc262615', border: '#dc262650', accent: '#f87171' },
    };
  }

  if (clean.includes('saw') || clean.includes('carpentry saw') || clean.includes('vaal')) {
    return {
      id: 'saw',
      name: 'Saw',
      tamilName: 'மரம் அறுக்கும் வாள்',
      category: 'Carpentry',
      description: 'Hand saw for centering, plywood & timber formwork',
      iconName: 'Scissors',
      emoji: '🪚',
      imageUrl: TOOL_SVGS.saw,
      imageAlt: 'Carpentry Hand Saw',
      colorTheme: { primary: '#d97706', bg: '#d9770615', border: '#d9770650', accent: '#fbbf24' },
    };
  }

  // Never return Hammer for custom/unknown tools: Return generic machinery equipment!
  return {
    id: 'generic-tool',
    name: toolName || 'Equipment & Machinery',
    tamilName: 'தள உபகரணம்',
    category: 'Equipment',
    description: 'Site equipment and heavy construction machinery',
    iconName: 'Wrench',
    emoji: '⚙️',
    imageUrl: TOOL_SVGS.customTool,
    imageAlt: toolName || 'Custom Construction Tool',
    colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
  };
}

export function getMaterialVisual(category: string, brand?: string, customImageUrl?: string): VisualItemMeta {
  if (customImageUrl) {
    return {
      id: category,
      name: brand || category,
      tamilName: 'கட்டுமான பொருள்',
      category: 'Materials',
      description: 'Site civil material inventory',
      iconName: 'Package',
      emoji: '📦',
      imageUrl: customImageUrl,
      imageAlt: brand || category,
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  const cat = (category || '').toLowerCase();

  if (cat === 'sand') {
    return {
      id: 'sand',
      name: 'Sand',
      tamilName: 'மணல்',
      category: 'Aggregates',
      description: 'Plastering & masonry river sand',
      iconName: 'Hourglass',
      emoji: '🏖️',
      imageUrl: MATERIAL_SVGS.sand,
      imageAlt: 'River Sand',
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  if (cat === 'msand') {
    return {
      id: 'msand',
      name: 'M-Sand',
      tamilName: 'எம்-சாண்ட்',
      category: 'Aggregates',
      description: 'Manufactured sand for RCC concrete and mortar',
      iconName: 'Mountain',
      emoji: '⛰️',
      imageUrl: MATERIAL_SVGS.msand,
      imageAlt: 'Manufactured Sand',
      colorTheme: { primary: '#64748b', bg: '#64748b15', border: '#64748b50', accent: '#94a3b8' },
    };
  }

  if (cat === 'cement') {
    return {
      id: 'cement',
      name: brand ? `Cement (${brand})` : 'Cement',
      tamilName: 'சிமெண்ட்',
      category: 'Binders',
      description: 'OPC / PPC 53/43 grade 50kg cement bag',
      iconName: 'Box',
      emoji: '🏛️',
      imageUrl: MATERIAL_SVGS.cement,
      imageAlt: brand || 'Cement 50kg Sack',
      colorTheme: { primary: '#ef4444', bg: '#ef444415', border: '#ef444450', accent: '#f87171' },
    };
  }

  if (cat === 'bricks') {
    return {
      id: 'bricks',
      name: 'Bricks',
      tamilName: 'செங்கல்',
      category: 'Masonry',
      description: 'Red wire-cut kiln chamber clay bricks',
      iconName: 'Layers',
      emoji: '🧱',
      imageUrl: MATERIAL_SVGS.bricks,
      imageAlt: 'Chamber Red Clay Bricks',
      colorTheme: { primary: '#ea580c', bg: '#ea580c15', border: '#ea580c50', accent: '#fb923c' },
    };
  }

  if (cat === 'aggregate') {
    return {
      id: 'aggregate',
      name: 'Aggregate',
      tamilName: 'ஜல்லி',
      category: 'Aggregates',
      description: '20mm blue metals crushed granite stone',
      iconName: 'Grid',
      emoji: '🪨',
      imageUrl: MATERIAL_SVGS.aggregate,
      imageAlt: '20mm Blue Metal Aggregates',
      colorTheme: { primary: '#64748b', bg: '#64748b15', border: '#64748b50', accent: '#94a3b8' },
    };
  }

  if (cat === 'rod') {
    return {
      id: 'rod',
      name: 'Rod / Steel',
      tamilName: 'கம்பி',
      category: 'Reinforcement',
      description: 'High tensile TMT reinforcement steel',
      iconName: 'Hash',
      emoji: '🏗️',
      imageUrl: generateRodSvg('12 mm', '#3b82f6'),
      imageAlt: 'TMT Reinforcement Steel Rod',
      colorTheme: { primary: '#3b82f6', bg: '#3b82f615', border: '#3b82f650', accent: '#60a5fa' },
    };
  }

  return {
    id: 'other',
    name: 'Other Materials',
    tamilName: 'இதர பொருட்கள்',
    category: 'Supplies',
    description: 'General construction and waterproofing supplies',
    iconName: 'Package',
    emoji: '📦',
    imageUrl: MATERIAL_SVGS.otherMaterials,
    imageAlt: 'Other Civil Materials',
    colorTheme: { primary: '#8b5cf6', bg: '#8b5cf615', border: '#8b5cf650', accent: '#a78bfa' },
  };
}

export function getRodVisual(diameter: string, customImageUrl?: string): VisualItemMeta {
  if (customImageUrl) {
    return {
      id: diameter,
      name: `Rod ${diameter}`,
      tamilName: `${diameter} கம்பி`,
      category: 'TMT Steel',
      description: `Steel Rebar (${diameter})`,
      iconName: 'Hash',
      emoji: '🏗️',
      imageUrl: customImageUrl,
      imageAlt: `TMT Steel ${diameter}`,
      colorTheme: { primary: '#3b82f6', bg: '#3b82f615', border: '#3b82f650', accent: '#60a5fa' },
    };
  }

  const clean = diameter.replace(/\s+/g, '').toLowerCase();
  let highlight = '#3b82f6';
  let desc = 'Structural beam & column rebar';

  if (clean.includes('6mm')) {
    highlight = '#06b6d4';
    desc = 'Binding wire & light stirrup rings';
  } else if (clean.includes('8mm')) {
    highlight = '#10b981';
    desc = 'Column ties, stirrups & slab distribution';
  } else if (clean.includes('10mm')) {
    highlight = '#f59e0b';
    desc = 'Slab main reinforcement & lintels';
  } else if (clean.includes('12mm')) {
    highlight = '#3b82f6';
    desc = 'Main column & primary beam rebar';
  } else if (clean.includes('16mm')) {
    highlight = '#8b5cf6';
    desc = 'Heavy load columns & plinth beams';
  } else if (clean.includes('20mm')) {
    highlight = '#ec4899';
    desc = 'Raft foundation & multi-story columns';
  } else if (clean.includes('25mm')) {
    highlight = '#ef4444';
    desc = 'Heavy civil structural transfer girders';
  }

  return {
    id: diameter,
    name: `${diameter} TMT Rod`,
    tamilName: `${diameter} கம்பி`,
    category: 'Steel Rebar',
    description: desc,
    iconName: 'Hash',
    emoji: '🏗️',
    imageUrl: generateRodSvg(diameter, highlight),
    imageAlt: `TMT Steel Rod ${diameter}`,
    badge: diameter,
    colorTheme: { primary: highlight, bg: `${highlight}15`, border: `${highlight}50`, accent: highlight },
  };
}

export function getWorkerVisual(category: string, customImageUrl?: string): VisualItemMeta {
  if (customImageUrl) {
    return {
      id: category,
      name: category,
      tamilName: 'பணியாளர்',
      category: 'Labour',
      description: 'Site worker profile',
      iconName: 'User',
      emoji: '👷',
      imageUrl: customImageUrl,
      imageAlt: category,
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  const cat = (category || '').toUpperCase();

  if (cat.includes('MISTRY') || cat.includes('LEAD') || cat.includes('HEAD')) {
    return {
      id: 'mistry',
      name: 'Mistry',
      tamilName: 'மேஸ்திரி',
      category: 'Lead Builder',
      description: 'Master builder, layout planner & site leader',
      iconName: 'Crown',
      emoji: '👷‍♂️',
      imageUrl: WORKER_SVGS.mistry,
      imageAlt: 'Chief Mistry',
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  if (cat.includes('PERIYAAL') || cat.includes('MASON')) {
    return {
      id: 'periyaal',
      name: 'Periyaal',
      tamilName: 'பெரியாள்',
      category: 'Mason',
      description: 'Skilled bricklayer, plasterer & stonemason',
      iconName: 'Hammer',
      emoji: '🔨',
      imageUrl: WORKER_SVGS.periyaal,
      imageAlt: 'Periyaal Mason',
      colorTheme: { primary: '#3b82f6', bg: '#3b82f615', border: '#3b82f650', accent: '#60a5fa' },
    };
  }

  if (cat.includes('SITHAAL') || cat.includes('HELPER')) {
    return {
      id: 'sithaal',
      name: 'Sithaal',
      tamilName: 'சித்தாள்',
      category: 'Site Helper',
      description: 'Mortar mixing, bricks transfer & material assistant',
      iconName: 'Users',
      emoji: '🧤',
      imageUrl: WORKER_SVGS.sithaal,
      imageAlt: 'Sithaal Helper',
      colorTheme: { primary: '#10b981', bg: '#10b98115', border: '#10b98150', accent: '#34d399' },
    };
  }

  return {
    id: 'artisan',
    name: category || 'Worker',
    tamilName: 'பணியாளர்',
    category: 'Craftsman',
    description: 'Skilled civil construction artisan',
    iconName: 'UserCheck',
    emoji: '👷',
    imageUrl: WORKER_SVGS.genericWorker,
    imageAlt: category,
    colorTheme: { primary: '#64748b', bg: '#64748b15', border: '#64748b50', accent: '#94a3b8' },
  };
}

export function getExpenseVisual(
  type: 'tea' | 'snacks' | 'juice' | 'food' | 'pooja' | 'electricity' | 'water' | 'other',
  customImageUrl?: string
): VisualItemMeta {
  if (customImageUrl) {
    return {
      id: type,
      name: type.toUpperCase(),
      tamilName: 'செலவு',
      category: 'Daily Expense',
      description: 'Site daily expense record',
      iconName: 'Receipt',
      emoji: '💳',
      imageUrl: customImageUrl,
      imageAlt: type,
      colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
    };
  }

  switch (type) {
    case 'tea':
      return {
        id: 'tea',
        name: 'Tea',
        tamilName: 'டீ (தேநீர்)',
        category: 'Refreshments',
        description: 'Morning & evening tea rounds for workforce',
        iconName: 'Coffee',
        emoji: '☕',
        imageUrl: EXPENSE_SVGS.tea,
        imageAlt: 'Hot Tea',
        colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
      };
    case 'snacks':
      return {
        id: 'snacks',
        name: 'Snacks',
        tamilName: 'ஸ்நாக்ஸ்',
        category: 'Refreshments',
        description: 'Biscuits, vada, sundal & evening refreshments',
        iconName: 'Cookie',
        emoji: '🍪',
        imageUrl: EXPENSE_SVGS.snacks,
        imageAlt: 'Site Snacks',
        colorTheme: { primary: '#ea580c', bg: '#ea580c15', border: '#ea580c50', accent: '#fb923c' },
      };
    case 'juice':
      return {
        id: 'juice',
        name: 'Fresh Juice',
        tamilName: 'ஜூஸ்',
        category: 'Refreshments',
        description: 'Lemon, sugarcane juice & summer cool drinks',
        iconName: 'GlassWater',
        emoji: '🧃',
        imageUrl: EXPENSE_SVGS.juice,
        imageAlt: 'Fresh Juice',
        colorTheme: { primary: '#84cc16', bg: '#84cc1615', border: '#84cc1650', accent: '#a3e635' },
      };
    case 'food':
      return {
        id: 'food',
        name: 'Food & Meals',
        tamilName: 'சாப்பாடு',
        category: 'Refreshments',
        description: 'Lunch, dinner & food parcels for concreting crew',
        iconName: 'Utensils',
        emoji: '🍱',
        imageUrl: EXPENSE_SVGS.food,
        imageAlt: 'Site Food',
        colorTheme: { primary: '#10b981', bg: '#10b98115', border: '#10b98150', accent: '#34d399' },
      };
    case 'pooja':
      return {
        id: 'pooja',
        name: 'Bhoomi Pooja',
        tamilName: 'பூஜை',
        category: 'Ceremony',
        description: 'Bhoomi pooja, foundation & roof slab ceremony expenses',
        iconName: 'Sparkles',
        emoji: '🪔',
        imageUrl: EXPENSE_SVGS.pooja,
        imageAlt: 'Bhoomi Pooja',
        colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
      };
    case 'electricity':
      return {
        id: 'electricity',
        name: 'Electricity (EB)',
        tamilName: 'மின்சாரம் (EB)',
        category: 'Utilities',
        description: 'TANGEDCO temporary power connection & bills',
        iconName: 'Zap',
        emoji: '⚡',
        imageUrl: EXPENSE_SVGS.electricity,
        imageAlt: 'Electricity Bill',
        colorTheme: { primary: '#eab308', bg: '#eab30815', border: '#eab30850', accent: '#fde047' },
      };
    case 'water':
      return {
        id: 'water',
        name: 'Water Supply',
        tamilName: 'தண்ணீர் டேங்கர்',
        category: 'Utilities',
        description: 'Tanker water loads for curing & brickwork',
        iconName: 'Droplets',
        emoji: '💧',
        imageUrl: EXPENSE_SVGS.water,
        imageAlt: 'Water Tanker Supply',
        colorTheme: { primary: '#0284c7', bg: '#0284c715', border: '#0284c750', accent: '#38bdf8' },
      };
    default:
      return {
        id: 'other',
        name: 'Other Expense',
        tamilName: 'இதர செலவு',
        category: 'Site Expenses',
        description: 'Miscellaneous site operations & logistics',
        iconName: 'Receipt',
        emoji: '📄',
        imageUrl: EXPENSE_SVGS.food,
        imageAlt: 'Site Expense',
        colorTheme: { primary: '#64748b', bg: '#64748b15', border: '#64748b50', accent: '#94a3b8' },
      };
  }
}

export function getSiteVisual(site: { name: string; buildingType?: string; imageUrl?: string }): VisualItemMeta {
  return {
    id: site.name,
    name: site.name,
    tamilName: 'கட்டுமான தளம்',
    category: site.buildingType || 'Residential Project',
    description: 'Active construction building site',
    iconName: 'Building2',
    emoji: '🏗️',
    imageUrl: site.imageUrl || SITE_ILLUSTRATION_SVG,
    imageAlt: site.name,
    colorTheme: { primary: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b50', accent: '#fbbf24' },
  };
}export const SITE_VISUAL = SITE_ILLUSTRATION_SVG;
