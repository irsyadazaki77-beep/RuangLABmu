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
        const relax = shouldRelaxHeadersForEmbeddedPreview(req.headers, strictFrameguard);
        if (relax) {
          res.removeHeader('X-Frame-Options');
        }
        res.setHeader('Cross-Origin-Opener-Policy', relax ? 'unsafe-none' : 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', relax ? 'unsafe-none' : 'require-corp');
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const relax = shouldRelaxHeadersForEmbeddedPreview(req.headers, strictFrameguard);
        if (relax) {
          res.removeHeader('X-Frame-Options');
        }
        res.setHeader('Cross-Origin-Opener-Policy', relax ? 'unsafe-none' : 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', relax ? 'unsafe-none' : 'require-corp');
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
        registerType: 'prompt',
        includeAssets: ['pwa-192x192.svg', 'pwa-512x512.svg'],
        manifest: {
          id: '/',
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
          skipWaiting: false,
          clientsClaim: false,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          globIgnores: ['**/vendor-pdf*.js', '**/assets/images/**', '**/assets/aistudio/**'],
          runtimeCaching: [
            {
              urlPattern: /\.(?:woff2|css)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'ruanglabmu-fonts-styles',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/assets\/vendor-pdf.*\.js$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ruanglabmu-pdf-runtime',
                expiration: {
                  maxEntries: 4,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/assets\/.*\.(?:png|jpg|jpeg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'ruanglabmu-media-runtime',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^\/(?:api|ws-lab)\b/,
              handler: 'NetworkOnly',
            },
          ],
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
            const nid = id.replace(/\\/g, '/');
            if (nid.includes('node_modules/three/examples/')) {
              return 'vendor-three-addons';
            }
            if (nid.includes('node_modules/three/')) {
              return 'vendor-three';
            }
            if (
              nid.includes('node_modules/react/') ||
              nid.includes('node_modules/react-dom/') ||
              nid.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (
              nid.includes('node_modules/i18next') ||
              nid.includes('node_modules/react-i18next')
            ) {
              return 'vendor-i18n';
            }
            if (nid.includes('node_modules/zod')) {
              return 'vendor-zod';
            }
            if (
              nid.includes('node_modules/motion') ||
              nid.includes('node_modules/lucide-react') ||
              nid.includes('node_modules/zustand')
            ) {
              return 'vendor-ui';
            }
            if (nid.includes('node_modules/jspdf') || nid.includes('node_modules/jspdf-autotable')) {
              return 'vendor-pdf';
            }
            if (nid.includes('node_modules/qrcode')) {
              return 'vendor-qr';
            }
            if (
              nid.includes('/src/utils/threeStudioKit') ||
              nid.includes('/src/utils/threeStudioHost') ||
              nid.includes('/src/utils/threePostProcessing') ||
              nid.includes('/src/utils/threeMeasurementTools')
            ) {
              return 'lab-three-kit';
            }
            if (nid.includes('/src/utils/engines/') || nid.includes('/src/utils/scienceEngine')) {
              return 'lab-engines';
            }
            if (nid.includes('/src/registry/')) {
              return 'lab-curriculum';
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'motion/react', 'qrcode'],
    },
    server: {
      allowedHosts: resolveViteAllowedHosts(),
      ...(process.env.DISABLE_HMR === 'true' ? { hmr: false, watch: null } : {}),
    },
    preview: {
      allowedHosts: resolveViteAllowedHosts(),
    },
  };
});
