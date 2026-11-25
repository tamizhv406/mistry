import { APP_NAME, APP_TAGLINE, BRAND_COLORS, LOGO_MARK } from '../config/brand';

interface BrandLogoProps {
  /** Size of the square mark in px. */
  size?: number;
  /** Show the app name next to (or under) the mark. */
  showName?: boolean;
  /** Show the tagline under the name. */
  showTagline?: boolean;
  /** Name under the mark instead of beside it. */
  stacked?: boolean;
  /** Colour of the name text (default charcoal; use a light colour on dark headers). */
  nameColor?: string;
  className?: string;
}

/** The app's logo mark (orange roof, light "M", charcoal tile). An empty title hides it from screen readers. */
export function BrandMark({ size = 32, title = APP_NAME }: { size?: number; title?: string }) {
  const m = LOGO_MARK;
  return (
    <svg
      viewBox={`0 0 ${m.viewBox} ${m.viewBox}`}
      width={size}
      height={size}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width={m.viewBox} height={m.viewBox} rx={m.tileRadius} fill={BRAND_COLORS.dark} />
      <polyline points={m.roof.points} fill="none" stroke={BRAND_COLORS.primary} strokeWidth={m.roof.width} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={m.letter.points} fill="none" stroke={m.letter.color} strokeWidth={m.letter.width} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BrandLogo({
  size = 32,
  showName = true,
  showTagline = false,
  stacked = false,
  nameColor = BRAND_COLORS.dark,
  className,
}: BrandLogoProps) {
  return (
    <span
      className={['brand-logo', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: 'center',
        gap: stacked ? Math.round(size * 0.22) : Math.round(size * 0.3),
        minWidth: 0,
      }}
    >
      <BrandMark size={size} title={showName ? '' : APP_NAME} />
      {showName && (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: stacked ? 'center' : 'flex-start', minWidth: 0, lineHeight: 1.15 }}>
          <span className="brand-logo-name" style={{ fontWeight: 800, letterSpacing: '-0.01em', color: nameColor, whiteSpace: 'nowrap' }}>
            {APP_NAME}
          </span>
          {showTagline && (
            <span className="brand-logo-tagline" style={{ fontWeight: 500, color: '#6B7280', fontSize: '0.8em' }}>
              {APP_TAGLINE}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
