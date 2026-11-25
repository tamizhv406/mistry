import { fileURLToPath } from 'node:url'
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
  resolve: {
    alias: [
      // Resolve bare `three` & `maplibre-gl` to modular ESM sources so Vite tree-shakes unused
      // subsystems and splits chunks cleanly below 500 kB using the default warning threshold.
      { find: /^three$/, replacement: 'three/src/Three.js' },
      { find: /^maplibre-gl$/, replacement: fileURLToPath(new URL('./node_modules/maplibre-gl/src/index.ts', import.meta.url)) },
    ],
  },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  define: {
    // From the environment only (no built-in project URL or key).
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || ''),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''),
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      // Two pages: the app, and the Floor Planner that the app opens in a frame.
      input: {
        main: 'index.html',
        'floor-planner': 'floor-planner.html',
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'vendor-ui', test: /node_modules[\\/](lucide-react|motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 35 },
            { name: 'vendor-dexie', test: /node_modules[\\/](dexie|dexie-react-hooks)[\\/]/, priority: 35 },
            { name: 'vendor-supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 35 },
            { name: 'vendor-i18n', test: /node_modules[\\/](i18next|i18next-browser-languagedetector|react-i18next)[\\/]/, priority: 35 },
            { name: 'vendor-konva', test: /node_modules[\\/](konva|react-konva)[\\/]/, priority: 35 },
            { name: 'vendor-geometry', test: /node_modules[\\/](clipper2-ts|zod)[\\/]/, priority: 35 },
            { name: 'vendor-jspdf', test: /node_modules[\\/](jspdf|jspdf-autotable)[\\/]/, maxSize: 450 * 1024, priority: 35 },
            { name: 'vendor-three', test: /node_modules[\\/]three[\\/]/, maxSize: 380 * 1024, priority: 35 },
            { name: 'vendor-r3f', test: /node_modules[\\/](@react-three|react-reconciler|three-stdlib|postprocessing|n8ao|three-bvh-csg|troika-)/, maxSize: 380 * 1024, priority: 30 },
            { name: 'vendor-maplibre', test: /node_modules[\\/](maplibre-gl|@maplibre|proj4|earcut|gl-matrix|pbf|@mapbox)[\\/]/, maxSize: 380 * 1024, priority: 30 },
            { name: 'floor-planner-app', test: /src[\\/]floorPlanner[\\/]/, maxSize: 380 * 1024, priority: 10 },
          ],
        },
      },
    },
  },
  css: {
    postcss: {},
  },
})
