/**
 * The app's name, tagline, colours and logo shape, in one place.
 *
 * The final brand name is not decided yet. To rename the app, change APP_NAME below and run
 * `npm run build` (it runs `npm run brand:sync` first). That updates the web page title,
 * the install manifest, the Android app name and every screen, PDF and share message.
 *
 * Android's package id (com.buildingmistry.app) and the on-device database name are left as
 * they are on purpose: changing either would make phones treat it as a different app and
 * lose the saved records.
 */

/** Placeholder name until the owner picks the final brand. */
export const APP_NAME = 'SiteMistry';
/** Under app icons on the phone home screen (keep it to about 12 letters). */
export const APP_SHORT_NAME = APP_NAME;
export const APP_TAGLINE = 'Plan better. Build smarter.';
export const APP_DESCRIPTION =
  `${APP_NAME}: sites, materials, labour, tools, floor plans and estimates for building contractors.`;

export const BRAND_COLORS = {
  /** Brand accent: logo highlight, active states. */
  primary: '#F97316',
  /** Logo base, headers. */
  dark: '#1F2937',
  /** Page background. */
  background: '#FAFAF9',
  /** Cards. */
  card: '#FFFFFF',
} as const;

/**
 * The logo mark on a 64 × 64 grid: an orange roof over a light "M" on a charcoal tile.
 * Thick strokes and round joins so it stays sharp from a 16px favicon up to a 512px icon.
 * The React logo, the SVG files and the PNG icons are all drawn from these numbers.
 */
export const LOGO_MARK = {
  viewBox: 64,
  tileRadius: 14,
  roof: { points: '14,30 32,14 50,30', width: 6 },
  letter: { points: '20,50 20,35 32,44 44,35 44,50', width: 5.5, color: BRAND_COLORS.background },
} as const;

/** The roof and the "M" as SVG elements (no tile). */
export function logoMarkSvgElements(): string {
  const m = LOGO_MARK;
  return [
    `<polyline points="${m.roof.points}" fill="none" stroke="${BRAND_COLORS.primary}" stroke-width="${m.roof.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<polyline points="${m.letter.points}" fill="none" stroke="${m.letter.color}" stroke-width="${m.letter.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ].join('');
}

/**
 * The logo as an SVG document.
 * - shape 'tile': rounded charcoal square (favicon, app icons, splash).
 * - shape 'square' / 'circle': full-bleed charcoal background with the mark scaled by `markScale`
 *   (maskable and round icons, which the phone crops).
 * - shape 'none': the mark alone on a transparent background (Android adaptive foreground).
 */
export function logoSvg(opts: { size?: number; shape?: 'tile' | 'square' | 'circle' | 'none'; markScale?: number; title?: string } = {}): string {
  const { size = 64, shape = 'tile', markScale = 1, title = APP_NAME } = opts;
  const m = LOGO_MARK;
  const c = m.viewBox / 2;
  const bg =
    shape === 'tile' ? `<rect width="${m.viewBox}" height="${m.viewBox}" rx="${m.tileRadius}" fill="${BRAND_COLORS.dark}"/>`
    : shape === 'square' ? `<rect width="${m.viewBox}" height="${m.viewBox}" fill="${BRAND_COLORS.dark}"/>`
    : shape === 'circle' ? `<circle cx="${c}" cy="${c}" r="${c}" fill="${BRAND_COLORS.dark}"/>`
    : '';
  const mark = markScale === 1
    ? logoMarkSvgElements()
    : `<g transform="translate(${c} ${c}) scale(${markScale}) translate(${-c} ${-c})">${logoMarkSvgElements()}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.viewBox} ${m.viewBox}" width="${size}" height="${size}" role="img" aria-label="${title}"><title>${title}</title>${bg}${mark}</svg>`;
}
