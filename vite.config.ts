import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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

// https://vite.dev/config/
export default defineConfig({
  base: servedFromRoot ? '/' : './',
  plugins: [react(), ...(servedFromRoot ? [rootLinks] : [])],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kfnbabbknhzbjhxcozan.supabase.co'
    ),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hOOf94GN9Z4UuGAnQ30BSg_KiijLvuQ'
    ),
  },
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three';
            if (id.includes('react') || id.includes('lucide') || id.includes('motion')) return 'vendor-framework';
            if (id.includes('dexie') || id.includes('supabase')) return 'vendor-db';
            return 'vendor-deps';
          }
        },
      },
    },
  },
  css: {
    postcss: {},
  },
})
