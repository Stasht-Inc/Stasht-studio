import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import axios from 'axios'
import { VitePWA } from 'vite-plugin-pwa'

const PHP_BACKEND = 'http://localhost/stasht-for-multiple-admins/public';
const API_BASE    = `${PHP_BACKEND}/api/react`;

const BOT_AGENTS = ['whatsapp', 'telegrambot', 'twitterbot', 'facebookexternalhit', 'linkedinbot', 'slackbot', 'googlebot'];

function isBot(ua: string) {
  const lower = ua.toLowerCase();
  return BOT_AGENTS.some(b => lower.includes(b));
}

function esc(text: string) {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Icon.svg', 'pwa-icon-192.png', 'pwa-icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Stasht Studio',
        short_name: 'Stasht',
        description: 'Capture and share your precious memories with Stasht',
        theme_color: '#6C60FF',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: '/',
        icons: [
          {
            src: 'pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/s\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/stasht-data\.s3\.us-east-2\.amazonaws\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 's3-media-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    }),
    {
      name: 'share-link-og-handler',
      configureServer(server) {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          const match = (req.url || '').match(/^\/s\/([a-zA-Z0-9_-]+)/);
          if (!match) return next();

          const token = match[1];
          const ua = req.headers['user-agent'] || '';

          if (isBot(ua)) {
            try {
              const apiResp = await axios.get(`${API_BASE}/share-qr/info/${token}`);
              const data = apiResp.data?.data || apiResp.data;
              const title       = esc(data?.title || 'Shared Memory');
              const description = esc(data?.description || 'You have been invited to join a memory on Stasht.');
              const image       = data?.last_update_img || data?.thumbnail || '';
              const pageUrl     = `http://localhost:5173/s/${token}`;

              const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${title} - Stasht Memory" />
  <meta property="og:description" content="${description}" />
  ${image ? `<meta property="og:image" content="${image}" />\n  <meta property="og:image:width" content="1200" />\n  <meta property="og:image:height" content="630" />` : ''}
  <meta property="og:site_name" content="Stasht" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title} - Stasht Memory" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
  <title>${title} - Stasht</title>
</head>
<body><p>Loading...</p></body>
</html>`;
              res.setHeader('Content-Type', 'text/html');
              return res.end(html);
            } catch {
              return next();
            }
          }

          // Regular user → redirect to PHP join page
          res.statusCode = 302;
          res.setHeader('Location', `${PHP_BACKEND}/s/${token}`);
          return res.end();
        });
      }
    }
  ],
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lucide-react']
        }
      }
    }
  },
  preview: {
    port: 4175,
    strictPort: true
  },
  server: mode === 'development' ? {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: PHP_BACKEND,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
        }
      },
      '/s3-proxy': {
        target: 'https://stasht-data.s3.us-east-2.amazonaws.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/s3-proxy/, ''),
      }
    }
  } : {}
}))
