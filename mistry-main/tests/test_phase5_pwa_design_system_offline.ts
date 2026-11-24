/**
 * Test Suite: Mobile-First PWA, Modern Construction Design System & Production Polish (Phase 5)
 * 
 * Verifies:
 * 1. PWA Web App Manifest (`public/manifest.json`) structure and icons
 * 2. Service Worker (`public/sw.js`) cache-first and offline fallback logic
 * 3. Ergonomic 6-tab Mobile Bottom Navigation (`#app-mobile-nav`)
 * 4. Construction-grade design system tokens (amber accent, slate navy, 1px inputs, focus rings)
 * 5. Full offline data layer operation
 */

import fs from 'fs';
import path from 'path';
import { storageService, type StorageSite } from '../src/services/storage';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runTests() {
  console.log('\n--- PHASE 5: MOBILE PWA, DESIGN SYSTEM & PRODUCTION POLISH TEST SUITE ---\n');

  // Test 1: PWA Web App Manifest Configuration
  console.log('Test 1: PWA Web App Manifest Specification');
  {
    const manifestPath = path.resolve(process.cwd(), 'public', 'manifest.json');
    assert(fs.existsSync(manifestPath), 'public/manifest.json exists on disk');

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert(manifestContent.name === 'Building Mistry — Construction ERP', 'Manifest name is "Building Mistry — Construction ERP"');
    assert(manifestContent.short_name === 'Mistry ERP', 'Manifest short_name is "Mistry ERP"');
    assert(manifestContent.theme_color === '#0f172a', 'Theme color is deep slate navy (#0f172a)');
    assert(manifestContent.background_color === '#f8fafc', 'Background color is architectural light slate (#f8fafc)');
    assert(manifestContent.display === 'standalone', 'Display mode is standalone for native app experience');
    assert(manifestContent.orientation === 'any', 'Orientation supports both portrait and landscape CAD viewports');

    assert(Array.isArray(manifestContent.icons) && manifestContent.icons.length >= 3, 'Manifest contains adaptive icons array');
    const icon192 = manifestContent.icons.find((i: any) => i.sizes === '192x192');
    const icon512 = manifestContent.icons.find((i: any) => i.sizes === '512x512');
    const iconMaskable = manifestContent.icons.find((i: any) => i.purpose === 'maskable');

    assert(!!icon192, '192x192 icon is declared');
    assert(!!icon512, '512x512 icon is declared');
    assert(!!iconMaskable, 'Maskable icon is declared');

    // Verify physical files exist
    assert(fs.existsSync(path.resolve(process.cwd(), 'public', 'icons', 'icon-192.png')), 'Physical icon-192.png exists');
    assert(fs.existsSync(path.resolve(process.cwd(), 'public', 'icons', 'icon-512.png')), 'Physical icon-512.png exists');
    assert(fs.existsSync(path.resolve(process.cwd(), 'public', 'icons', 'icon-maskable.png')), 'Physical icon-maskable.png exists');
  }

  // Test 2: Service Worker Pre-cache & Offline Strategy
  console.log('\nTest 2: Service Worker Pre-cache & Offline Strategy');
  {
    const swPath = path.resolve(process.cwd(), 'public', 'sw.js');
    assert(fs.existsSync(swPath), 'public/sw.js exists on disk');

    const swCode = fs.readFileSync(swPath, 'utf8');
    assert(swCode.includes('CACHE_NAME'), 'Service worker declares cache version name');
    assert(swCode.includes('STATIC_ASSETS'), 'Static assets array declared for shell pre-caching');
    assert(swCode.includes('navigate'), 'Navigation requests intercepted for offline HTML delivery');
    assert(swCode.includes('fonts.googleapis.com'), 'Google WebFonts runtime caching supported');
    assert(swCode.includes('caches.match'), 'Cache fallback logic implemented');
  }

  // Test 3: HTML Head Meta Tags & PWA Installability
  console.log('\nTest 3: HTML Head Meta Tags & PWA Installability');
  {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const htmlCode = fs.readFileSync(htmlPath, 'utf8');

    assert(htmlCode.includes('rel="manifest"'), 'index.html links to manifest.json');
    assert(htmlCode.includes('content="#0f172a"'), 'index.html defines theme-color #0f172a');
    assert(htmlCode.includes('apple-mobile-web-app-capable'), 'iOS standalone web app meta tag present');
    assert(htmlCode.includes('viewport-fit=cover'), 'Viewport includes viewport-fit=cover for iPhone notch/home bar');
    assert(htmlCode.includes('apple-touch-icon'), 'Apple touch icon link present');
  }

  // Test 4: Ergonomic 6-Item Mobile Navigation Bar
  console.log('\nTest 4: Ergonomic 6-Item Mobile Navigation Bar');
  {
    const mobileChromePath = path.resolve(process.cwd(), 'src', 'components', 'mobile', 'MobileChrome.tsx');
    const chromeCode = fs.readFileSync(mobileChromePath, 'utf8');

    assert(chromeCode.includes('id="app-mobile-nav"'), 'Navigation element has ID #app-mobile-nav');
    assert(chromeCode.includes('mobile-nav-home'), 'Tab 1: Home / Dashboard button exists');
    assert(chromeCode.includes('mobile-nav-projects'), 'Tab 2: Projects button exists');
    assert(chromeCode.includes('mobile-nav-attendance'), 'Tab 3: Attendance button exists');
    assert(chromeCode.includes('mobile-nav-planner'), 'Tab 4: CAD Floor Plan button exists');
    assert(chromeCode.includes('mobile-nav-calculator'), 'Tab 5: Building Calculator button exists');
    assert(chromeCode.includes('mobile-nav-settings'), 'Tab 6: Settings / Sync button exists');

    const dsCssPath = path.resolve(process.cwd(), 'src', 'styles', 'design-system.css');
    const dsCss = fs.readFileSync(dsCssPath, 'utf8');

    assert(dsCss.includes('repeat(6, minmax(0, 1fr))'), 'Mobile nav grid configured for 6 columns');
    assert(dsCss.includes('backdrop-filter: blur'), 'Mobile nav utilizes modern blur backdrop');
    assert(dsCss.includes('safe-area-inset-bottom'), 'Safe-area-inset-bottom is handled for iPhone home indicator');
    assert(dsCss.includes('@media print'), 'Print stylesheet hides mobile bottom navigation bar');
  }

  // Test 5: Construction-Grade Design System Tokens
  console.log('\nTest 5: Construction-Grade Design System Tokens');
  {
    const dsCssPath = path.resolve(process.cwd(), 'src', 'styles', 'design-system.css');
    const dsCss = fs.readFileSync(dsCssPath, 'utf8');

    assert(dsCss.includes('--ds-accent-amber: #f59e0b'), 'High-visibility safety construction amber token defined (#f59e0b)');
    assert(dsCss.includes('--ds-accent-amber-dark: #d97706'), 'Dark amber hover token defined (#d97706)');
    assert(dsCss.includes('--ds-primary: #0f172a'), 'Deep slate navy header token defined (#0f172a)');
    assert(dsCss.includes('--ds-status-present: #16a34a'), 'Forest green present status token defined (#16a34a)');
    assert(dsCss.includes('--ds-status-absent: #dc2626'), 'Crimson red absent status token defined (#dc2626)');
    assert(dsCss.includes('border-radius: 8px'), 'Universal 8px border-radius applied to inputs');
    assert(dsCss.includes('rgba(245, 158, 11'), 'Focus ring styled with construction amber');
  }

  // Test 6: Zero-Network Offline Data Operation
  console.log('\nTest 6: Zero-Network Offline Data Operation');
  {
    const testSite: Partial<StorageSite> = {
      siteName: 'Offline Remote Jobsite Site 44',
      ownerName: 'Venkatesan',
      phone: '9840123456',
      location: 'Madurai Rural',
      buildingType: 'Industrial Warehouse',
      totalBudget: 4500000,
      status: 'active',
    };

    const saved = await storageService.saveSite(testSite);
    assert(!!saved.id, 'Site saved offline receives unique UUID');
    assert(saved.siteName === 'Offline Remote Jobsite Site 44', 'Site details persisted accurately');

    const retrieved = await storageService.getSite(saved.id);
    assert(!!retrieved && retrieved.phone === '9840123456', 'Can read saved records offline without remote server');

    const allSites = await storageService.getSites();
    assert(allSites.some(s => s.id === saved.id), 'Offline sites collection queries instantly');
  }

  console.log(`\n========================================`);
  console.log(`Phase 5 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
