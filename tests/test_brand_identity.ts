/**
 * App name and logo (task sheet, Task 2): one name in src/config/brand.ts used by every config
 * file and screen, the orange + charcoal logo in every icon, and the one-time cleanup of
 * plain-text passwords older versions left on the device.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, APP_TAGLINE, BRAND_COLORS, logoSvg } from '../src/config/brand';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(root, p));
/** Width and height from a PNG header. */
function pngSize(p: string): [number, number] {
  const b = fs.readFileSync(path.join(root, p));
  if (b.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${p} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

console.log('\n--- 1. One central name ---');
check('brand.ts defines the name, short name, tagline and description', [APP_NAME, APP_SHORT_NAME, APP_TAGLINE, APP_DESCRIPTION].every(v => typeof v === 'string' && v.trim().length > 0));
check('Short name fits under a phone icon (≤ 12 letters)', APP_SHORT_NAME.length <= 12, APP_SHORT_NAME);
check('Final palette: orange #F97316, charcoal #1F2937, background #FAFAF9, cards #FFFFFF',
  BRAND_COLORS.primary === '#F97316' && BRAND_COLORS.dark === '#1F2937' && BRAND_COLORS.background === '#FAFAF9' && BRAND_COLORS.card === '#FFFFFF');

const manifest = JSON.parse(read('public/manifest.json'));
check('manifest.json name / short_name / description come from brand.ts',
  manifest.name === APP_NAME && manifest.short_name === APP_SHORT_NAME && manifest.description === APP_DESCRIPTION, [manifest.name, manifest.short_name]);
check('manifest.json theme #F97316 and background #FAFAF9', manifest.theme_color === '#F97316' && manifest.background_color === '#FAFAF9');

const html = read('index.html');
const vite = read('vite.config.ts');
const tokens = [...new Set(html.match(/%[A-Z_]+%/g) ?? [])];
check('index.html takes title, meta names and theme colour from brand.ts',
  html.includes('<title>%APP_NAME% — %APP_TAGLINE%</title>') && html.includes('content="%APP_NAME%"') && html.includes('content="%APP_SHORT_NAME%"') &&
  html.includes('name="theme-color" content="%BRAND_PRIMARY%"'));
check('Every %TOKEN% in index.html is filled in by the Vite brand plugin', tokens.length > 0 && tokens.every(t => vite.includes(`'${t}'`)), tokens);
check('The loading screen shows the logo and name on the app background',
  html.includes('<span class="boot-logo">%APP_LOGO_SVG%</span>') && html.includes('%APP_NAME%</span>') && html.includes('background: %BRAND_BACKGROUND%'));

const cap = read('capacitor.config.ts');
check('capacitor.config.ts uses APP_NAME', /import \{ APP_NAME \} from '\.\/src\/config\/brand'/.test(cap) && cap.includes('appName: APP_NAME'));
const strings = read('android/app/src/main/res/values/strings.xml');
check('Android strings.xml app_name and title_activity_main match',
  strings.includes(`<string name="app_name">${APP_NAME}</string>`) && strings.includes(`<string name="title_activity_main">${APP_NAME}</string>`));
check('404 redirect page uses the name', read('public/404.html').includes(`<title>${APP_NAME} - Redirecting...</title>`));
const pkg = JSON.parse(read('package.json'));
check('npm run build syncs the name first (prebuild → brand:sync)', pkg.scripts.prebuild === 'npm run brand:sync' && pkg.scripts['brand:sync'].includes('scripts/sync-brand.ts'));

console.log('\n--- 2. No old name on screens, PDFs or messages ---');
const allowed = (file: string, line: string) =>
  /appName: 'Building Mistry'|backup\.appName !== 'Building Mistry'/.test(line) || file.startsWith(path.join('src', 'floorPlanner'));
const oldName: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name)) {
      read(p).split(/\r?\n/).forEach((line, i) => {
        const t = line.trim();
        if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return; // comments
        if (/Building Mistry|BUILDING MISTRY|Mistry ERP|BuildingMistry_/.test(line) && !allowed(p, line)) oldName.push(`${p}:${i + 1}`);
      });
    }
  }
};
walk('src');
check('No "Building Mistry" / "Mistry ERP" text left in the app (backup file marker and Floor Planner excepted)', oldName.length === 0, oldName);
for (const [file, mustUse] of [
  ['src/components/TopNav.tsx', 'BrandMark'], ['src/components/AppSidebar.tsx', 'BrandMark'],
  ['src/views/LoginView.tsx', 'BrandMark'], ['src/views/SettingsView.tsx', 'BrandLogo'],
] as const) {
  const src = read(file);
  check(`${file} shows the logo and the name from brand.ts`, src.includes(`<${mustUse}`) && (mustUse === 'BrandLogo' || src.includes('APP_NAME')));
}
check('PDF headers and share messages use APP_NAME',
  read('src/utils/pdfGenerator.ts').includes('${APP_NAME.toUpperCase()} - CONSTRUCTION ESTIMATE REPORT') &&
  read('src/domain/buildingCalculator/multiTierEstimator.ts').includes('${APP_NAME.toUpperCase()} — TURNKEY CONSTRUCTION ESTIMATE') &&
  read('src/components/attendance/AttendanceMatrix.tsx').includes('${APP_NAME.toUpperCase()} — WAGE PAYSLIP'));
check('Backups keep their file-format marker, so older backup files still restore',
  read('src/db/backup.ts').includes("appName: 'Building Mistry'") && read('src/services/storage.ts').includes("appName: 'Building Mistry'"));

console.log('\n--- 3. Logo and icons ---');
const svg = logoSvg();
check('The logo is orange + charcoal (+ light letter)', svg.includes('#F97316') && svg.includes('#1F2937') && svg.includes('#FAFAF9'));
check('favicon.svg and icons/icon.svg are the brand logo', read('public/favicon.svg').trim() === logoSvg({ size: 64 }) && read('public/icons/icon.svg').trim() === logoSvg({ size: 512 }));
check('No leftover Vite / old purple or gold icon colours', !/#863bff|#7e14ff|#fbbf24|#f59e0b/i.test(read('public/favicon.svg') + read('public/icons/icon.svg')));
for (const icon of manifest.icons as Array<{ src: string; sizes: string; type: string }>) {
  const p = path.join('public', icon.src.replace(/^\.\//, ''));
  check(`Manifest icon ${icon.src} exists${icon.type === 'image/png' ? ` at ${icon.sizes}` : ''}`,
    exists(p) && (icon.type !== 'image/png' || pngSize(p).join('x') === icon.sizes), exists(p) && icon.type === 'image/png' ? pngSize(p) : p);
}
check('index.html links the favicon, manifest and touch icon that exist',
  ['./favicon.svg', './manifest.json', './icons/icon-192.png'].every(h => html.includes(`href="${h}"`) && exists(path.join('public', h.slice(2)))));

const res = 'android/app/src/main/res';
const densities: Record<string, number> = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const wrong: string[] = [];
for (const [d, k] of Object.entries(densities)) {
  for (const [name, base] of [['ic_launcher', 48], ['ic_launcher_round', 48], ['ic_launcher_foreground', 108]] as const) {
    const p = `${res}/mipmap-${d}/${name}.png`;
    const n = Math.round(base * k);
    if (!exists(p) || pngSize(p).join('x') !== `${n}x${n}`) wrong.push(p);
  }
}
check('Android launcher icons (square, round, adaptive foreground) at every density', wrong.length === 0, wrong);
const splashes = ['drawable', ...['land', 'port'].flatMap(o => Object.keys(densities).map(d => `drawable-${o}-${d}`))].map(d => `${res}/${d}/splash.png`);
check('Android splash screens at every density', splashes.every(exists), splashes.filter(p => !exists(p)));
check('Adaptive icon background is charcoal', read(`${res}/values/ic_launcher_background.xml`).includes(`>${BRAND_COLORS.dark}<`) &&
  read(`${res}/drawable/ic_launcher_background.xml`).includes(BRAND_COLORS.dark));
check('Adaptive icon vector foreground is the brand mark', read(`${res}/drawable-v24/ic_launcher_foreground.xml`).includes(BRAND_COLORS.primary));
check('Service worker cache version bumped so phones fetch the new icons', /CACHE_NAME = 'building-mistry-v6'/.test(read('public/sw.js')));

console.log('\n--- 4. Old plain-text passwords on the device are blanked ---');
const { db } = await import('../src/db/db');
const { clearLegacyLocalPasswords, LEGACY_PASSWORD_CLEANUP_FLAG } = await import('../src/db/legacyPasswordCleanup');
const base = { mobile: '', role: 'MISTRY', permissions: {}, isActive: true, createdAt: '2025-01-01', updatedAt: '2025-01-01' };
await db.users.bulkPut([
  { ...base, id: 'u-old', username: 'old', fullName: 'Old Local', email: 'old@example.test', passwordHash: 'plain-secret-1' },
  { ...base, id: 'u-field', username: 'field', fullName: 'Password Field', email: 'f@example.test', passwordHash: '', password: 'plain-secret-2' } as never,
  { ...base, id: 'u-clean', username: 'clean', fullName: 'Already Clean', email: 'c@example.test', passwordHash: '' },
] as never);
const mem = new Map<string, string>();
const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
const cleaned = await clearLegacyLocalPasswords(db, storage);
const after = await db.users.toArray();
check('Both records holding a password were cleaned, the clean one untouched', cleaned === 2, cleaned);
check('No user record keeps a password', after.every(u => u.passwordHash === '' && ((u as { password?: string }).password ?? '') === ''));
check('No profile was deleted and names / emails / roles are unchanged', after.length === 3 &&
  after.find(u => u.id === 'u-old')?.fullName === 'Old Local' && after.find(u => u.id === 'u-field')?.email === 'f@example.test' && after.every(u => u.role === 'MISTRY'));
check('It runs once per device (flag set; a second run does nothing)', mem.get(LEGACY_PASSWORD_CLEANUP_FLAG) === 'done' && (await clearLegacyLocalPasswords(db, storage)) === 0);
check('Start-up runs the cleanup before sign-in', /initDefaultUser\(\): Promise<void> \{[\s\S]{0,200}clearLegacyLocalPasswords\(\)/.test(read('src/services/auth.ts')));

console.log(`\n✅ Brand identity: all ${passed} checks passed.\n`);
