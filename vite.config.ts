/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'robots.txt', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'VanBora',
        short_name: 'VanBora',
        description: 'Porque cada caminho importa.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1f3a',
        theme_color: '#0b1f3a',
        categories: ['travel', 'education', 'navigation'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Estratégia segura: o app-shell é pré-cacheado; nada de dados privados
        // é armazenado aqui. Dados sensíveis vão para chamadas de rede sem cache.
        // As animações são pedidas com parâmetros (?capture, ?bg, ?v): o cache
        // offline deve reconhecê-las mesmo assim.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^capture$/, /^bg$/, /^v$/],
        navigateFallback: 'index.html',
        // /animacoes: páginas próprias (iframes das animações), não o app-shell.
        navigateFallbackDenylist: [/^\/api\//, /^\/animacoes\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: false,
  },
});
