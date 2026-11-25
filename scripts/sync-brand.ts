/**
 * Copies the name, colours and logo from src/config/brand.ts into the files that cannot import
 * it: the install manifest, the SVG icons, the GitHub Pages redirect page and the Android
 * resources. Runs before every `npm run build`; run it by hand with `npm run brand:sync`.
 * (index.html gets the name from vite.config.ts; capacitor.config.ts imports brand.ts.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, APP_TAGLINE, BRAND_COLORS, logoSvg } from '../src/config/brand';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = (p: string) => path.join(root, p);
const changed: string[] = [];

function write(p: string, next: string) {
  const prev = fs.existsSync(file(p)) ? fs.readFileSync(file(p), 'utf8') : null;
  if (prev === next) return;
  fs.writeFileSync(file(p), next);
  changed.push(p);
}
const xmlEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'");

// 1. Install manifest (keeps every other field as it is).
const manifest = JSON.parse(fs.readFileSync(file('public/manifest.json'), 'utf8'));
Object.assign(manifest, {
  name: APP_NAME,
  short_name: APP_SHORT_NAME,
  description: APP_DESCRIPTION,
  theme_color: BRAND_COLORS.primary,
  background_color: BRAND_COLORS.background,
});
write('public/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// 2. SVG icons (favicon and the large app icon).
write('public/favicon.svg', logoSvg({ size: 64 }) + '\n');
write('public/icons/icon.svg', logoSvg({ size: 512 }) + '\n');

// 3. GitHub Pages redirect page.
const redirect = fs.readFileSync(file('public/404.html'), 'utf8')
  .replace(/<title>[^<]*<\/title>/, `<title>${APP_NAME} - Redirecting...</title>`)
  .replace(/<p>Loading [^<]*<\/p>/, `<p>Loading ${APP_NAME}...</p>`);
write('public/404.html', redirect);

// 4. Android app name and icon background.
const stringsPath = 'android/app/src/main/res/values/strings.xml';
if (fs.existsSync(file(stringsPath))) {
  const strings = fs.readFileSync(file(stringsPath), 'utf8')
    .replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${xmlEscape(APP_NAME)}$2`)
    .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${xmlEscape(APP_NAME)}$2`);
  write(stringsPath, strings);
  write('android/app/src/main/res/values/ic_launcher_background.xml',
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BRAND_COLORS.dark}</color>\n</resources>\n`);
}

console.log(changed.length
  ? `brand:sync (${APP_NAME}, "${APP_TAGLINE}") updated: ${changed.join(', ')}`
  : `brand:sync: everything already matches "${APP_NAME}".`);
