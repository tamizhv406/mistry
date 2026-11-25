import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, APP_TAGLINE, BRAND_COLORS, logoSvg } from './src/config/brand.ts'

// Relative paths suit the Android app and GitHub Pages, which serve from a folder. Vercel
// serves from the domain root and answers unknown paths with index.html, which only finds
// its files when they are addressed from the root.
const servedFromRoot = Boolean(process.env.VERCEL)

// index.html links its icons and manifest as "./…". From a deeper path those would point
// into a folder that does not exist, so a root build addresses them from the root.
const rootLinks: Plugin = {
  name: 'mistry-root-links',
  transformIndexHtml: html => html.replaceAll('href="./', 'href="/'),
}

// The app name, colours and logo in index.html come from src/config/brand.ts (%APP_NAME% etc.).
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const brandTokens: Record<string, string> = {
  '%APP_NAME%': escapeHtml(APP_NAME),
  '%APP_SHORT_NAME%': escapeHtml(APP_SHORT_NAME),
  '%APP_TAGLINE%': escapeHtml(APP_TAGLINE),
  '%APP_DESCRIPTION%': escapeHtml(APP_DESCRIPTION),
  '%BRAND_PRIMARY%': BRAND_COLORS.primary,
  '%BRAND_DARK%': BRAND_COLORS.dark,
  '%BRAND_BACKGROUND%': BRAND_COLORS.background,
  '%BRAND_CARD%': BRAND_COLORS.card,
  '%APP_LOGO_SVG%': logoSvg({ size: 40 }),
}
const brandHtml: Plugin = {
  name: 'app-brand',
  transformIndexHtml: html => Object.entries(brandTokens).reduce((out, [token, value]) => out.replaceAll(token, value), html),
}

// https://vite.dev/config/
export default defineConfig({
  base: servedFromRoot ? '/' : './',
  plugins: [react(), brandHtml, ...(servedFromRoot ? [rootLinks] : [])],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  define: {
    // From the environment only (no built-in project URL or key).
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
  },
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      // Two pages: the app, and the Floor Planner that the app opens in a frame.
      input: {
        main: 'index.html',
        'floor-planner': 'floor-planner.html',
      },
      output: {
        // Only the app's own libraries get fixed chunks. Everything the Floor Planner alone uses
        // (map, canvas, 3D extras, i18n) is left to Rollup, so it splits along the planner's
        // lazy imports and never loads with the main app.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const pkg = /node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id)?.[1].replace(/\\/g, '/');
          if (!pkg) return undefined;
          if (['react', 'react-dom', 'scheduler', 'lucide-react', 'motion', 'framer-motion', 'motion-dom', 'motion-utils'].includes(pkg)) return 'vendor-framework';
          if (pkg === 'dexie' || pkg === 'dexie-react-hooks' || pkg.startsWith('@supabase/')) return 'vendor-db';
          if (pkg === 'jspdf' || pkg === 'jspdf-autotable') return 'vendor-jspdf';
          if (pkg === 'three') return 'vendor-three';
          return undefined;
        },
      },
    },
  },
  css: {
    postcss: {},
  },
})
