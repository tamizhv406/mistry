import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- TEST: RESPONSIVE HEADER, LEFT SLIDE-IN DRAWER & PHONE BOTTOM NAV ---');

// 1. One header (TopNav, with the project switcher); the 5-tab bottom bar on phones only (Task 5)
console.log('\nTest 1: App.tsx chrome hierarchy (one header, bottom nav on phones only)');
{
  const appPath = path.resolve(process.cwd(), 'src', 'App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');

  assert(!appCode.includes('<MobileTopBar'), 'No second header: MobileTopBar is not rendered');
  assert(appCode.includes('{isPhone && <MobileBottomNav'), 'Bottom navigation is rendered on phones only');
  assert(appCode.includes('<ProjectSwitcher'), 'The project switcher sits in the one header');
  console.log('  ✓ One header with the project switcher');
  console.log('  ✓ Bottom navigation on phones only');
}

// 2. Responsive TopNav Header with Hamburger, Streamlined Language Pill & Mobile Search
console.log('\nTest 2: TopNav responsive header elements');
{
  const topNavPath = path.resolve(process.cwd(), 'src', 'components', 'TopNav.tsx');
  const topNavCode = fs.readFileSync(topNavPath, 'utf8');

  assert(topNavCode.includes('id="erp-mobile-hamburger"'), 'Hamburger button exists with ID #erp-mobile-hamburger');
  assert(topNavCode.includes('onToggleSidebarMobile'), 'Hamburger triggers onToggleSidebarMobile callback');
  assert(topNavCode.includes('erp-mobile-lang-pill'), 'Streamlined mobile language toggle pill present');
  assert(topNavCode.includes('id="erp-mobile-lang-toggle"'), 'Mobile language pill has ID #erp-mobile-lang-toggle');
  assert(topNavCode.includes('erp-lang-desktop-switch'), 'Desktop segmented language switch present');
  assert(topNavCode.includes('id="erp-mobile-search-btn"'), 'Mobile search icon button exists with ID #erp-mobile-search-btn');
  console.log('  ✓ Hamburger button present with #erp-mobile-hamburger');
  console.log('  ✓ Mobile language toggle pill present with #erp-mobile-lang-toggle');
  console.log('  ✓ Mobile search button present with #erp-mobile-search-btn');
}

// 3. Navigation Drawer: Left Slide-In Animation & Alignment
console.log('\nTest 3: Navigation Drawer left slide-in animation & styling');
{
  const appShellPath = path.resolve(process.cwd(), 'src', 'components', 'AppShell.tsx');
  const appShellCode = fs.readFileSync(appShellPath, 'utf8');

  assert(appShellCode.includes('app-shell-drawer-overlay'), 'AppShell defines .app-shell-drawer-overlay');
  assert(appShellCode.includes('app-shell-drawer-content'), 'AppShell defines .app-shell-drawer-content');
  assert(!appShellCode.includes('mobile-drawer-content'), 'AppShell content does not use bottom sheet class');

  const cssPath = path.resolve(process.cwd(), 'src', 'styles', 'erp-dashboard.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert(css.includes('justify-content: flex-start'), 'Drawer overlay aligns to the left (flex-start)');
  assert(css.includes('animation: erpSlideInFromLeft'), 'Drawer content uses erpSlideInFromLeft animation');
  assert(css.includes('@keyframes erpSlideInFromLeft'), 'Keyframes erpSlideInFromLeft defined');
  assert(css.includes('transform: translateX(-100%)'), 'Keyframe starts from translateX(-100%)');
  assert(css.includes('transform: translateX(0)'), 'Keyframe animates to translateX(0)');
  console.log('  ✓ Drawer overlay aligns to left side (justify-content: flex-start)');
  console.log('  ✓ Drawer content animates with erpSlideInFromLeft (translateX -100% -> 0)');
}

// 4. In-Drawer Language Switcher
console.log('\nTest 4: In-drawer bilingual language switcher in AppSidebar');
{
  const sidebarPath = path.resolve(process.cwd(), 'src', 'components', 'AppSidebar.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');

  assert(sidebarCode.includes('sidebar-lang-banner'), 'AppSidebar has sidebar-lang-banner container');
  assert(sidebarCode.includes('English'), 'AppSidebar has English option');
  assert(sidebarCode.includes('தமிழ்'), 'AppSidebar has Tamil option');
  console.log('  ✓ AppSidebar includes bilingual language toggle inside drawer');
}

// 5. Bottom navigation: hidden on tablets/desktops, 5 columns on phones (Task 5)
console.log('\nTest 5: Bottom navigation CSS');
{
  const cssPath = path.resolve(process.cwd(), 'src', 'styles', 'erp-dashboard.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const wide = css.slice(css.indexOf('@media (min-width: 769px)'));
  const phone = css.slice(css.indexOf('#app-mobile-nav.m-nav'));

  assert(css.includes('#app-mobile-nav'), 'CSS targets #app-mobile-nav');
  assert(wide.indexOf('display: none !important;') > 0 && wide.indexOf('display: none !important;') < 200, 'Hidden from 769px up');
  assert(css.includes('--m-nav-h: 0px !important'), 'No space kept for it from 769px up');
  assert(phone.includes('repeat(5, minmax(0, 1fr))'), 'Five equal tabs on phones');
  assert(css.includes('font-size: 14px !important'), 'Tab labels are 14px');
  console.log('  ✓ Hidden from 769px; 5 tabs with 14px labels on phones');
}

console.log('\n========================================');
console.log('All Responsive Header, Drawer & Bottom Nav Tests Passed!');
console.log('========================================\n');
