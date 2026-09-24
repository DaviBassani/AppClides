import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', 'SUPABASE_');
    return {
      server: {
        port: 3000,
        host: process.env.DEV_HOST || '127.0.0.1',
      },
      plugins: [react(), tailwindcss()],
      define: {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            // Stable vendor chunks: app changes never invalidate vendor cache.
            // katex/chat stay out of this map so the lazy import keeps its own chunk.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('lucide-react')) return 'icons';
              return 'vendor';
            }
          }
        }
      }
    };
});
