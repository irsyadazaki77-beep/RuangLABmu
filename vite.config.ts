import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import {
  resolveViteAllowedHosts,
  shouldRelaxHeadersForEmbeddedPreview,
} from './server/utils/securityHeaders.ts';

function crossOriginIsolationPlugin(): Plugin {
  const strictFrameguard = process.env.STRICT_FRAMEGUARD === 'true';
  return {
    name: 'cross-origin-isolation-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader(
          'Cross-Origin-Embedder-Policy',
          shouldRelaxHeadersForEmbeddedPreview(req.headers, strictFrameguard)
            ? 'unsafe-none'
            : 'require-corp'
        );
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader(
          'Cross-Origin-Embedder-Policy',
          shouldRelaxHeadersForEmbeddedPreview(req.headers, strictFrameguard)
            ? 'unsafe-none'
            : 'require-corp'
        );
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      crossOriginIsolationPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.svg', 'pwa-512x512.svg'],
        manifest: {
          name: 'RuangLABmu - Laboratorium Sains Virtual 3D',
          short_name: 'RuangLABmu',
          description:
            'Platform praktikum sains interaktif real-time 3D fisika, kimia, biologi, dan astronomi terintegrasi LMS.',
          theme_color: '#0284c7',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
            {
              src: '/pwa-512x512.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/lucide-react') || id.includes('node_modules/zustand')) {
              return 'vendor-ui';
            }
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable')) {
              return 'vendor-pdf';
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'motion/react'],
    },
    server: {
      allowedHosts: resolveViteAllowedHosts(),
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      allowedHosts: resolveViteAllowedHosts(),
    },
  };
});
